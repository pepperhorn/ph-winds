import type { BoardMeta, BoardState, CardItem, CardKind, DiagramStyle, TextCard, TextField, TextKey } from './types';
import { createBoard, DEFAULT_STYLE } from './defaults';
import { applyCardPatch, IMAGE_BUDGET_CHARS } from './textCards';
import { MAX_IMAGE_CHARS } from './image';
import { isTextCard } from './types';
import { isCardIconId } from '@/components/cardIcons';
import { listInstruments, getInstrument } from '@/music/instruments';

/**
 * An import either fails outright, or succeeds — possibly with a `warning` the
 * host must show. A warning means the board loaded but is not byte-identical
 * to the file; it is never used for anything the user can ignore.
 */
type Result = { ok: true; state: BoardState; warning?: string } | { ok: false; error: string };
const STEPS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Only known kinds survive. Anything else — a typo, a kind from a newer
 * version, a hostile value — is read as a fingering card, which is also what
 * an absent `kind` means, so boards saved before text cards existed load
 * unchanged with no migration pass.
 */
export const parseKind = (v: unknown): CardKind => (v === 'text' ? 'text' : 'fingering');

/**
 * A card icon is an ID from `cardIcons`, not a path and not a glyph. Accept a
 * string only when it carries a known prefix (`music:` / `obj:`); everything
 * else — a bare label, a junk namespace, a URL — becomes "no icon". An ID the
 * prefix check passes but this build doesn't ship simply renders as nothing.
 */
export const parseIcon = (v: unknown): string | undefined => (isCardIconId(v) ? v : undefined);

/**
 * SECURITY BOUNDARY. An imported board is untrusted input and this value goes
 * straight into an `<img src>`, so the scheme is the whole defence.
 *
 * Accept ONLY a string that begins, with no leading whitespace, with
 * `data:image/`. That rejects `javascript:`, `data:text/html,<script>`,
 * remote URLs (which would also phone home on render), and whitespace-prefixed
 * bypasses such as `" data:image/png;base64,..."` — browsers strip leading
 * whitespace from a URL attribute, so a trim-then-check would let
 * `" javascript:..."` through. Never trim before testing.
 *
 * The value is rendered with `<img>` and ONLY `<img>` — never `<object>`,
 * `<iframe>` or `<embed>`. A `data:image/svg+xml` document is inert in an
 * `<img>` (no scripts, no external fetches) and executable in the other three.
 *
 * Oversize pictures are dropped rather than being fatal. The cap is
 * `MAX_IMAGE_CHARS` — what the editor can actually author for ONE picture —
 * not the whole board's `IMAGE_BUDGET_CHARS`. Anything this app produced still
 * round-trips, with slack; a hand-crafted 1.4 MB picture no longer sails
 * through just because it fits the budget a whole board gets.
 *
 * This is only half the defence: a per-picture cap says nothing about a file
 * carrying many of them. The board-wide running total lives in `parseBoard`,
 * which is the only place that can see every card.
 */
export function parseImage(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (!v.startsWith('data:image/')) return undefined;
  if (v.length > MAX_IMAGE_CHARS) return undefined;
  return v;
}

/**
 * Was this a real picture that `parseImage` dropped purely for its size?
 * Reporting only — never a gate. Kept next to `parseImage` so the two cannot
 * drift apart about what "too big" means.
 */
const oversizeImage = (v: unknown): boolean =>
  typeof v === 'string' && v.startsWith('data:image/') && v.length > MAX_IMAGE_CHARS;

function checkCard(c: any, i: number): string | null {
  const at = `card ${i + 1}`;
  if (!isObj(c) || typeof c.id !== 'string') return `${at}: missing id`;
  const scaleBad = typeof c.scale !== 'number' || c.scale < 0.5 || c.scale > 2;
  // A text card has no pitch, fingering, display or orientation to require;
  // its icon/image/text are all coerced rather than fatal. Scale is the one
  // check both kinds share, so it is the only one a text card runs.
  if (parseKind(c.kind) === 'text') return scaleBad ? `${at}: bad scale` : null;
  // Field order is the original one: pitch first, scale last. A card that is
  // bad in several ways reports the same field it always did.
  const p = c.pitch;
  if (!isObj(p) || !STEPS.has(p.step) || ![-1, 0, 1].includes(p.alter) || !Number.isInteger(p.octave)) return `${at}: bad pitch`;
  if (!Number.isInteger(c.fingeringIndex) || c.fingeringIndex < 0) return `${at}: bad fingeringIndex`;
  if (!['fingering', 'both', 'notation'].includes(c.display)) return `${at}: bad display`;
  if (!['vertical', 'horizontal'].includes(c.orientation)) return `${at}: bad orientation`;
  if (scaleBad) return `${at}: bad scale`;
  return null;
}

const TEXT_SIZES = new Set(['S', 'M', 'L']);
const ALIGNS = new Set(['left', 'center', 'right']);
const LOOKS = new Set(['solid', 'dotted', 'ghost']);

// Validate a TextField against its own default: bad/missing whole object -> default;
// per sub-field invalid -> that sub-field's default.
function validTextField(v: unknown, fallback: TextField): TextField {
  if (!isObj(v)) return fallback;
  return {
    text: typeof v.text === 'string' ? v.text : fallback.text,
    show: typeof v.show === 'boolean' ? v.show : fallback.show,
    size: TEXT_SIZES.has(v.size) ? v.size : fallback.size,
    align: ALIGNS.has(v.align) ? v.align : fallback.align,
  };
}

// Validate a partial TextField override (card-level): drop invalid sub-fields, keep valid ones.
function partialTextField(v: unknown): Partial<TextField> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<TextField> = {};
  if (typeof v.text === 'string') out.text = v.text;
  if (typeof v.show === 'boolean') out.show = v.show;
  if (TEXT_SIZES.has(v.size)) out.size = v.size;
  if (ALIGNS.has(v.align)) out.align = v.align;
  return out;
}

// Validate a partial DiagramStyle override (card-level): drop invalid sub-fields.
function partialStyle(v: unknown, validVariants: Set<string>): Partial<DiagramStyle> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<DiagramStyle> = {};
  if (Array.isArray(v.variants)) {
    out.variants = v.variants.filter((x: unknown) => typeof x === 'string' && validVariants.has(x));
  }
  if (LOOKS.has(v.look)) out.look = v.look;
  if (typeof v.twoTone === 'boolean') out.twoTone = v.twoTone;
  if (typeof v.hints === 'boolean') out.hints = v.hints;
  if (typeof v.primary === 'string') out.primary = v.primary;
  if (typeof v.secondary === 'string') out.secondary = v.secondary;
  return out;
}

/** The three text slots, each sub-field kept only if it validates. */
function sanitizeText(c: any): Partial<Record<TextKey, Partial<TextField>>> | undefined {
  const t = isObj(c.text) ? c.text : undefined;
  if (!t) return undefined;
  const text: Partial<Record<TextKey, Partial<TextField>>> = {};
  (['heading', 'subtitle', 'footer'] as TextKey[]).forEach((k) => {
    if (k in t) {
      const pf = partialTextField(t[k]);
      if (pf) text[k] = pf;
    }
  });
  return Object.keys(text).length ? text : undefined;
}

function sanitizeTextCard(c: any): TextCard {
  const item: TextCard = { id: c.id, kind: 'text', scale: c.scale };
  const text = sanitizeText(c);
  if (text) item.text = text;
  const icon = parseIcon(c.icon);
  if (icon) item.icon = icon;
  const image = parseImage(c.image);
  if (image) item.image = image;
  // Run the imported card through the one place that owns the icon/picture
  // exclusion, so a hand-crafted file carrying both lands well-formed.
  return applyCardPatch(item) as TextCard;
}

function sanitizeCard(c: any, validVariants: Set<string>): CardItem {
  if (parseKind(c.kind) === 'text') return sanitizeTextCard(c);
  const item: CardItem = {
    id: c.id,
    pitch: c.pitch,
    fingeringIndex: c.fingeringIndex,
    display: c.display,
    orientation: c.orientation,
    scale: c.scale,
  };
  const text = sanitizeText(c);
  if (text) item.text = text;
  if ('style' in c) {
    const s = partialStyle(c.style, validVariants);
    if (s && Object.keys(s).length) item.style = s;
  }
  return item;
}

export function parseBoard(data: unknown): Result {
  if (!isObj(data)) return { ok: false, error: 'Not a board file' };
  if (data.version !== 1) return { ok: false, error: `Unsupported board version ${data.version}` };
  const m = data.meta;
  if (!isObj(m) || !listInstruments().some((i) => i.id === m.instrument)) return { ok: false, error: 'Unknown instrument' };
  if (!Array.isArray(data.items)) return { ok: false, error: 'Missing items' };
  for (let i = 0; i < data.items.length; i++) {
    const err = checkCard(data.items[i], i);
    if (err) return { ok: false, error: err };
  }

  const instrument = m.instrument as string;
  const info = getInstrument(instrument);
  const d = createBoard(instrument).meta;

  const hornIds = new Set(info.horns.map((h) => h.id));
  const horn = typeof m.horn === 'string' && hornIds.has(m.horn) ? m.horn : info.defaultHorn;

  const pitchMode = m.pitchMode === 'written' || m.pitchMode === 'concert' ? m.pitchMode : d.pitchMode;
  const musicFont = m.musicFont === 'bravura' || m.musicFont === 'petaluma' ? m.musicFont : d.musicFont;
  const columns = m.columns === 'auto' || (Number.isInteger(m.columns) && m.columns >= 1 && m.columns <= 4) ? m.columns : 'auto';
  const diagramOrient = m.diagramOrient === 'vertical' || m.diagramOrient === 'horizontal' ? m.diagramOrient : d.diagramOrient;

  const validVariants = new Set(Object.keys(info.layout.variants ?? {}));
  const rawStyle = isObj(m.style) ? m.style : {};
  const style: DiagramStyle = {
    variants: Array.isArray(rawStyle.variants)
      ? rawStyle.variants.filter((v: unknown) => typeof v === 'string' && validVariants.has(v))
      : DEFAULT_STYLE.variants,
    look: LOOKS.has(rawStyle.look) ? rawStyle.look : DEFAULT_STYLE.look,
    twoTone: typeof rawStyle.twoTone === 'boolean' ? rawStyle.twoTone : DEFAULT_STYLE.twoTone,
    hints: typeof rawStyle.hints === 'boolean' ? rawStyle.hints : DEFAULT_STYLE.hints,
    primary: typeof rawStyle.primary === 'string' ? rawStyle.primary : DEFAULT_STYLE.primary,
    secondary: typeof rawStyle.secondary === 'string' ? rawStyle.secondary : DEFAULT_STYLE.secondary,
  };

  const rawCardText = isObj(m.cardText) ? m.cardText : {};
  const meta: BoardMeta = {
    instrument,
    horn,
    pitchMode,
    musicFont,
    columns,
    title: validTextField(m.title, d.title),
    subtitle: validTextField(m.subtitle, d.subtitle),
    footer: validTextField(m.footer, d.footer),
    cardText: {
      heading: validTextField(rawCardText.heading, d.cardText.heading),
      subtitle: validTextField(rawCardText.subtitle, d.cardText.subtitle),
      footer: validTextField(rawCardText.footer, d.cardText.footer),
    },
    style,
    diagramOrient,
  };

  /**
   * The board-wide picture budget, charged as the cards are read.
   *
   * `parseImage` can only judge one picture; nothing there stops a file with
   * twenty legal-sized ones. Without this running total an import can hand the
   * app a board several times over `IMAGE_BUDGET_CHARS`, `localStorage.setItem`
   * then throws quota, and the board the user is looking at silently fails to
   * persist — it is simply gone on the next reload.
   *
   * Over-budget pictures are DROPPED and the import SUCCEEDS, with a warning
   * the host shows. Rationale: a partial board beats no board — the headings,
   * pitches, fingerings and layout are the work, and the pictures are the one
   * part the user can re-add by hand. The warning is what makes that honest
   * rather than silent, so it is not optional: `onImport` toasts it.
   */
  let imageChars = 0;
  let dropped = 0;
  const items = (data.items as any[]).map((c) => {
    const item = sanitizeCard(c, validVariants);
    if (!isTextCard(item)) return item;
    if (item.image) {
      if (imageChars + item.image.length > IMAGE_BUDGET_CHARS) { delete item.image; dropped++; }
      else imageChars += item.image.length;
    } else if (oversizeImage(c.image)) {
      // `parseImage` already refused this one for being bigger than the editor
      // can author. Different cap, same thing from where the user sits — a
      // picture that did not fit — so it joins the same count. A picture
      // rejected for its SCHEME is not counted: stripping a `javascript:` URL
      // is not news the user needs, and saying "1 picture was left out" about
      // it would be misleading.
      dropped++;
    }
    return item;
  });

  const warning = dropped
    ? `This board carries more picture data than fits in browser storage, so ${dropped === 1 ? 'a picture was' : `${dropped} pictures were`} left out. Everything else loaded.`
    : undefined;

  return { ok: true, state: { version: 1, meta, items }, warning };
}

export const exportBoardJson = (s: BoardState) => JSON.stringify(s, null, 2);

export function importBoardJson(text: string): Result {
  try { return parseBoard(JSON.parse(text)); } catch { return { ok: false, error: 'File is not valid JSON' }; }
}

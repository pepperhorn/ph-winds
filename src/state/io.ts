import type { BoardMeta, BoardState, CardItem, CardKind, DiagramStyle, TextCard, TextField, TextKey } from './types';
import { createBoard, DEFAULT_STYLE } from './defaults';
import { applyCardPatch, IMAGE_BUDGET_CHARS } from './textCards';
import { isCardIconId } from '@/components/cardIcons';
import { listInstruments, getInstrument } from '@/music/instruments';

type Result = { ok: true; state: BoardState } | { ok: false; error: string };
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
 * Oversize pictures are dropped rather than being fatal: the cap is the same
 * board-wide budget the editor enforces, so anything this app could author
 * round-trips, while a hand-crafted file cannot blow out local storage.
 */
export function parseImage(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (!v.startsWith('data:image/')) return undefined;
  if (v.length > IMAGE_BUDGET_CHARS) return undefined;
  return v;
}

function checkCard(c: any, i: number): string | null {
  const at = `card ${i + 1}`;
  if (!isObj(c) || typeof c.id !== 'string') return `${at}: missing id`;
  if (typeof c.scale !== 'number' || c.scale < 0.5 || c.scale > 2) return `${at}: bad scale`;
  // A text card has no pitch, fingering, display or orientation to require;
  // its icon/image/text are all coerced rather than fatal.
  if (parseKind(c.kind) === 'text') return null;
  const p = c.pitch;
  if (!isObj(p) || !STEPS.has(p.step) || ![-1, 0, 1].includes(p.alter) || !Number.isInteger(p.octave)) return `${at}: bad pitch`;
  if (!Number.isInteger(c.fingeringIndex) || c.fingeringIndex < 0) return `${at}: bad fingeringIndex`;
  if (!['fingering', 'both', 'notation'].includes(c.display)) return `${at}: bad display`;
  if (!['vertical', 'horizontal'].includes(c.orientation)) return `${at}: bad orientation`;
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

  const items = (data.items as any[]).map((c) => sanitizeCard(c, validVariants));

  return { ok: true, state: { version: 1, meta, items } };
}

export const exportBoardJson = (s: BoardState) => JSON.stringify(s, null, 2);

export function importBoardJson(text: string): Result {
  try { return parseBoard(JSON.parse(text)); } catch { return { ok: false, error: 'File is not valid JSON' }; }
}

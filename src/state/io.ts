import type { BoardMeta, BoardState, CardItem, DiagramStyle, TextField, TextKey } from './types';
import { createBoard, DEFAULT_STYLE } from './defaults';
import { listInstruments, getInstrument } from '@/music/instruments';

type Result = { ok: true; state: BoardState } | { ok: false; error: string };
const STEPS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkCard(c: any, i: number): string | null {
  const at = `card ${i + 1}`;
  if (!isObj(c) || typeof c.id !== 'string') return `${at}: missing id`;
  const p = c.pitch;
  if (!isObj(p) || !STEPS.has(p.step) || ![-1, 0, 1].includes(p.alter) || !Number.isInteger(p.octave)) return `${at}: bad pitch`;
  if (!Number.isInteger(c.fingeringIndex) || c.fingeringIndex < 0) return `${at}: bad fingeringIndex`;
  if (!['fingering', 'both', 'notation'].includes(c.display)) return `${at}: bad display`;
  if (!['vertical', 'horizontal'].includes(c.orientation)) return `${at}: bad orientation`;
  if (typeof c.scale !== 'number' || c.scale < 0.5 || c.scale > 2) return `${at}: bad scale`;
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

function sanitizeCard(c: any, validVariants: Set<string>): CardItem {
  const item: CardItem = {
    id: c.id,
    pitch: c.pitch,
    fingeringIndex: c.fingeringIndex,
    display: c.display,
    orientation: c.orientation,
    scale: c.scale,
  };
  if ('text' in c) {
    const t = isObj(c.text) ? c.text : undefined;
    if (t) {
      const text: Partial<Record<TextKey, Partial<TextField>>> = {};
      (['heading', 'subtitle', 'footer'] as TextKey[]).forEach((k) => {
        if (k in t) {
          const pf = partialTextField(t[k]);
          if (pf) text[k] = pf;
        }
      });
      if (Object.keys(text).length) item.text = text;
    }
  }
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

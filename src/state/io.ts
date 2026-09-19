import type { BoardState, CardItem } from './types';
import { createBoard, textField, DEFAULT_STYLE } from './defaults';
import { listInstruments } from '@/music/instruments';

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
  const d = createBoard(m.instrument).meta;
  const tf = (v: unknown, fallback = textField()) => (isObj(v) ? { ...fallback, ...v } : fallback);
  const meta = {
    ...d, ...m,
    title: tf(m.title, d.title), subtitle: tf(m.subtitle, d.subtitle), footer: tf(m.footer, d.footer),
    cardText: {
      heading: tf(m.cardText?.heading, d.cardText.heading),
      subtitle: tf(m.cardText?.subtitle, d.cardText.subtitle),
      footer: tf(m.cardText?.footer, d.cardText.footer),
    },
    style: { ...DEFAULT_STYLE, ...(isObj(m.style) ? m.style : {}) },
  };
  return { ok: true, state: { version: 1, meta, items: data.items as CardItem[] } };
}

export const exportBoardJson = (s: BoardState) => JSON.stringify(s, null, 2);

export function importBoardJson(text: string): Result {
  try { return parseBoard(JSON.parse(text)); } catch { return { ok: false, error: 'File is not valid JSON' }; }
}

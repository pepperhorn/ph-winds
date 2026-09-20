import { describe, it, expect } from 'vitest';
import { boardReducer } from './boardReducer';
import { createBoard, newCardDraft } from './defaults';
import { formatPitch, parsePitch } from '@/music/pitch';

const card = (id: string, n = 'C5') => ({ id, ...newCardDraft(parsePitch(n)) });
const withCards = (...ids: string[]) => ids.reduce((s, id) => boardReducer(s, { type: 'add', card: card(id) }), createBoard());

describe('boardReducer', () => {
  it('adds, updates, removes', () => {
    let s = withCards('a');
    s = boardReducer(s, { type: 'update', id: 'a', patch: { scale: 1.5 } });
    expect(s.items[0].scale).toBe(1.5);
    s = boardReducer(s, { type: 'remove', id: 'a' });
    expect(s.items).toEqual([]);
  });
  it('duplicates after the source', () => {
    const s = boardReducer(withCards('a', 'b'), { type: 'duplicate', id: 'a', newId: 'a2' });
    expect(s.items.map((i) => i.id)).toEqual(['a', 'a2', 'b']);
  });
  it('reorders to the target slot', () => {
    const s = boardReducer(withCards('a', 'b', 'c'), { type: 'reorder', fromId: 'c', toId: 'a' });
    expect(s.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
  it('setInstrument keeps cards, resets style variants, and does not touch meta.horn for a horn-less instrument', () => {
    let s = withCards('a');
    s = boardReducer(s, { type: 'setMeta', patch: { style: { ...s.meta.style, variants: ['palm-bean'] } } });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    expect(s.items).toHaveLength(1);
    expect(s.meta.instrument).toBe('clarinet');
    expect(s.meta.horn).toBeUndefined();
    expect(s.meta.style.variants).toEqual([]);
  });
  it('remaps written pitch to keep the sounding pitch: alto sax C5 -> flute', () => {
    // alto sax (-9 semis) C5 sounds Eb4 (midi 63); flute (0 semis) reads midi
    // 63 written. Flute's fingering chart spells that note D#4, not the
    // enharmonic Eb4 (spellWritten prefers the fingering file's own spelling).
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    expect(formatPitch(s.items[0].pitch)).toBe('D♯4');
    expect(s.items[0].fingeringIndex).toBe(0);
  });
  it('remaps written pitch to keep the sounding pitch: alto sax C5 -> clarinet', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    expect(formatPitch(s.items[0].pitch)).toBe('F4');
  });
  it('remaps written pitch to keep the sounding pitch: flute C5 -> alto sax', () => {
    let s = boardReducer(createBoard('flute'), { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'saxophone', horn: 'alto' });
    expect(formatPitch(s.items[0].pitch)).toBe('A5');
  });
  it('round trip returns the original written note', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'saxophone', horn: 'alto' });
    expect(formatPitch(s.items[0].pitch)).toBe('C5');
  });
  it('preserves fingeringIndex reset, and card text/style/scale overrides across a remap', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, {
      type: 'add',
      card: { ...card('a', 'C5'), fingeringIndex: 2, scale: 1.5, text: { heading: { text: 'My note' } }, style: { look: 'dotted' } },
    });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    const [c] = s.items;
    expect(c.fingeringIndex).toBe(0);
    expect(c.scale).toBe(1.5);
    expect(c.text).toEqual({ heading: { text: 'My note' } });
    expect(c.style).toEqual({ look: 'dotted' });
  });
  it('clear empties the board without touching meta', () => {
    const s = boardReducer(withCards('a', 'b'), { type: 'clear' });
    expect(s.items).toEqual([]);
    expect(s.meta.instrument).toBe('saxophone');
  });
});

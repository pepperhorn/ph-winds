import { describe, it, expect } from 'vitest';
import { boardReducer, duplicateDropsImage } from './boardReducer';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { formatPitch, parsePitch, toMidi } from '@/music/pitch';
import { fingeringsFor } from '@/music/instruments';
import type { BoardState, CardItem, FingeringCard, TextCard } from './types';
import { isTextCard } from './types';
import { boardImageChars, IMAGE_BUDGET_CHARS, newTextCardDraft } from './textCards';

/** `CardItem` is a union now, so a reader has to narrow. These cases only ever
 * build fingering cards, so the assertion is the point. */
const fing = (c: CardItem) => c as FingeringCard;

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
  describe('reorder (insertion-index semantics)', () => {
    const ids = (s: ReturnType<typeof withCards>) => s.items.map((i) => i.id);

    it('drags forward: the card lands in the gap, not after the shifted neighbour', () => {
      // [a,b,c,d], drop a in the gap before c (index 2) -> [b,a,c,d].
      const s = boardReducer(withCards('a', 'b', 'c', 'd'), { type: 'reorder', fromId: 'a', toIndex: 2 });
      expect(ids(s)).toEqual(['b', 'a', 'c', 'd']);
    });
    it('drags forward past a card: index 3 lands after c', () => {
      const s = boardReducer(withCards('a', 'b', 'c', 'd'), { type: 'reorder', fromId: 'a', toIndex: 3 });
      expect(ids(s)).toEqual(['b', 'c', 'a', 'd']);
    });
    it('drags backward: index 1 lands after a, before b', () => {
      const s = boardReducer(withCards('a', 'b', 'c', 'd'), { type: 'reorder', fromId: 'd', toIndex: 1 });
      expect(ids(s)).toEqual(['a', 'd', 'b', 'c']);
    });
    it('drags to index 0 (the head of the board)', () => {
      const s = boardReducer(withCards('a', 'b', 'c'), { type: 'reorder', fromId: 'c', toIndex: 0 });
      expect(ids(s)).toEqual(['c', 'a', 'b']);
    });
    it('drags to items.length (the tail of the board)', () => {
      const s = boardReducer(withCards('a', 'b', 'c'), { type: 'reorder', fromId: 'a', toIndex: 3 });
      expect(ids(s)).toEqual(['b', 'c', 'a']);
    });
    it('the same insertion point is symmetric in both drag directions', () => {
      // Dropping into the gap between b and c (index 2) puts the card there
      // whichever side it came from.
      const fwd = boardReducer(withCards('a', 'b', 'c', 'd'), { type: 'reorder', fromId: 'a', toIndex: 2 });
      expect(ids(fwd)).toEqual(['b', 'a', 'c', 'd']);
      const back = boardReducer(withCards('a', 'b', 'c', 'd'), { type: 'reorder', fromId: 'd', toIndex: 2 });
      expect(ids(back)).toEqual(['a', 'b', 'd', 'c']);
    });
    it('is a no-op (same state reference) when the index is the card’s own slot', () => {
      const s0 = withCards('a', 'b', 'c');
      expect(boardReducer(s0, { type: 'reorder', fromId: 'b', toIndex: 1 })).toBe(s0);
      expect(boardReducer(s0, { type: 'reorder', fromId: 'b', toIndex: 2 })).toBe(s0);
    });
    it('is a no-op for an unknown fromId', () => {
      const s0 = withCards('a', 'b', 'c');
      expect(boardReducer(s0, { type: 'reorder', fromId: 'nope', toIndex: 0 })).toBe(s0);
    });
    it('clamps an out-of-range toIndex instead of throwing', () => {
      const s0 = withCards('a', 'b', 'c');
      expect(ids(boardReducer(s0, { type: 'reorder', fromId: 'a', toIndex: 99 }))).toEqual(['b', 'c', 'a']);
      expect(ids(boardReducer(s0, { type: 'reorder', fromId: 'c', toIndex: -4 }))).toEqual(['c', 'a', 'b']);
      // Clamping to the card's own slot still collapses to a no-op.
      expect(boardReducer(s0, { type: 'reorder', fromId: 'a', toIndex: -1 })).toBe(s0);
    });
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
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('D♯4');
    expect(fing(s.items[0]).fingeringIndex).toBe(0);
  });
  it('remaps written pitch to keep the sounding pitch: alto sax C5 -> clarinet', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('F4');
  });
  it('remaps written pitch to keep the sounding pitch: flute C5 -> alto sax', () => {
    let s = boardReducer(createBoard('flute'), { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'saxophone', horn: 'alto' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('A5');
  });
  it('round trip returns the original written note', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'saxophone', horn: 'alto' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('C5');
  });
  it('preserves fingeringIndex reset, and card text/style/scale overrides across a remap', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, {
      type: 'add',
      card: { ...card('a', 'C5'), fingeringIndex: 2, scale: 1.5, text: { heading: { text: 'My note' } }, style: { look: 'dotted' } },
    });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    const c = fing(s.items[0]);
    expect(c.fingeringIndex).toBe(0);
    expect(c.scale).toBe(1.5);
    expect(c.text).toEqual({ heading: { text: 'My note' } });
    expect(c.style).toEqual({ look: 'dotted' });
  });
  it('keeps style.variants on a horn-only switch (same instrument)', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { style: { ...createBoard('saxophone').meta.style, variants: ['palm-bean'] } } });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'saxophone', horn: 'tenor' });
    expect(s.meta.instrument).toBe('saxophone');
    expect(s.meta.horn).toBe('tenor');
    expect(s.meta.style.variants).toEqual(['palm-bean']);
  });
  it('resets style.variants to the default on a true instrument change', () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { style: { ...createBoard('saxophone').meta.style, variants: ['palm-bean'] } } });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    expect(s.meta.instrument).toBe('flute');
    expect(s.meta.style.variants).toEqual(DEFAULT_STYLE.variants);
  });
  it('remaps written pitch across an octave-transposing instrument: recorder C5 -> flute C6', () => {
    // recorder transposes +12 (sounds an octave above written); flute is
    // untransposed. To keep the sounding pitch, the written note must move
    // up an octave: recorder C5 (written) -> flute C6 (written).
    let s = boardReducer(createBoard('recorder'), { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('C6');
  });
  it('tin-whistle horn switch is an identity remap (all horns are transpose 0)', () => {
    let s = boardReducer(createBoard('tin-whistle'), { type: 'add', card: card('a', 'D5') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'tin-whistle', horn: 'C' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('D5');
  });
  it('round trips through an unavailable instrument: flute C7 -> trombone (unavailable) -> flute', () => {
    let s = boardReducer(createBoard('flute'), { type: 'add', card: card('a', 'C7') });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'trombone' });
    // C7 written is well outside trombone's playable range — no fingering.
    expect(fingeringsFor('trombone', undefined, toMidi(fing(s.items[0]).pitch))).toEqual([]);
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('C7');
  });
  it('clear empties the board without touching meta', () => {
    const s = boardReducer(withCards('a', 'b'), { type: 'clear' });
    expect(s.items).toEqual([]);
    expect(s.meta.instrument).toBe('saxophone');
  });
});

describe('boardReducer with text cards', () => {
  const textCard = (id: string) => ({ id, ...newTextCardDraft() });
  const mixed = () => {
    let s = boardReducer(createBoard('saxophone'), { type: 'setMeta', patch: { horn: 'alto' } });
    s = boardReducer(s, { type: 'add', card: card('a', 'C5') });
    s = boardReducer(s, { type: 'add', card: textCard('t') });
    s = boardReducer(s, { type: 'add', card: card('b', 'D5') });
    return s;
  };

  it('adds, updates, duplicates, removes and reorders a text card among fingering cards', () => {
    let s = mixed();
    expect(s.items.map((c) => c.id)).toEqual(['a', 't', 'b']);
    expect(s.items.filter(isTextCard)).toHaveLength(1);

    s = boardReducer(s, { type: 'update', id: 't', patch: { text: { heading: { text: 'Warm-ups' } } } });
    expect((s.items[1] as TextCard).text?.heading?.text).toBe('Warm-ups');

    s = boardReducer(s, { type: 'duplicate', id: 't', newId: 't2' });
    expect(s.items.map((c) => c.id)).toEqual(['a', 't', 't2', 'b']);
    expect(isTextCard(s.items[2])).toBe(true);
    expect((s.items[2] as TextCard).text?.heading?.text).toBe('Warm-ups');

    // Insertion index 0: the text card lands in the gap before every card.
    s = boardReducer(s, { type: 'reorder', fromId: 't', toIndex: 0 });
    expect(s.items.map((c) => c.id)).toEqual(['t', 'a', 't2', 'b']);

    s = boardReducer(s, { type: 'remove', id: 't2' });
    expect(s.items.map((c) => c.id)).toEqual(['t', 'a', 'b']);
  });

  it('setInstrument remaps fingering cards and leaves a text card untouched', () => {
    let s = mixed();
    const before = s.items[1];
    s = boardReducer(s, { type: 'setInstrument', instrument: 'flute' });
    expect(formatPitch(fing(s.items[0]).pitch)).toBe('D♯4');
    // Same object identity: the text card is not rebuilt, let alone repitched.
    expect(s.items[1]).toBe(before);
    expect('pitch' in s.items[1]).toBe(false);
  });

  it('routes an added card through the icon/picture exclusion', () => {
    const s = boardReducer(createBoard(), {
      type: 'add',
      card: { id: 't', kind: 'text', scale: 1, icon: 'obj:metronome', image: 'data:image/png;base64,AAAA' },
    });
    expect((s.items[0] as TextCard).image).toBeUndefined();
    expect((s.items[0] as TextCard).icon).toBe('obj:metronome');
  });
});

describe('boardReducer — duplicate and the picture budget', () => {
  // 500 KB: one is accepted by the editor with the board well under budget.
  const HALF_MEG = `data:image/png;base64,${'A'.repeat(500 * 1024 - 22)}`;
  const withPicture = () =>
    boardReducer(createBoard(), { type: 'add', card: { id: 't', ...newTextCardDraft('Warm-ups'), image: HALF_MEG } });
  const copy = (s: BoardState, newId: string) => boardReducer(s, { type: 'duplicate', id: 't', newId });

  it('copies the picture while the board has room', () => {
    let s = withPicture();
    s = copy(s, 't2');
    expect((s.items[1] as TextCard).image).toBe(HALF_MEG);
    s = copy(s, 't3');
    expect((s.items[1] as TextCard).image).toBe(HALF_MEG);
    expect(boardImageChars(s.items)).toBe(3 * (500 * 1024));
  });

  it('copies the card WITHOUT its picture rather than blowing the budget', () => {
    let s = withPicture();
    s = copy(s, 't2');
    s = copy(s, 't3');
    s = copy(s, 't4');
    // Four cards on the board; the fourth picture would have reached 2,048,000
    // chars against a 1,572,864 budget.
    expect(s.items).toHaveLength(4);
    expect(boardImageChars(s.items)).toBeLessThanOrEqual(IMAGE_BUDGET_CHARS);
    const newest = s.items[1] as TextCard;
    expect(newest.id).toBe('t4');
    expect(newest.image).toBeUndefined();
    // The text is still worth copying — that is the whole point of not refusing.
    expect(newest.text?.heading?.text).toBe('Warm-ups');
  });

  it('duplicateDropsImage tells the UI what the reducer is about to do', () => {
    let s = withPicture();
    expect(duplicateDropsImage(s, 't')).toBe(false);
    s = copy(s, 't2');
    s = copy(s, 't3');
    expect(duplicateDropsImage(s, 't')).toBe(true);
    // A card with no picture, and an id that is not on the board, never warn.
    expect(duplicateDropsImage(s, 'nope')).toBe(false);
    const plain = boardReducer(s, { type: 'add', card: { id: 'n', ...newTextCardDraft() } });
    expect(duplicateDropsImage(plain, 'n')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { boardReducer } from './boardReducer';
import { createBoard, newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';

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
  it('setInstrument clears cards and resets style variants', () => {
    let s = withCards('a');
    s = boardReducer(s, { type: 'setMeta', patch: { style: { ...s.meta.style, variants: ['palm-bean'] } } });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    expect(s.items).toEqual([]);
    expect(s.meta.instrument).toBe('clarinet');
    expect(s.meta.horn).toBeUndefined();
    expect(s.meta.style.variants).toEqual([]);
  });
});

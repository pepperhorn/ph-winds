import { describe, it, expect } from 'vitest';
import { NO_SELECTION, selectedCardId, selectionReducer } from './selection';
import { newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';
import type { BuilderDraft } from '@/components/Builder';

const draftOf = (note = 'C5', editingId?: string): BuilderDraft => ({ ...newCardDraft(parsePitch(note)), editingId });
const onText = (id = 't') => selectionReducer(NO_SELECTION, { type: 'text', id });

describe('selection', () => {
  it('a text card selection clears whatever the builder was holding', () => {
    const s = selectionReducer({ draft: draftOf('C5', 'a'), textEditId: null }, { type: 'text', id: 't' });
    expect(s.draft).toBeNull();
    expect(s.textEditId).toBe('t');
  });

  it('a new builder draft clears the text card selection', () => {
    // The reported bug: "+ Add text card" then a piano key left BOTH editors
    // open, with the selection ring still on the text card.
    const s = selectionReducer(onText('t'), { type: 'draft', draft: draftOf('C5') });
    expect(s.textEditId).toBeNull();
    expect(s.draft?.editingId).toBeUndefined();
  });

  it('clears it from the functional form too — the piano-key path', () => {
    const s = selectionReducer(onText('t'), {
      type: 'draft',
      draft: (d) => (d ? { ...d, pitch: parsePitch('D5') } : draftOf('D5')),
    });
    expect(s.textEditId).toBeNull();
    expect(s.draft).not.toBeNull();
  });

  it('the board ring never points at a card the open editor is not editing', () => {
    // A fresh draft is not editing any board card, so nothing is ringed —
    // rather than falling through to a stale text card id.
    expect(selectedCardId(selectionReducer(onText('t'), { type: 'draft', draft: draftOf('C5') }))).toBeUndefined();
    expect(selectedCardId(onText('t'))).toBe('t');
    expect(selectedCardId({ draft: draftOf('C5', 'a'), textEditId: null })).toBe('a');
    expect(selectedCardId(NO_SELECTION)).toBeUndefined();
  });

  it('a null draft leaves a text selection alone, and "none" clears both', () => {
    const t = onText('t');
    expect(selectionReducer(t, { type: 'draft', draft: null })).toBe(t);
    expect(selectionReducer(t, { type: 'none' })).toEqual(NO_SELECTION);
    expect(selectionReducer({ draft: draftOf(), textEditId: null }, { type: 'none' })).toEqual(NO_SELECTION);
  });

  it('returns the same object when nothing changed, so React can skip the render', () => {
    const s = { draft: draftOf('C5', 'a'), textEditId: null };
    expect(selectionReducer(s, { type: 'draft', draft: (d) => d })).toBe(s);
    expect(selectionReducer(NO_SELECTION, { type: 'none' })).toBe(NO_SELECTION);
  });
});

import type { BoardMeta, BoardState, CardItem, CardPatch } from './types';
import { isTextCard } from './types';
import { getInstrument, semitones, spellWritten } from '@/music/instruments';
import { toMidi } from '@/music/pitch';
import { DEFAULT_STYLE } from './defaults';
import { applyCardPatch, exceedsImageBudget } from './textCards';

/**
 * Will duplicating this card have to leave its picture behind? Asked by the
 * host so it can tell the user, and by nobody else — the reducer enforces the
 * budget whether or not anyone asked. Both read the same predicate, so the
 * warning and the behaviour cannot drift apart.
 */
export function duplicateDropsImage(s: BoardState, id: string): boolean {
  const c = s.items.find((x) => x.id === id);
  return !!c && isTextCard(c) && !!c.image && exceedsImageBudget(s.items, c.image);
}

export type BoardAction =
  | { type: 'setMeta'; patch: Partial<BoardMeta> }
  | { type: 'setInstrument'; instrument: string; horn?: string }
  | { type: 'add'; card: CardItem }
  | { type: 'update'; id: string; patch: CardPatch }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'reorder'; fromId: string; toIndex: number }
  | { type: 'clear' }
  | { type: 'replace'; state: BoardState };

export function boardReducer(s: BoardState, a: BoardAction): BoardState {
  switch (a.type) {
    case 'setMeta': return { ...s, meta: { ...s.meta, ...a.patch } };
    case 'setInstrument': {
      const info = getInstrument(a.instrument);
      const horn = a.horn ?? info.defaultHorn;
      const oldSemis = semitones(s.meta.instrument, s.meta.horn);
      const newSemis = semitones(a.instrument, horn);
      const items = s.items.map((c) => {
        // A text card has no pitch to remap — it rides along untouched.
        if (isTextCard(c)) return c;
        const newWrittenMidi = toMidi(c.pitch) + oldSemis - newSemis;
        return { ...c, pitch: spellWritten(a.instrument, horn, newWrittenMidi), fingeringIndex: 0 };
      });
      // Variant names are layout-scoped: only reset them on a true instrument
      // change (e.g. saxophone -> flute). A horn-only switch on the same
      // instrument (e.g. alto -> tenor sax) must keep the user's variants.
      const variants = a.instrument !== s.meta.instrument ? DEFAULT_STYLE.variants : s.meta.style.variants;
      return { ...s, items, meta: { ...s.meta, instrument: a.instrument, horn, style: { ...s.meta.style, variants } } };
    }
    case 'add': return { ...s, items: [...s.items, applyCardPatch(a.card)] };
    case 'update': return { ...s, items: s.items.map((c) => (c.id === a.id ? applyCardPatch(c, a.patch) : c)) };
    case 'remove': return { ...s, items: s.items.filter((c) => c.id !== a.id) };
    case 'duplicate': {
      const i = s.items.findIndex((c) => c.id === a.id);
      if (i < 0) return s;
      const copy = { ...structuredClone(s.items[i]), id: a.newId };
      // Copy is the other way a board's picture data grows, and it used to be
      // unaccounted: `pickImage` refuses an upload that would not fit, then
      // three presses of Copy put four times that picture in state anyway,
      // `localStorage` throws quota, and the board is lost on reload — after
      // the UI had said yes to every step.
      //
      // Duplicating drops the PICTURE, not the card: the heading, subtitle,
      // footer, scale and position are the work worth copying, and a refused
      // Copy leaves the user with nothing and no idea why. The host asks
      // `duplicateDropsImage` first so it can say what happened; the rule
      // lives here so a path that forgets to ask still cannot overfill.
      if (isTextCard(copy) && copy.image && exceedsImageBudget(s.items, copy.image)) copy.image = undefined;
      const items = [...s.items];
      items.splice(i + 1, 0, copy);
      return { ...s, items };
    }
    case 'reorder': {
      // `toIndex` is an INSERTION index in 0..items.length inclusive — the gap
      // the card lands in, not the index of a neighbouring card. That makes a
      // drop position direction-independent, which the drop indicator relies
      // on: the line the user sees is exactly the gap the card ends up in.
      const from = s.items.findIndex((c) => c.id === a.fromId);
      if (from < 0) return s;
      const toIndex = Math.max(0, Math.min(s.items.length, a.toIndex));
      // Inserting immediately before or after itself leaves the order alone;
      // return the same state object so React skips the re-render.
      if (toIndex === from || toIndex === from + 1) return s;
      const items = [...s.items];
      const [moved] = items.splice(from, 1);
      // The removal above shifts everything after `from` down by one, so a
      // forward insertion point has to come down with it.
      items.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
      return { ...s, items };
    }
    case 'clear': return { ...s, items: [] };
    case 'replace': return a.state;
  }
}

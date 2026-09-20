import type { BoardMeta, BoardState, CardDraft, CardItem } from './types';
import { getInstrument } from '@/music/instruments';
import { DEFAULT_STYLE } from './defaults';

export type BoardAction =
  | { type: 'setMeta'; patch: Partial<BoardMeta> }
  | { type: 'setInstrument'; instrument: string; horn?: string }
  | { type: 'add'; card: CardItem }
  | { type: 'update'; id: string; patch: Partial<CardDraft> }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'reorder'; fromId: string; toId: string }
  | { type: 'clear' }
  | { type: 'replace'; state: BoardState };

export function boardReducer(s: BoardState, a: BoardAction): BoardState {
  switch (a.type) {
    case 'setMeta': return { ...s, meta: { ...s.meta, ...a.patch } };
    case 'setInstrument': {
      const info = getInstrument(a.instrument);
      return { ...s, items: [], meta: { ...s.meta, instrument: a.instrument, horn: a.horn ?? info.defaultHorn, style: { ...s.meta.style, variants: DEFAULT_STYLE.variants } } };
    }
    case 'add': return { ...s, items: [...s.items, a.card] };
    case 'update': return { ...s, items: s.items.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
    case 'remove': return { ...s, items: s.items.filter((c) => c.id !== a.id) };
    case 'duplicate': {
      const i = s.items.findIndex((c) => c.id === a.id);
      if (i < 0) return s;
      const items = [...s.items];
      items.splice(i + 1, 0, { ...structuredClone(s.items[i]), id: a.newId });
      return { ...s, items };
    }
    case 'reorder': {
      const from = s.items.findIndex((c) => c.id === a.fromId);
      const to = s.items.findIndex((c) => c.id === a.toId);
      if (from < 0 || to < 0 || from === to) return s;
      const items = [...s.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...s, items };
    }
    case 'clear': return { ...s, items: [] };
    case 'replace': return a.state;
  }
}

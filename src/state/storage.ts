import type { BoardState } from './types';
import { parseBoard } from './io';

export interface StorageAdapter { load(): BoardState | null; save(s: BoardState): void }

export function localStorageAdapter(key = 'ph-winds-board', opts: { onError?: (e: unknown) => void } = {}): StorageAdapter {
  return {
    load() {
      let raw: string | null;
      try { raw = localStorage.getItem(key); } catch { return null; }
      if (!raw) return null;
      try {
        const r = parseBoard(JSON.parse(raw));
        if (r.ok) return r.state;
      } catch { /* fall through to backup */ }
      try { localStorage.setItem(`${key}-backup`, raw); } catch { /* ignore quota errors on backup */ }
      return null;
    },
    save(s) {
      try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { opts.onError?.(e); }
    },
  };
}

export function memoryStorageAdapter(initial: BoardState | null = null): StorageAdapter {
  let v = initial;
  return { load: () => v, save: (s) => { v = s; } };
}

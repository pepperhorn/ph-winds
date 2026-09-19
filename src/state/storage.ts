import type { BoardState } from './types';
import { parseBoard } from './io';

export interface StorageAdapter { load(): BoardState | null; save(s: BoardState): void }

export function localStorageAdapter(key = 'ph-winds-board', opts: { onError?: (e: unknown) => void } = {}): StorageAdapter {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const r = parseBoard(JSON.parse(raw));
        return r.ok ? r.state : null;
      } catch { return null; }
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

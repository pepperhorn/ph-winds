import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { boardReducer, type BoardAction } from './boardReducer';
import { createBoard } from './defaults';
import { localStorageAdapter, type StorageAdapter } from './storage';
import type { BoardMeta, BoardState, CardDraft, CardPatch, TextCardDraft } from './types';
import { newTextCardDraft } from './textCards';

const uid = () => crypto.randomUUID();

export function useWindBoard({ storage }: { storage?: StorageAdapter } = {}) {
  const store = useMemo(() => storage ?? localStorageAdapter(), [storage]);
  const [state, dispatch] = useReducer(boardReducer, undefined, () => store.load() ?? createBoard());
  useEffect(() => { store.save(state); }, [store, state]);

  const addCard = useCallback((d: CardDraft | TextCardDraft) => { const id = uid(); dispatch({ type: 'add', card: { ...d, id } }); return id; }, []);
  return {
    state,
    dispatch: dispatch as (a: BoardAction) => void,
    addCard,
    addTextCard: useCallback(() => { const id = uid(); dispatch({ type: 'add', card: { ...newTextCardDraft(), id } }); return id; }, []),
    updateCard: useCallback((id: string, patch: CardPatch) => dispatch({ type: 'update', id, patch }), []),
    removeCard: useCallback((id: string) => dispatch({ type: 'remove', id }), []),
    duplicateCard: useCallback((id: string) => dispatch({ type: 'duplicate', id, newId: uid() }), []),
    reorder: useCallback((fromId: string, toIndex: number) => dispatch({ type: 'reorder', fromId, toIndex }), []),
    setMeta: useCallback((patch: Partial<BoardMeta>) => dispatch({ type: 'setMeta', patch }), []),
    setInstrument: useCallback((instrument: string, horn?: string) => dispatch({ type: 'setInstrument', instrument, horn }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), []),
    replaceState: useCallback((s: BoardState) => dispatch({ type: 'replace', state: s }), []),
  };
}

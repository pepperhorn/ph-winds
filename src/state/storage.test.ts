import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localStorageAdapter, memoryStorageAdapter } from './storage';
import { createBoard } from './defaults';

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  it('round trips through localStorage', () => {
    const a = localStorageAdapter('t');
    expect(a.load()).toBeNull();
    a.save(createBoard('flute'));
    expect(a.load()?.meta.instrument).toBe('flute');
  });
  it('ignores corrupt data', () => {
    localStorage.setItem('t', '{nope');
    expect(localStorageAdapter('t').load()).toBeNull();
  });
  it('backs up corrupt (unparsable) data before returning null', () => {
    localStorage.setItem('t', '{nope');
    expect(localStorageAdapter('t').load()).toBeNull();
    expect(localStorage.getItem('t-backup')).toBe('{nope');
  });
  it('backs up data that parses but fails board validation before returning null', () => {
    const raw = JSON.stringify({ version: 2 });
    localStorage.setItem('t', raw);
    expect(localStorageAdapter('t').load()).toBeNull();
    expect(localStorage.getItem('t-backup')).toBe(raw);
  });
  it('reports quota errors without throwing', () => {
    const onError = vi.fn();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => localStorageAdapter('t', { onError }).save(createBoard())).not.toThrow();
    expect(onError).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('memory adapter', () => {
    const m = memoryStorageAdapter();
    m.save(createBoard('recorder'));
    expect(m.load()?.meta.instrument).toBe('recorder');
  });
});

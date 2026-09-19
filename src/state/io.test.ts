import { describe, it, expect } from 'vitest';
import { exportBoardJson, importBoardJson } from './io';
import { createBoard, newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';

describe('io', () => {
  it('round trips', () => {
    const s = createBoard('trumpet');
    s.items.push({ id: 'x', ...newCardDraft(parsePitch('G4')) });
    const r = importBoardJson(exportBoardJson(s));
    expect(r.ok && r.state).toEqual(s);
  });
  it('rejects bad json, wrong version, unknown instrument, bad card', () => {
    expect(importBoardJson('nope').ok).toBe(false);
    expect(importBoardJson(JSON.stringify({ ...createBoard(), version: 2 })).ok).toBe(false);
    const bad = createBoard(); (bad.meta as any).instrument = 'kazoo';
    expect(importBoardJson(JSON.stringify(bad)).ok).toBe(false);
    const bad2 = createBoard(); (bad2.items as any).push({ id: 'y', pitch: { step: 'H', alter: 0, octave: 4 } });
    const r = importBoardJson(JSON.stringify(bad2));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/card 1/);
  });
  it('fills missing optional meta from defaults', () => {
    const s = createBoard('flute') as any; delete s.meta.style; delete s.meta.diagramOrient;
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok && r.state.meta.style.look).toBe('solid');
    expect(r.ok && r.state.meta.diagramOrient).toBe('vertical');
  });
});

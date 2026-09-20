import { describe, it, expect } from 'vitest';
import { exportBoardJson, importBoardJson } from './io';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { parsePitch } from '@/music/pitch';
import { rangeBands } from '@/music/instruments';
import { resolveStyle } from './resolve';

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

  it('falls back to the instrument default horn when meta.horn is invalid', () => {
    const s = createBoard('tin-whistle') as any;
    s.meta.horn = 'X';
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.meta.horn).toBe('D');
    expect(r.ok && (() => rangeBands('tin-whistle', r.state.meta.horn))).not.toThrow;
    if (r.ok) expect(() => rangeBands('tin-whistle', r.state.meta.horn)).not.toThrow();
  });

  it.each(['nope', 5, 0])('falls back to auto columns for invalid value %s', (bad) => {
    const s = createBoard('flute') as any;
    s.meta.columns = bad;
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.meta.columns).toBe('auto');
  });

  it('drops a non-object card style override without rejecting the board', () => {
    const s = createBoard('flute') as any;
    s.items.push({ id: 'x', ...newCardDraft(parsePitch('G4')), style: 'garbage' });
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.items[0].style).toBeUndefined();
  });

  it('drops invalid sub-fields from a card style override but keeps valid ones', () => {
    const s = createBoard('flute') as any;
    s.items.push({ id: 'x', ...newCardDraft(parsePitch('G4')), style: { look: 'nonsense', primary: '#ff0000' } });
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    const item = r.ok ? r.state.items[0] : undefined;
    expect(item?.style?.primary).toBe('#ff0000');
    expect(item?.style && 'look' in item.style).toBe(false);
    if (r.ok) expect(resolveStyle(item!, r.state.meta).look).toBe(DEFAULT_STYLE.look);
  });

  it('falls back to default pitchMode when invalid', () => {
    const s = createBoard('flute') as any;
    s.meta.pitchMode = 'nonsense';
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok && r.state.meta.pitchMode).toBe('written');
  });

  it('falls back to default musicFont when invalid', () => {
    const s = createBoard('flute') as any;
    s.meta.musicFont = 'nonsense';
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok && r.state.meta.musicFont).toBe('bravura');
  });

  it('falls back to default diagramOrient when invalid', () => {
    const s = createBoard('flute') as any;
    s.meta.diagramOrient = 'nonsense';
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok && r.state.meta.diagramOrient).toBe('vertical');
  });

  it('drops invalid style.variants entries but keeps valid ones', () => {
    const s = createBoard('saxophone') as any;
    s.meta.style = { ...s.meta.style, variants: ['palm-teardrop', 'not-a-real-variant'] };
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.meta.style.variants).toEqual(['palm-teardrop']);
  });

  it('replaces only the bad sub-field of a TextField, keeping other valid sub-fields', () => {
    const s = createBoard('flute') as any;
    s.meta.title = { ...s.meta.title, text: 'My Custom Title', size: 'XL' };
    s.meta.cardText.heading = { ...s.meta.cardText.heading, text: 'Heading Text', size: 'XL' };
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.meta.title.text).toBe('My Custom Title');
    expect(r.ok && r.state.meta.title.size).toBe('L');
    expect(r.ok && r.state.meta.cardText.heading.text).toBe('Heading Text');
    expect(r.ok && r.state.meta.cardText.heading.size).toBe('M');
  });
});

import { describe, it, expect } from 'vitest';
import { exportBoardJson, importBoardJson, parseIcon, parseImage, parseKind } from './io';
import { IMAGE_BUDGET_CHARS } from './textCards';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { parsePitch } from '@/music/pitch';
import { rangeBands } from '@/music/instruments';
import { resolveStyle } from './resolve';
import type { CardItem, FingeringCard, TextCard } from './types';
import { isTextCard } from './types';

/** `CardItem` is a union now, so a reader has to narrow. */
const fing = (c: CardItem) => c as FingeringCard;

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
    expect(r.ok && fing(r.state.items[0]).style).toBeUndefined();
  });

  it('drops invalid sub-fields from a card style override but keeps valid ones', () => {
    const s = createBoard('flute') as any;
    s.items.push({ id: 'x', ...newCardDraft(parsePitch('G4')), style: { look: 'nonsense', primary: '#ff0000' } });
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok).toBe(true);
    const item = r.ok ? fing(r.state.items[0]) : undefined;
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

describe('io — text cards', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  const boardWith = (...cards: any[]) => {
    const s = createBoard('flute') as any;
    s.items.push(...cards);
    return s;
  };

  it('round trips a mixed board of fingering and text cards', () => {
    const s = createBoard('trumpet');
    s.items.push(
      { id: 'x', ...newCardDraft(parsePitch('G4')) },
      { id: 't', kind: 'text', scale: 1.2, text: { heading: { text: 'Warm-ups', size: 'L' } }, icon: 'music:trebleClef' },
      { id: 'p', kind: 'text', scale: 1, image: PNG },
    );
    const r = importBoardJson(exportBoardJson(s));
    expect(r.ok && r.state).toEqual(s);
  });

  it('a card with no kind loads as a fingering card — no migration needed', () => {
    const r = importBoardJson(JSON.stringify(boardWith({ id: 'x', ...newCardDraft(parsePitch('G4')) })));
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.items[0].kind).toBeUndefined();
    expect(r.ok && isTextCard(r.state.items[0])).toBe(false);
  });

  it('an unknown kind degrades to fingering — and then still needs a pitch', () => {
    const ok = importBoardJson(JSON.stringify(boardWith({ ...newCardDraft(parsePitch('G4')), id: 'x', kind: 'sparkle' })));
    expect(ok.ok).toBe(true);
    expect(ok.ok && isTextCard(ok.state.items[0])).toBe(false);

    const bad = importBoardJson(JSON.stringify(boardWith({ id: 'x', kind: 'sparkle', scale: 1 })));
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toContain('bad pitch');
  });

  it('a fingering card without a valid pitch stays fatal; a text card needs none', () => {
    expect(importBoardJson(JSON.stringify(boardWith({ id: 'x', scale: 1 }))).ok).toBe(false);
    expect(importBoardJson(JSON.stringify(boardWith({ id: 't', kind: 'text', scale: 1 }))).ok).toBe(true);
  });

  it('parseKind only lets known kinds through', () => {
    expect(parseKind('text')).toBe('text');
    expect(parseKind('fingering')).toBe('fingering');
    expect(parseKind(undefined)).toBe('fingering');
    for (const junk of ['Text', 'chord', '', 0, null, {}, ['text']]) expect(parseKind(junk)).toBe('fingering');
  });

  it('parseIcon takes an id with a known prefix, and nothing else', () => {
    expect(parseIcon('music:trebleClef')).toBe('music:trebleClef');
    expect(parseIcon('obj:star')).toBe('obj:star');
    // Forward compatible: a well-prefixed id this build does not ship survives
    // and simply renders as nothing.
    expect(parseIcon('music:notYetDrawn')).toBe('music:notYetDrawn');
    // A bare label, a junk prefix, a path, a glyph, a non-string.
    expect(parseIcon('Treble clef')).toBeUndefined();
    expect(parseIcon('evil:trebleClef')).toBeUndefined();
    expect(parseIcon('/icons/treble.svg')).toBeUndefined();
    expect(parseIcon('𝄞')).toBeUndefined();
    expect(parseIcon(' music:trebleClef')).toBeUndefined();
    expect(parseIcon(42)).toBeUndefined();
    expect(parseIcon(null)).toBeUndefined();
  });

  it('parseImage is a security boundary: only an inline data:image/ URI passes', () => {
    expect(parseImage(PNG)).toBe(PNG);
    expect(parseImage('data:image/jpeg;base64,/9j/4AA')).toBe('data:image/jpeg;base64,/9j/4AA');
    expect(parseImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');

    expect(parseImage('javascript:alert(1)')).toBeUndefined();
    expect(parseImage('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(parseImage('https://evil/x.png')).toBeUndefined();
    expect(parseImage('//evil/x.png')).toBeUndefined();
    expect(parseImage('DATA:IMAGE/PNG;base64,AAAA')).toBeUndefined();
    // Leading whitespace: browsers strip it from a URL attribute, so a
    // trim-then-check would admit " javascript:...". Never trim.
    expect(parseImage(' data:image/png;base64,AAAA')).toBeUndefined();
    expect(parseImage('\n\tdata:image/png;base64,AAAA')).toBeUndefined();
    expect(parseImage(' javascript:alert(1)')).toBeUndefined();
    expect(parseImage(`data:image/png;base64,${'A'.repeat(IMAGE_BUDGET_CHARS)}`)).toBeUndefined();
    expect(parseImage(42)).toBeUndefined();
    expect(parseImage(null)).toBeUndefined();
  });

  it('strips a hostile icon and picture off an imported text card without failing the board', () => {
    const r = importBoardJson(JSON.stringify(boardWith({
      id: 't', kind: 'text', scale: 1, icon: 'Treble clef', image: 'javascript:alert(1)',
    })));
    expect(r.ok).toBe(true);
    const c = r.ok ? (r.state.items[0] as TextCard) : undefined;
    expect(c?.icon).toBeUndefined();
    expect(c?.image).toBeUndefined();
  });

  it('an imported text card carrying both icon and picture keeps only the icon', () => {
    const r = importBoardJson(JSON.stringify(boardWith({ id: 't', kind: 'text', scale: 1, icon: 'obj:star', image: PNG })));
    expect(r.ok).toBe(true);
    const c = r.ok ? (r.state.items[0] as TextCard) : undefined;
    expect(c?.icon).toBe('obj:star');
    expect(c?.image).toBeUndefined();
  });

  it('drops invalid text sub-fields on a text card', () => {
    const r = importBoardJson(JSON.stringify(boardWith({
      id: 't', kind: 'text', scale: 1, text: { heading: { text: 'Hi', size: 'XXL', align: 'justify' }, footer: 7 },
    })));
    expect(r.ok).toBe(true);
    const c = r.ok ? (r.state.items[0] as TextCard) : undefined;
    expect(c?.text?.heading).toEqual({ text: 'Hi' });
    // A non-object slot is dropped whole, as on a fingering card.
    expect(c?.text?.footer).toBeUndefined();
  });
});

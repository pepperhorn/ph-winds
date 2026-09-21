import { describe, it, expect } from 'vitest';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { applyWildcards, autoSubtitle, resolveCardText, resolveStyle } from './resolve';
import { parsePitch } from '@/music/pitch';
import { useRegisters } from '@/test/registers';

const alto = () => ({ ...createBoard('saxophone'), meta: { ...createBoard('saxophone').meta, horn: 'alto' } });

// Fixture bands (C4 -> "Mid", D5 -> "Top"), so what follows pins wildcard
// *substitution* and not the library's current register boundaries, which it
// is re-anchoring. How bands themselves are read is `registers.test.ts`.
useRegisters('saxophone');
useRegisters('flute');

describe('resolve', () => {
  it('auto subtitle', () => {
    expect(autoSubtitle(parsePitch('C5'), -9)).toBe('Concert Pitch: E♭4 / D♯4');
    expect(autoSubtitle(parsePitch('C5'), 0)).toBe('');
    expect(autoSubtitle(parsePitch('G#4'), -2)).toBe('Concert Pitch: G♭4 / F♯4');
  });
  it('written accidental gets both spellings flat-first; a natural sounding pitch does not', () => {
    // alto sax (-9): written C♯5 sounds E4 (natural).
    expect(applyWildcards('{transposedPitch}', parsePitch('C#5'), alto().meta)).toBe('D♭5 / C♯5');
    expect(autoSubtitle(parsePitch('C#5'), -9)).toBe('Concert Pitch: E4');
  });
  it('card text falls back to board defaults then the wildcard templates', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5') }, b.meta);
    expect(t.heading.text).toBe('Mid C');
    expect(t.subtitle.text).toBe('Concert Pitch: E♭4 / D♯4');
    expect(t.subtitle.show).toBe(true);
    expect(t.footer.show).toBe(false);
  });
  it('card override wins field by field', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5'), text: { heading: { text: 'Fixed heading', size: 'L' } } }, b.meta);
    expect(t.heading).toMatchObject({ text: 'Fixed heading', size: 'L', align: 'center', show: true });
  });
  it('subtitle hides itself on non-transposing instruments when empty', () => {
    const b = createBoard('flute');
    expect(resolveCardText({ pitch: parsePitch('C5') }, b.meta).subtitle.show).toBe(false);
  });
  it('style merges', () => {
    const b = alto();
    expect(resolveStyle({}, b.meta)).toEqual(DEFAULT_STYLE);
    expect(resolveStyle({ style: { primary: '#ff0000' } }, b.meta).primary).toBe('#ff0000');
  });
  it('new card draft defaults', () => {
    expect(newCardDraft(parsePitch('D4'))).toMatchObject({ fingeringIndex: 0, display: 'both', orientation: 'vertical', scale: 1 });
  });
});

describe('wildcards', () => {
  const altoMeta = () => alto().meta;

  it('resolves all three tokens against the card pitch', () => {
    const m = altoMeta();
    const p = parsePitch('G5');
    expect(applyWildcards('{noteName}', p, m)).toBe('Top G');
    expect(applyWildcards('{transposedPitch}', p, m)).toBe('G5');
    // `{concertPitch}` is formatPitchPair of the sounding pitch, so a black
    // key comes back as the flat-first enharmonic pair, as elsewhere.
    expect(applyWildcards('{concertPitch}', p, m)).toBe('B♭4 / A♯4');
  });
  it('replaces every occurrence, and several tokens in one string', () => {
    const m = altoMeta();
    const p = parsePitch('G5');
    expect(applyWildcards('{noteName} — {transposedPitch} sounds {concertPitch} ({transposedPitch})', p, m))
      .toBe('Top G — G5 sounds B♭4 / A♯4 (G5)');
  });
  it('leaves an unknown token as literal text', () => {
    const m = altoMeta();
    expect(applyWildcards('{bogus}', parsePitch('G5'), m)).toBe('{bogus}');
    // Token matching is case-sensitive.
    expect(applyWildcards('{NoteName} {notename}', parsePitch('G5'), m)).toBe('{NoteName} {notename}');
    expect(applyWildcards('{noteName} {bogus}', parsePitch('G5'), m)).toBe('Top G {bogus}');
    expect(applyWildcards('plain text', parsePitch('G5'), m)).toBe('plain text');
  });
  it('resolves {concertPitch} to the written pitch on a non-transposing instrument, never to empty', () => {
    const m = createBoard('flute').meta;
    const p = parsePitch('G5');
    expect(applyWildcards('{concertPitch}', p, m)).toBe('G5');
    expect(applyWildcards('{transposedPitch}', p, m)).toBe('G5');
    expect(applyWildcards('{noteName}', p, m)).toBe('Top G');   // flute's own bands
  });
  it('substitutes in board-level card defaults', () => {
    const b = alto();
    b.meta.cardText.footer = { ...b.meta.cardText.footer, show: true, text: '{noteName} on the {transposedPitch}' };
    const t = resolveCardText({ pitch: parsePitch('G5') }, b.meta);
    expect(t.footer.text).toBe('Top G on the G5');
    expect(t.footer.show).toBe(true);
  });
  it('a per-card override still beats the board default, and is substituted too', () => {
    const b = alto();
    b.meta.cardText.heading = { ...b.meta.cardText.heading, text: 'board {noteName}' };
    const card = { pitch: parsePitch('G5'), text: { heading: { text: 'card {noteName} ({concertPitch})' } } };
    expect(resolveCardText(card, b.meta).heading.text).toBe('card Top G (B♭4 / A♯4)');
    // …and a plain override with no wildcards is untouched.
    expect(resolveCardText({ pitch: parsePitch('G5'), text: { heading: { text: 'My note' } } }, b.meta).heading.text)
      .toBe('My note');
  });
  it('does not substitute in the board title, subtitle or footer', () => {
    // The board chrome is rendered straight from `meta`, never through
    // `resolveCardText` — a wildcard typed there stays literal.
    const b = alto();
    b.meta.title = { ...b.meta.title, text: '{noteName}' };
    b.meta.subtitle = { ...b.meta.subtitle, text: '{concertPitch}' };
    b.meta.footer = { ...b.meta.footer, text: '{transposedPitch}' };
    const t = resolveCardText({ pitch: parsePitch('G5') }, b.meta);
    expect(b.meta.title.text).toBe('{noteName}');
    expect(b.meta.subtitle.text).toBe('{concertPitch}');
    expect(b.meta.footer.text).toBe('{transposedPitch}');
    // …and the card's own text is unaffected by them.
    expect(t.heading.text).toBe('Top G');
  });
});

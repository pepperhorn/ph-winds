import { describe, it, expect } from 'vitest';
import { listInstruments, getInstrument, semitones, fingeringSheet, fingeringsFor, playableMidis, spellWritten, rangeBands } from './instruments';

describe('instruments', () => {
  it('lists all nine with horns', () => {
    const ids = listInstruments().map((i) => i.id);
    expect(ids).toEqual(['saxophone', 'clarinet', 'flute', 'recorder', 'tin-whistle', 'trumpet', 'trombone', 'nuvo-dood', 'nuvo-toot']);
    expect(getInstrument('saxophone').horns.map((h) => h.id)).toEqual(['soprano', 'alto', 'tenor', 'baritone']);
    expect(getInstrument('saxophone').defaultHorn).toBe('alto');
    expect(getInstrument('trombone').clef).toBe('F');
    expect(getInstrument('flute').clef).toBe('G');
  });
  it('semitones by horn', () => {
    expect(semitones('saxophone', 'tenor')).toBe(-14);
    expect(semitones('saxophone')).toBe(-9);
    expect(semitones('recorder')).toBe(12);
    expect(semitones('clarinet')).toBe(-2);
  });
  it('merges sax altissimo', () => {
    const s = fingeringSheet('saxophone', 'alto');
    expect(s[0]).toMatchObject({ note: 'Bb', octave: 3 });
    expect(s.at(-1)).toMatchObject({ note: 'F', octave: 7 });
  });
  it('picks the tin whistle sheet by horn', () => {
    expect(fingeringSheet('tin-whistle', 'C')[0]).toMatchObject({ note: 'C', octave: 5 });
    expect(fingeringSheet('tin-whistle', 'D')[0]).toMatchObject({ note: 'D', octave: 5 });
  });
  it('expands alternates after the primary', () => {
    // clarinet written E3 has one alternate
    const fs = fingeringsFor('clarinet', undefined, 52);
    expect(fs.length).toBe(2);
    expect(fs[1]).toMatchObject({ note: 'E', octave: 3, note_text: 'Alt 1' });
    expect(fs[1].alternates).toBeUndefined();
  });
  it('returns [] when no fingering', () => {
    expect(fingeringsFor('flute', undefined, 40)).toEqual([]);
  });
  it('playable set and spelling', () => {
    expect(playableMidis('saxophone', 'alto').has(58)).toBe(true);
    expect(spellWritten('saxophone', 'alto', 58)).toEqual({ step: 'B', alter: -1, octave: 3 });
    // no fingering → falls back to flats for a B♭ instrument
    expect(spellWritten('clarinet', undefined, 30)).toEqual({ step: 'G', alter: -1, octave: 1 });
  });
  it('range bands nest (written midi)', () => {
    const b = rangeBands('saxophone', 'alto');
    expect(b.pro).toEqual({ low: 58, high: 101 });
    expect(b.beginner.low).toBeGreaterThanOrEqual(b.intermediate.low);
    const w = rangeBands('tin-whistle', 'C');
    expect(w.pro).toEqual({ low: 72, high: 93 });
  });
});

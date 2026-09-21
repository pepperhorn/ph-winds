import { describe, it, expect } from 'vitest';
import { registerBand, registerName, registersFor } from './registers';
import { getInstrument } from './instruments';
import { parsePitch } from './pitch';

const name = (id: string, horn: string | undefined, p: string) => registerName(id, horn, parsePitch(p));

describe('registersFor', () => {
  it('reads instrument-level bands', () => {
    expect(registersFor('saxophone', 'alto')?.map((r) => r.name)).toEqual(['Low', 'Middle', 'High', 'Altissimo']);
    // All four saxophones read the same written notes, so they share one set.
    expect(registersFor('saxophone', 'baritone')).toEqual(registersFor('saxophone', 'soprano'));
  });
  it('reads tin whistle bands per horn, each keyed to that whistle', () => {
    expect(registersFor('tin-whistle', 'D')?.map((r) => r.from)).toEqual(['D5', 'D6']);
    expect(registersFor('tin-whistle', 'Bb')?.map((r) => r.from)).toEqual(['Bb4', 'Bb5']);
    // No horn given falls back to the instrument's default horn (D).
    expect(registersFor('tin-whistle')).toEqual(registersFor('tin-whistle', 'D'));
  });
});

describe('registerName', () => {
  it('names alto sax written pitches by band', () => {
    expect(name('saxophone', 'alto', 'G5')).toBe('High G');
    expect(name('saxophone', 'alto', 'G4')).toBe('Middle G');
    expect(name('saxophone', 'alto', 'B3')).toBe('Low B');
    expect(name('saxophone', 'alto', 'A6')).toBe('Altissimo A');
  });
  it('is horn-independent for saxophone (all horns read the same written notes)', () => {
    expect(name('saxophone', 'tenor', 'G5')).toBe('High G');
    expect(name('saxophone', 'baritone', 'G4')).toBe('Middle G');
  });
  it('names clarinet, trumpet and tin whistle from their own bands', () => {
    expect(name('clarinet', undefined, 'G4')).toBe('Middle G');
    expect(name('clarinet', undefined, 'G5')).toBe('High G');
    expect(name('trumpet', undefined, 'G4')).toBe('Low G');
    expect(name('trumpet', undefined, 'G5')).toBe('Middle G');
    expect(name('tin-whistle', 'D', 'G5')).toBe('Low G');
    expect(name('tin-whistle', 'D', 'G6')).toBe('High G');
  });
  it('prefixes a black key once, not once per spelling', () => {
    expect(name('saxophone', 'alto', 'Eb5')).toBe('High E♭ / D♯');
    expect(name('saxophone', 'alto', 'D#5')).toBe('High E♭ / D♯');
    expect(name('clarinet', undefined, 'F#3')).toBe('Low G♭ / F♯');
  });
  it('drops the octave digit but keeps band boundaries exact', () => {
    // The band's own `from` is inclusive; a semitone below belongs to the band under it.
    expect(name('saxophone', 'alto', 'D5')).toBe('High D');
    expect(name('saxophone', 'alto', 'C#5')).toBe('Middle D♭ / C♯');
    expect(registerBand('saxophone', 'alto', parsePitch('D5'))).toBe('High');
    expect(registerBand('saxophone', 'alto', parsePitch('C#5'))).toBe('Middle');
  });
  it('falls back to the plain pitch pair below the first band', () => {
    // Alto sax's lowest band starts at written B♭3.
    expect(name('saxophone', 'alto', 'A3')).toBe('A3');
    expect(name('saxophone', 'alto', 'Ab3')).toBe('A♭3 / G♯3');
    expect(registerBand('saxophone', 'alto', parsePitch('A3'))).toBeUndefined();
  });
  it('falls back to the plain pitch pair when the instrument declares no registers', () => {
    const layout: { registers?: unknown } = getInstrument('flute').layout;
    const saved = layout.registers;
    delete layout.registers;
    try {
      expect(registersFor('flute')).toBeUndefined();
      expect(name('flute', undefined, 'G5')).toBe('G5');
      expect(name('flute', undefined, 'Eb5')).toBe('E♭5 / D♯5');
    } finally {
      layout.registers = saved;
    }
  });
});

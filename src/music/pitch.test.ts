import { describe, it, expect } from 'vitest';
import { parsePitch, pitchKey, formatPitch, toMidi, fromMidi, isBlackKey, prefersFlats } from './pitch';

describe('pitch', () => {
  it('parses ascii and unicode accidentals', () => {
    expect(parsePitch('F#4')).toEqual({ step: 'F', alter: 1, octave: 4 });
    expect(parsePitch('Bb3')).toEqual({ step: 'B', alter: -1, octave: 3 });
    expect(parsePitch('B♭3')).toEqual({ step: 'B', alter: -1, octave: 3 });
    expect(parsePitch('C4')).toEqual({ step: 'C', alter: 0, octave: 4 });
  });
  it('rejects junk', () => { expect(() => parsePitch('H2')).toThrow(); });
  it('formats', () => {
    expect(pitchKey({ step: 'F', alter: 1, octave: 4 })).toBe('F#4');
    expect(formatPitch({ step: 'B', alter: -1, octave: 3 })).toBe('B♭3');
  });
  it('midi round trip', () => {
    expect(toMidi(parsePitch('C4'))).toBe(60);
    expect(toMidi(parsePitch('Bb3'))).toBe(58);
    expect(toMidi(parsePitch('B#3'))).toBe(60);
    expect(fromMidi(61)).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(fromMidi(61, true)).toEqual({ step: 'D', alter: -1, octave: 4 });
    expect(fromMidi(59)).toEqual({ step: 'B', alter: 0, octave: 3 });
  });
  it('black keys', () => {
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(60)).toBe(false);
  });
  it('flat preference follows horn key', () => {
    expect(prefersFlats(-2)).toBe(true);   // B♭
    expect(prefersFlats(-9)).toBe(true);   // E♭ alto
    expect(prefersFlats(-14)).toBe(true);  // B♭ tenor
    expect(prefersFlats(-21)).toBe(true);  // E♭ bari
    expect(prefersFlats(0)).toBe(false);
    expect(prefersFlats(12)).toBe(false);
  });
});

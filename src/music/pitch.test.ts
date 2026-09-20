import { describe, it, expect } from 'vitest';
import { parsePitch, pitchKey, formatPitch, formatPitchPair, toMidi, fromMidi, isBlackKey, prefersFlats, transposePitch } from './pitch';

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
  it('formats enharmonic pairs for altered pitches, sharp first, regardless of stored spelling', () => {
    expect(formatPitchPair(parsePitch('D#4'))).toBe('D♯4 / E♭4');
    expect(formatPitchPair(parsePitch('Eb4'))).toBe('D♯4 / E♭4');
    expect(formatPitchPair(parsePitch('A#3'))).toBe('A♯3 / B♭3');
    expect(formatPitchPair(parsePitch('Gb5'))).toBe('F♯5 / G♭5');
    expect(formatPitchPair(parsePitch('C5'))).toBe('C5');
  });
  it('does not respell an enharmonic-natural pitch into a bogus duplicate pair', () => {
    // Cb4 (alter -1) is a white key (== B3); it must keep its deliberate
    // spelling, not get respelled into a "B3 / B3"-style duplicate.
    expect(formatPitchPair(parsePitch('Cb4'))).toBe('C♭4');
    expect(formatPitchPair(parsePitch('Fb2'))).toBe('F♭2');
    expect(formatPitchPair(parsePitch('B#3'))).toBe('B♯3');
    // a genuine black-key pitch still produces the sharp-first pair
    expect(formatPitchPair(parsePitch('C#4'))).toBe('C♯4 / D♭4');
    expect(formatPitchPair(parsePitch('Db4'))).toBe('C♯4 / D♭4');
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

describe('transposePitch', () => {
  it('clarinet-style -2', () => {
    expect(transposePitch(parsePitch('G#4'), -2)).toEqual({ step: 'F', alter: 1, octave: 4 });
    expect(transposePitch(parsePitch('C5'), -2)).toEqual({ step: 'B', alter: -1, octave: 4 });
  });
  it('alto-style -9', () => {
    expect(transposePitch(parsePitch('C5'), -9)).toEqual({ step: 'E', alter: -1, octave: 4 });
    expect(transposePitch(parsePitch('F#5'), -9)).toEqual({ step: 'A', alter: 0, octave: 4 });
    expect(transposePitch(parsePitch('B3'), -9)).toEqual({ step: 'D', alter: 0, octave: 3 });
  });
  it('tenor-style -14', () => {
    expect(transposePitch(parsePitch('D5'), -14)).toEqual({ step: 'C', alter: 0, octave: 4 });
  });
  it('bari-style -21', () => {
    expect(transposePitch(parsePitch('C5'), -21)).toEqual({ step: 'E', alter: -1, octave: 3 });
  });
  it('octave-up +12 (recorder-style)', () => {
    expect(transposePitch(parsePitch('C4'), 12)).toEqual({ step: 'C', alter: 0, octave: 5 });
  });
  it('unison 0', () => {
    expect(transposePitch(parsePitch('D4'), 0)).toEqual({ step: 'D', alter: 0, octave: 4 });
  });
});

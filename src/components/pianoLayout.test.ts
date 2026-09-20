import { describe, it, expect } from 'vitest';
import { keyboardSpan, layoutKeys, bandOf } from './pianoLayout';

const bands = { beginner: { low: 62, high: 84 }, intermediate: { low: 58, high: 89 }, pro: { low: 58, high: 101 } };

describe('pianoLayout', () => {
  it('snaps span to whole octaves with margin', () => {
    expect(keyboardSpan(bands.pro)).toEqual({ low: 48, high: 107 });   // C3..B7
  });
  it('lays out white and black keys', () => {
    const { keys, width } = layoutKeys(60, 71, 20);
    expect(keys.filter((k) => !k.black)).toHaveLength(7);
    expect(width).toBe(140);
    const cs = keys.find((k) => k.midi === 61)!;
    expect(cs.black).toBe(true);
    expect(cs.x).toBeGreaterThan(0);
    expect(cs.w).toBeLessThan(20);
  });
  it('classifies bands innermost first', () => {
    expect(bandOf(70, bands)).toBe('beginner');
    expect(bandOf(59, bands)).toBe('intermediate');
    expect(bandOf(95, bands)).toBe('pro');
    expect(bandOf(40, bands)).toBeNull();
  });
});

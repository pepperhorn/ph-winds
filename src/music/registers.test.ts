import { describe, it, expect } from 'vitest';
import { registerBand, registerName, registersFor } from './registers';
import { getInstrument, listInstruments } from './instruments';
import { formatPitchPair, fromMidi, parsePitch, toMidi } from './pitch';
import { withRegisters } from '@/test/registers';

const name = (id: string, horn: string | undefined, p: string) => registerName(id, horn, parsePitch(p));

/**
 * How bands are *read*, pinned against fixture bands this file defines.
 *
 * Deliberately not the shipped ones: the library re-anchors its boundaries
 * and adds band names, and none of the rules below depend on which bands an
 * instrument happens to declare. The shipped data gets its own pass further
 * down, asserting properties rather than literals.
 */
describe('registerName', () => {
  it('prefixes the band name and drops the octave digit', () => {
    withRegisters('flute', [{ from: 'C4', name: 'Fixture' }], () => {
      expect(name('flute', undefined, 'G5')).toBe('Fixture G');
      expect(name('flute', undefined, 'C4')).toBe('Fixture C');
    });
  });
  it('prefixes a black key once, not once per spelling', () => {
    withRegisters('flute', [{ from: 'C4', name: 'Fixture' }], () => {
      expect(name('flute', undefined, 'Eb5')).toBe('Fixture E♭ / D♯');
      expect(name('flute', undefined, 'D#5')).toBe('Fixture E♭ / D♯');
    });
  });
  it('treats each band as half-open: `from` is inclusive, a semitone below is not', () => {
    withRegisters('flute', [{ from: 'C4', name: 'Lower' }, { from: 'D5', name: 'Upper' }], () => {
      expect(name('flute', undefined, 'D5')).toBe('Upper D');
      expect(name('flute', undefined, 'C#5')).toBe('Lower D♭ / C♯');
      expect(registerBand('flute', undefined, parsePitch('D5'))).toBe('Upper');
      expect(registerBand('flute', undefined, parsePitch('C#5'))).toBe('Lower');
    });
  });
  it('names from the highest matching band, in whatever order the data lists them', () => {
    const bands = [{ from: 'C4', name: 'Lower' }, { from: 'D5', name: 'Upper' }];
    for (const order of [bands, [...bands].reverse()]) {
      withRegisters('flute', order, () => {
        expect(name('flute', undefined, 'G5')).toBe('Upper G');
        expect(name('flute', undefined, 'E4')).toBe('Lower E');
        expect(name('flute', undefined, 'B3')).toBe('B3'); // below every band
      });
    }
  });
  it('falls back to the plain pitch pair below the first band', () => {
    withRegisters('flute', [{ from: 'C4', name: 'Fixture' }], () => {
      expect(name('flute', undefined, 'B3')).toBe('B3');
      expect(name('flute', undefined, 'Bb3')).toBe('B♭3 / A♯3');
      expect(registerBand('flute', undefined, parsePitch('B3'))).toBeUndefined();
    });
  });
  it('falls back to the plain pitch pair when the instrument declares no registers', () => {
    withRegisters('flute', undefined, () => {
      expect(registersFor('flute')).toBeUndefined();
      expect(name('flute', undefined, 'G5')).toBe('G5');
      expect(name('flute', undefined, 'Eb5')).toBe('E♭5 / D♯5');
    });
  });
});

/**
 * Register data is instrument JSON shipped by another package: it can be
 * wrong, and a throw here reaches every card on the board through
 * `applyWildcards` → `resolveCardText`. Bad data must degrade to the plain
 * pitch, never throw.
 */
describe('registerName with malformed band data', () => {
  it('drops a band whose `from` is not a pitch instead of throwing', () => {
    withRegisters('flute', [{ from: 'H4', name: 'Low' }], () => {
      expect(() => name('flute', undefined, 'G5')).not.toThrow();
      expect(name('flute', undefined, 'G5')).toBe('G5');
      expect(registerBand('flute', undefined, parsePitch('G5'))).toBeUndefined();
    });
  });
  it('drops a band whose `from` is missing or not a string', () => {
    for (const from of [null, undefined, 42, {}]) {
      withRegisters('flute', [{ from, name: 'High' }], () => {
        expect(() => name('flute', undefined, 'G5')).not.toThrow();
        expect(name('flute', undefined, 'G5')).toBe('G5');
      });
    }
  });
  it('keeps the bands that do parse alongside one that does not', () => {
    withRegisters('flute', [{ from: 'H4', name: 'Bogus' }, { from: 'C4', name: 'Fixture' }], () => {
      expect(name('flute', undefined, 'G5')).toBe('Fixture G');
    });
  });
  it('survives a band that is not an object at all', () => {
    withRegisters('flute', [null, 'nonsense', { from: 'C4', name: 'Fixture' }], () => {
      expect(() => name('flute', undefined, 'G5')).not.toThrow();
      expect(name('flute', undefined, 'G5')).toBe('Fixture G');
    });
  });
  it('still degrades, as before, for an empty list or a band with no name', () => {
    withRegisters('flute', [], () => expect(name('flute', undefined, 'G5')).toBe('G5'));
    // A nameless band is kept as a *boundary* — dropping it would hand its
    // pitches the band below's name, which is a wrong answer rather than none.
    withRegisters('flute', [{ from: 'C4', name: 'Fixture' }, { from: 'D5' }], () => {
      expect(name('flute', undefined, 'G5')).toBe('G5');
      expect(name('flute', undefined, 'E4')).toBe('Fixture E');
    });
  });
});

describe('registersFor', () => {
  it('reads instrument-level bands, one set shared by every horn', () => {
    expect(registersFor('saxophone', 'alto')?.length).toBeGreaterThan(0);
    // All four saxophones read the same written notes, so they share one set.
    expect(registersFor('saxophone', 'baritone')).toEqual(registersFor('saxophone', 'soprano'));
  });
  it('reads tin whistle bands per horn, each keyed to that whistle', () => {
    const d = registersFor('tin-whistle', 'D');
    expect(d?.length).toBeGreaterThan(0);
    // Declared per horn, not at instrument level — each key reads a different
    // written range, so no two horns may share a set.
    expect(getInstrument('tin-whistle').layout.registers).toBeUndefined();
    expect(registersFor('tin-whistle', 'Bb')).not.toEqual(d);
    // No horn given falls back to the instrument's default horn.
    expect(registersFor('tin-whistle')).toEqual(d);
  });
});

/**
 * The shipped data, asserted as properties rather than literals: the library
 * moves boundaries and adds names (a `Lowest` band is already coming), so
 * naming any of them here would just be pinning a snapshot.
 */
describe('the installed instrument data', () => {
  // Every instrument, and every horn of the ones that have horns. `''` is
  // "no horn", so the case titles read sensibly; it is mapped back below.
  const cases: [string, string][] = listInstruments().flatMap((i) =>
    i.horns.length ? i.horns.map((h): [string, string] => [i.id, h.id]) : [[i.id, ''] as [string, string]]);
  const horn = (h: string) => h || undefined;

  it.each(cases)('%s / %s: every declared band claims its own `from`, and not the semitone below it', (id, h) => {
    const regs = registersFor(id, horn(h));
    expect(regs?.length).toBeGreaterThan(0);
    for (const r of regs!) {
      const from = parsePitch(r.from);
      expect(registerBand(id, horn(h), from)).toBe(r.name);
      expect(registerBand(id, horn(h), fromMidi(toMidi(from) - 1))).not.toBe(r.name);
    }
  });
  it.each(cases)('%s / %s: nothing below the lowest band gets a name', (id, h) => {
    const regs = registersFor(id, horn(h))!;
    const below = fromMidi(Math.min(...regs.map((r) => toMidi(parsePitch(r.from)))) - 1);
    expect(registerBand(id, horn(h), below)).toBeUndefined();
    expect(registerName(id, horn(h), below)).toBe(formatPitchPair(below));
  });
  it.each(cases)('%s / %s: names every band, and names it something printable', (id, h) => {
    for (const r of registersFor(id, horn(h))!) {
      expect(typeof r.name).toBe('string');
      expect(r.name.trim()).not.toBe('');
    }
  });
});

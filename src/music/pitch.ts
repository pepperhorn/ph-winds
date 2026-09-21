export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export interface Pitch { step: Step; alter: -1 | 0 | 1; octave: number }

const PC: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP: [Step, -1 | 0 | 1][] = [['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]];
const FLAT: [Step, -1 | 0 | 1][] = [['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];

export function parsePitch(s: string): Pitch {
  const m = /^([A-G])(#|b|♯|♭)?(-?\d+)$/.exec(s.trim());
  if (!m) throw new Error(`Not a pitch: "${s}"`);
  const acc = m[2];
  const alter = acc === '#' || acc === '♯' ? 1 : acc === 'b' || acc === '♭' ? -1 : 0;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

const acc = (a: number, sharp: string, flat: string) => (a === 1 ? sharp : a === -1 ? flat : '');
export const pitchKey = (p: Pitch) => `${p.step}${acc(p.alter, '#', 'b')}${p.octave}`;
export const formatPitch = (p: Pitch) => `${p.step}${acc(p.alter, '♯', '♭')}${p.octave}`;
/** Letter plus accidental, with no octave digit — "E♭", "C". */
export const formatPitchClass = (p: Pitch) => `${p.step}${acc(p.alter, '♯', '♭')}`;

/**
 * Both enharmonic spellings for a black-key pitch, flat first (e.g.
 * "E♭4 / D♯4"), built from the pitch's midi so it doesn't matter whether the
 * stored pitch is spelled sharp or flat. Naturals just format plainly.
 */
export function formatPitchPair(p: Pitch): string {
  const midi = toMidi(p);
  if (!isBlackKey(midi)) return formatPitch(p);
  return `${formatPitch(fromMidi(midi, true))} / ${formatPitch(fromMidi(midi, false))}`;
}

export const toMidi = (p: Pitch) => (p.octave + 1) * 12 + PC[p.step] + p.alter;

export function fromMidi(midi: number, preferFlat = false): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = (preferFlat ? FLAT : SHARP)[pc];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Same rule as fingering-components' `sounding`: E♭, B♭ and F horns read in flats. */
export const prefersFlats = (semis: number) => [3, 5, 10].includes(((semis % 12) + 12) % 12);

/**
 * Letter-step counts for this app's fixed set of instrument transpositions,
 * keyed by semitone offset: 0 (unison), -2 (Bb: major 2nd down), -9 (Eb alto:
 * major 6th down), -14 (Bb tenor: major 9th down), -21 (Eb bari: major 13th
 * down), +12 (octave-transposing: octave up).
 */
const LETTER_STEPS: Record<number, number> = { 0: 0, [-2]: -1, [-9]: -5, [-14]: -8, [-21]: -12, 12: 7 };
const ORDER: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * True interval-based transposition (letter steps + semitones), not
 * chromatic nearest-neighbor. Falls back to chromatic respelling for any
 * `semis` outside this app's known instrument transpositions.
 */
export function transposePitch(p: Pitch, semis: number): Pitch {
  const steps = LETTER_STEPS[semis];
  if (steps === undefined) return fromMidi(toMidi(p) + semis, p.alter === -1 || prefersFlats(semis));
  const targetMidi = toMidi(p) + semis;
  const idx = ORDER.indexOf(p.step);
  const raw = idx + steps;
  const octaveDelta = Math.floor(raw / 7);
  const newIdx = ((raw % 7) + 7) % 7;
  const step = ORDER[newIdx];
  const octave = p.octave + octaveDelta;
  const naturalMidi = toMidi({ step, alter: 0, octave });
  const alter = targetMidi - naturalMidi;
  if (alter < -1 || alter > 1) return fromMidi(targetMidi, prefersFlats(semis)); // safety net, shouldn't hit for supported intervals
  return { step, alter: alter as -1 | 0 | 1, octave };
}

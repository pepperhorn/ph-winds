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

export const toMidi = (p: Pitch) => (p.octave + 1) * 12 + PC[p.step] + p.alter;

export function fromMidi(midi: number, preferFlat = false): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = (preferFlat ? FLAT : SHARP)[pc];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Same rule as fingering-components' `sounding`: E♭, B♭ and F horns read in flats. */
export const prefersFlats = (semis: number) => [3, 5, 10].includes(((semis % 12) + 12) % 12);

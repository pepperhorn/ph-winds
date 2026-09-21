/**
 * Register-aware note names, built on the library's per-instrument
 * `registers` data.
 *
 * This lives in its own module rather than in `pitch.ts` because it needs
 * both the pitch helpers *and* `getInstrument`, and `instruments.ts` already
 * imports `pitch.ts` — folding it into `pitch.ts` would make that a cycle.
 * `instruments.ts` is the wrong home too: it is the instrument/fingering
 * catalogue, and this is a naming/formatting concern.
 */
import type { Register } from '@pepperhorn/fingering-components';
import { getInstrument } from './instruments';
import { type Pitch, formatPitchClass, formatPitchPair, fromMidi, isBlackKey, parsePitch, toMidi } from './pitch';

/**
 * The ordered register bands for an instrument/horn, or `undefined` when the
 * instrument declares none. Tin whistle keeps its bands per horn (each key
 * reads a different written range); every other instrument declares one set
 * at instrument level.
 */
export function registersFor(id: string, horn?: string): Register[] | undefined {
  const { layout, defaultHorn } = getInstrument(id);
  const perHorn = layout.horns?.[horn ?? defaultHorn ?? '']?.registers;
  const regs = perHorn ?? layout.registers;
  return regs?.length ? regs : undefined;
}

/**
 * The band name a **written** pitch falls in ("Low", "Middle", "High",
 * "Altissimo"), or `undefined` when the instrument declares no registers or
 * the pitch sits below the first band.
 */
export function registerBand(id: string, horn: string | undefined, p: Pitch): string | undefined {
  const regs = registersFor(id, horn);
  if (!regs) return undefined;
  const midi = toMidi(p);
  // Half-open bands, in order: the match is the last band starting at or
  // below the pitch. Below the first band's `from` there is no match.
  let name: string | undefined;
  for (const r of regs) if (midi >= toMidi(parsePitch(r.from))) name = r.name;
  return name;
}

/**
 * Register-aware name for a **written** pitch — "High G", "Middle G". Black
 * keys keep the enharmonic-pair convention of `formatPitchPair` but take the
 * band prefix once, not twice: "High E♭ / D♯".
 *
 * Falls back to `formatPitchPair` (today's label, octave digit and all) when
 * the instrument declares no registers or the pitch is below the first band,
 * so nothing regresses.
 */
export function registerName(id: string, horn: string | undefined, p: Pitch): string {
  const band = registerBand(id, horn, p);
  if (!band) return formatPitchPair(p);
  const midi = toMidi(p);
  const name = isBlackKey(midi)
    ? `${formatPitchClass(fromMidi(midi, true))} / ${formatPitchClass(fromMidi(midi, false))}`
    : formatPitchClass(p);
  return `${band} ${name}`;
}

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
 * The register bands an instrument/horn declares, exactly as the data lists
 * them, or `undefined` when it declares none. Callers that need them ordered
 * or validated go through `registerBand` — the data's order is not a promise.
 *
 * Tin whistle keeps its bands per horn (each key reads a different written
 * range); every other instrument declares one set at instrument level.
 */
export function registersFor(id: string, horn?: string): Register[] | undefined {
  const { layout, defaultHorn } = getInstrument(id);
  const perHorn = layout.horns?.[horn ?? defaultHorn ?? '']?.registers;
  const regs = perHorn ?? layout.registers;
  return regs?.length ? regs : undefined;
}

/** One band with its `from` already resolved to midi. `name` is optional:
 * a band with no usable name still counts as a *boundary*, so the pitches
 * above it are left unnamed rather than inheriting the band below's name. */
interface ParsedBand { midi: number; name?: string }

/**
 * `parsePitch` for data we do not control. The bands come from instrument
 * JSON shipped by `@pepperhorn/fingering-components`; a throw here would
 * travel up through `registerName` → `applyWildcards` → `resolveCardText` and
 * blank every card on the board. Bad data degrades, it never throws.
 */
function tryParsePitch(s: unknown): Pitch | undefined {
  if (typeof s !== 'string') return undefined;
  try {
    return parsePitch(s);
  } catch {
    return undefined;
  }
}

/**
 * The instrument's bands, parsed once, with anything unreadable dropped and
 * the rest sorted low to high — so the answer never depends on the order the
 * data happens to list them in. Empty when nothing usable survives.
 *
 * The sort is stable, so bands sharing a `from` keep their declared order and
 * the later one still wins, exactly as an in-order scan would have done.
 */
function parseBands(regs: readonly Register[]): ParsedBand[] {
  const out: ParsedBand[] = [];
  for (const r of regs) {
    const from = tryParsePitch((r as Register | null | undefined)?.from);
    if (!from) continue;
    out.push({ midi: toMidi(from), name: typeof r.name === 'string' && r.name !== '' ? r.name : undefined });
  }
  return out.sort((a, b) => a.midi - b.midi);
}

/**
 * The name of the band a **written** pitch falls in, or `undefined` when the
 * instrument declares no usable registers, the pitch sits below the lowest
 * band, or the band it lands in has no name.
 *
 * The names are whatever the data says: nothing here assumes the set, and the
 * library both adds names and moves boundaries.
 */
export function registerBand(id: string, horn: string | undefined, p: Pitch): string | undefined {
  const regs = registersFor(id, horn);
  if (!regs) return undefined;
  const bands = parseBands(regs);
  const midi = toMidi(p);
  // Half-open bands: the match is the highest band starting at or below the
  // pitch. Below the first band's `from` there is no match.
  let match: ParsedBand | undefined;
  for (const b of bands) {
    if (b.midi > midi) break;
    match = b;
  }
  return match?.name;
}

/**
 * Register-aware name for a **written** pitch — the band name plus the pitch
 * class, e.g. "High G". Black keys keep the enharmonic-pair convention of
 * `formatPitchPair` but take the band prefix once, not twice: "High E♭ / D♯".
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

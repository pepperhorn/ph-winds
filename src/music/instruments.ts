import { transposeFor, type Fingering, type Layout, type Ranges } from '@pepperhorn/fingering-components';
import saxophone from '@pepperhorn/fingering-components/instruments/saxophone';
import clarinet from '@pepperhorn/fingering-components/instruments/clarinet';
import flute from '@pepperhorn/fingering-components/instruments/flute';
import recorder from '@pepperhorn/fingering-components/instruments/recorder';
import tinWhistle from '@pepperhorn/fingering-components/instruments/tin-whistle';
import trumpet from '@pepperhorn/fingering-components/instruments/trumpet';
import trombone from '@pepperhorn/fingering-components/instruments/trombone';
import nuvoDood from '@pepperhorn/fingering-components/instruments/nuvo-dood';
import nuvoToot from '@pepperhorn/fingering-components/instruments/nuvo-toot';
import fSax from '@pepperhorn/fingering-components/fingerings/saxophone';
import fSaxAlt from '@pepperhorn/fingering-components/fingerings/saxophone-altissimo';
import fClarinet from '@pepperhorn/fingering-components/fingerings/clarinet';
import fFlute from '@pepperhorn/fingering-components/fingerings/flute';
import fRecorder from '@pepperhorn/fingering-components/fingerings/recorder';
import fTrumpet from '@pepperhorn/fingering-components/fingerings/trumpet';
import fTrombone from '@pepperhorn/fingering-components/fingerings/trombone';
import fDood from '@pepperhorn/fingering-components/fingerings/nuvo-dood';
import fToot from '@pepperhorn/fingering-components/fingerings/nuvo-toot';
import fWhistleD from '@pepperhorn/fingering-components/fingerings/tin-whistle-d';
import fWhistleC from '@pepperhorn/fingering-components/fingerings/tin-whistle-c';
import fWhistleBb from '@pepperhorn/fingering-components/fingerings/tin-whistle-bb';
import fWhistleEb from '@pepperhorn/fingering-components/fingerings/tin-whistle-eb';
import fWhistleF from '@pepperhorn/fingering-components/fingerings/tin-whistle-f';
import { type Pitch, parsePitch, toMidi, fromMidi, prefersFlats } from './pitch';

export type InstrumentId = 'saxophone' | 'clarinet' | 'flute' | 'recorder' | 'tin-whistle' | 'trumpet' | 'trombone' | 'nuvo-dood' | 'nuvo-toot';
export interface HornOption { id: string; name: string }
export interface InstrumentInfo { id: InstrumentId; name: string; shortName: string; horns: HornOption[]; defaultHorn?: string; clef: 'G' | 'F'; layout: Layout }
export type Band = { low: number; high: number };
export interface RangeBands { beginner: Band; intermediate: Band; pro: Band }

type Sheets = (horn?: string) => Fingering[];
const WHISTLE: Record<string, Fingering[]> = {
  D: fWhistleD.fingerings, C: fWhistleC.fingerings, Bb: fWhistleBb.fingerings, Eb: fWhistleEb.fingerings, F: fWhistleF.fingerings,
};
const CATALOGUE: { layout: Layout; clef: 'G' | 'F'; sheets: Sheets }[] = [
  { layout: saxophone, clef: 'G', sheets: () => [...fSax.fingerings, ...fSaxAlt.fingerings] },
  { layout: clarinet, clef: 'G', sheets: () => fClarinet.fingerings },
  { layout: flute, clef: 'G', sheets: () => fFlute.fingerings },
  { layout: recorder, clef: 'G', sheets: () => fRecorder.fingerings },
  { layout: tinWhistle, clef: 'G', sheets: (h) => WHISTLE[h ?? tinWhistle.horn ?? 'D'] ?? [] },
  { layout: trumpet, clef: 'G', sheets: () => fTrumpet.fingerings },
  { layout: trombone, clef: 'F', sheets: () => fTrombone.fingerings },
  { layout: nuvoDood, clef: 'G', sheets: () => fDood.fingerings },
  { layout: nuvoToot, clef: 'G', sheets: () => fToot.fingerings },
];

/** Short display name per instrument, for compact UI like the "not available
 * on …" line and the icon-picker caption — the full `name` (which may carry
 * parentheticals such as "Recorder (baroque fingering)") is used as each
 * icon-picker button's accessible name instead. */
const SHORT_NAMES: Record<InstrumentId, string> = {
  saxophone: 'Saxophone',
  clarinet: 'Clarinet',
  flute: 'Flute',
  recorder: 'Recorder',
  'tin-whistle': 'Tin whistle',
  trumpet: 'Trumpet',
  trombone: 'Trombone',
  'nuvo-dood': 'Nuvo Dood',
  'nuvo-toot': 'Nuvo TooT',
};

const INFO: InstrumentInfo[] = CATALOGUE.map(({ layout, clef }) => ({
  id: layout.id as InstrumentId,
  name: layout.name,
  shortName: SHORT_NAMES[layout.id as InstrumentId] ?? layout.name,
  horns: Object.entries(layout.horns ?? {}).map(([id, h]) => ({ id, name: h.name })),
  defaultHorn: layout.horn,
  clef,
  layout,
}));

export const listInstruments = () => INFO;
export function getInstrument(id: string): InstrumentInfo {
  const i = INFO.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown instrument "${id}"`);
  return i;
}
export const semitones = (id: string, horn?: string) => transposeFor(getInstrument(id).layout, horn);

const fMidi = (f: Fingering) => toMidi(parsePitch(`${f.note}${f.octave}`));
const sheetCache = new Map<string, Fingering[]>();
export function fingeringSheet(id: string, horn?: string): Fingering[] {
  const key = `${id}/${horn ?? ''}`;
  let s = sheetCache.get(key);
  if (!s) {
    const entry = CATALOGUE[INFO.indexOf(getInstrument(id))];
    s = entry.sheets(horn).filter((f) => f.note && f.octave != null).sort((a, b) => fMidi(a) - fMidi(b));
    sheetCache.set(key, s);
  }
  return s;
}

export function fingeringsFor(id: string, horn: string | undefined, writtenMidi: number): Fingering[] {
  const primary = fingeringSheet(id, horn).find((f) => fMidi(f) === writtenMidi);
  if (!primary) return [];
  const { alternates = [], ...main } = primary;
  return [main, ...alternates.map((a, i) => ({ ...a, note: main.note, octave: main.octave, note_text: `Alt ${i + 1}` }))];
}

/** Whether `id`/`horn` has any fingering for a given written pitch — shared
 * predicate for the unavailable-card check (used by both `WindCard` and
 * `Board`, which need to agree so the export filter doesn't leave a
 * spurious gap where the card itself is hidden but its wrapper isn't). */
export function hasFingering(id: string, horn: string | undefined, writtenMidi: number): boolean {
  return fingeringsFor(id, horn, writtenMidi).length > 0;
}

export const playableMidis = (id: string, horn?: string) => new Set(fingeringSheet(id, horn).map(fMidi));

export function spellWritten(id: string, horn: string | undefined, writtenMidi: number): Pitch {
  const f = fingeringSheet(id, horn).find((x) => fMidi(x) === writtenMidi);
  return f ? parsePitch(`${f.note}${f.octave}`) : fromMidi(writtenMidi, prefersFlats(semitones(id, horn)));
}

export function rangeBands(id: string, horn?: string): RangeBands {
  const { layout, defaultHorn } = getInstrument(id);
  const r: Ranges | undefined = layout.horns?.[horn ?? defaultHorn ?? '']?.ranges ?? layout.ranges;
  if (!r) throw new Error(`${id} has no ranges`);
  const band = (b: { low: string; high: string }) => ({ low: toMidi(parsePitch(b.low)), high: toMidi(parsePitch(b.high)) });
  return { beginner: band(r.beginner), intermediate: band(r.intermediate), pro: band(r.pro) };
}

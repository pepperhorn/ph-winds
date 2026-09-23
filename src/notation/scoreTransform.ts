import { formatPitchClass, fromMidi, toMidi, type Pitch, type Step } from '@/music/pitch';
import type { ScoreLabelSize } from '@/state/types';

export interface ScoreTransformOptions {
  hideEmptyStaves?: boolean;
  showNoteNames?: boolean;
  noteNameSize?: ScoreLabelSize;
  showCounts?: boolean;
  countSize?: ScoreLabelSize;
  /** Display-only pitch offset; Verovio applies the same offset to the notation. */
  transposeSemitones?: number;
  preferFlats?: boolean;
  /** Circle-of-fifths shift from concert key to this instrument's written key. */
  fifthsDelta?: number;
}

const FONT_POINTS: Record<ScoreLabelSize, number> = { S: 6, M: 8, L: 10, XL: 12 };
const elementChildren = (el: Element) => Array.from(el.children);
const child = (el: Element, name: string) => elementChildren(el).find((node) => node.localName === name);
const descendants = (root: ParentNode, name: string) => Array.from(root.querySelectorAll('*')).filter((node) => node.localName === name);
const numberText = (el: Element | undefined, fallback = 0) => {
  const value = Number(el?.textContent);
  return Number.isFinite(value) ? value : fallback;
};
const staffNumber = (el: Element) => Math.max(1, numberText(child(el, 'staff'), 1));
const isPitched = (note: Element) => !!child(note, 'pitch') || !!child(note, 'unpitched');

function musicXmlPitch(note: Element): Pitch | null {
  const pitch = child(note, 'pitch');
  if (!pitch) return null;
  const step = child(pitch, 'step')?.textContent as Step | undefined;
  const octave = Number(child(pitch, 'octave')?.textContent);
  const alter = numberText(child(pitch, 'alter'));
  if (!step || !Number.isInteger(octave)) return null;
  if (alter < -1 || alter > 1) {
    const natural = toMidi({ step, alter: 0, octave });
    return fromMidi(natural + alter, alter < 0);
  }
  return { step, octave, alter: alter as -1 | 0 | 1 };
}

function noteName(note: Element, semitones: number, preferFlats: boolean): string | null {
  const pitch = musicXmlPitch(note);
  if (!pitch) return null;
  return formatPitchClass(semitones === 0 ? pitch : fromMidi(toMidi(pitch) + semitones, preferFlats));
}

function appendLyric(note: Element, textValue: string, number: string, name: string, size: ScoreLabelSize) {
  const doc = note.ownerDocument;
  const ns = note.namespaceURI;
  const lyric = doc.createElementNS(ns, 'lyric');
  lyric.setAttribute('number', number);
  lyric.setAttribute('name', name);
  lyric.setAttribute('placement', 'below');
  const syllabic = doc.createElementNS(ns, 'syllabic');
  syllabic.textContent = 'single';
  const text = doc.createElementNS(ns, 'text');
  text.setAttribute('font-size', String(FONT_POINTS[size]));
  text.textContent = textValue;
  lyric.append(syllabic, text);
  note.append(lyric);
}

/** Standard spoken subdivision labels; uncommon fractions remain an honest numeric position. */
export function formatBeatCount(position: number): string {
  const beat = Math.floor(position) + 1;
  const fraction = position - Math.floor(position);
  if (Math.abs(fraction) < 0.001) return String(beat);
  if (Math.abs(fraction - 0.25) < 0.001) return 'e';
  if (Math.abs(fraction - 0.5) < 0.001) return '&';
  if (Math.abs(fraction - 0.75) < 0.001) return 'a';
  return (position + 1).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Remove staves that contain no pitched/unpitched notes anywhere in their part.
 * A used staff is never hidden merely because one measure is resting.
 */
function removeEmptyStaves(doc: XMLDocument) {
  for (const part of descendants(doc, 'part')) {
    if (part.parentElement?.localName !== 'score-partwise') continue;
    const notes = descendants(part, 'note');
    const declared = Math.max(
      1,
      ...descendants(part, 'staves').map((el) => numberText(el, 1)),
      ...notes.map(staffNumber),
    );
    const active = new Set(notes.filter(isPitched).map(staffNumber));
    if (!active.size || active.size === declared) continue;
    const kept = [...active].sort((a, b) => a - b);
    const remap = new Map(kept.map((old, index) => [old, index + 1]));

    for (const measure of descendants(part, 'measure')) {
      const children = elementChildren(measure);
      // A backup immediately before a removed staff's voice would rewind the
      // surviving voice after its notes have been deleted. Drop that reset too.
      children.forEach((node, index) => {
        if (node.localName !== 'backup') return;
        const nextNote = children.slice(index + 1).find((candidate) => candidate.localName === 'note');
        if (nextNote && !active.has(staffNumber(nextNote))) node.remove();
      });

      for (const note of descendants(measure, 'note')) {
        const mapped = remap.get(staffNumber(note));
        if (!mapped) note.remove();
        else {
          const staff = child(note, 'staff');
          if (staff) staff.textContent = String(mapped);
        }
      }
      for (const scoped of elementChildren(measure).filter((el) => ['direction', 'harmony', 'figured-bass'].includes(el.localName))) {
        const staff = child(scoped, 'staff');
        if (!staff) continue;
        const mapped = remap.get(numberText(staff, 1));
        if (!mapped) scoped.remove();
        else staff.textContent = String(mapped);
      }
    }

    for (const staves of descendants(part, 'staves')) staves.textContent = String(kept.length);
    const numbered = new Set(['clef', 'key', 'time', 'staff-details', 'transpose', 'staff-layout']);
    for (const el of Array.from(part.querySelectorAll('[number]')).filter((node) => numbered.has(node.localName))) {
      const old = Number(el.getAttribute('number'));
      const mapped = remap.get(old);
      if (!mapped) el.remove();
      else el.setAttribute('number', String(mapped));
    }
  }
}

function annotateScore(doc: XMLDocument, options: ScoreTransformOptions) {
  for (const part of descendants(doc, 'part')) {
    if (part.parentElement?.localName !== 'score-partwise') continue;
    let divisions = 1;
    let beatType = 4;
    let fifths = 0;
    // Verse numbers are positional in Verovio. Appending at 98/99 would make
    // it reserve 97 blank rows, so place our lines immediately after any real
    // lyrics already present in the upload.
    let nextVerse = Math.max(0, ...descendants(part, 'lyric').map((lyric) => Number(lyric.getAttribute('number')) || 0));
    const noteNameVerse = options.showNoteNames ? String(++nextVerse) : '';
    const countVerse = options.showCounts ? String(++nextVerse) : '';
    for (const measure of elementChildren(part).filter((node) => node.localName === 'measure')) {
      let cursor = 0;
      const counted = new Set<string>();
      for (const node of elementChildren(measure)) {
        if (node.localName === 'attributes') {
          divisions = numberText(child(node, 'divisions'), divisions);
          beatType = numberText(child(child(node, 'time') ?? node, 'beat-type'), beatType);
          fifths = numberText(child(child(node, 'key') ?? node, 'fifths'), fifths);
          continue;
        }
        if (node.localName === 'backup') {
          cursor -= numberText(child(node, 'duration'));
          continue;
        }
        if (node.localName === 'forward') {
          cursor += numberText(child(node, 'duration'));
          continue;
        }
        if (node.localName !== 'note') continue;
        const chord = !!child(node, 'chord');
        const grace = !!child(node, 'grace');
        if (isPitched(node) && !chord && !grace) {
          if (options.showNoteNames) {
            const preferFlats = options.fifthsDelta == null ? options.preferFlats ?? false : fifths + options.fifthsDelta < 0;
            const name = noteName(node, options.transposeSemitones ?? 0, preferFlats);
            if (name) appendLyric(node, name, noteNameVerse, 'wc-note-name', options.noteNameSize ?? 'XL');
          }
          if (options.showCounts) {
            const key = `${staffNumber(node)}:${cursor}`;
            const unit = divisions * 4 / beatType;
            if (!counted.has(key) && unit > 0) {
              appendLyric(node, formatBeatCount(cursor / unit), countVerse, 'wc-count', options.countSize ?? 'L');
              counted.add(key);
            }
          }
        }
        if (!chord) cursor += numberText(child(node, 'duration'));
      }
    }
  }
}

/** Concert -> written key-signature movement for the app's supported instrument offsets. */
export function writtenKeyFifthsDelta(soundingSemitones: number): number {
  return ({ 0: 0, [-2]: 2, [-7]: 1, [-9]: 3, [-14]: 2, [-21]: 3, 12: 0 } as Record<number, number>)[soundingSemitones] ?? 0;
}

export function prepareMusicXml(musicXml: string, options: ScoreTransformOptions): string {
  const doc = new DOMParser().parseFromString(musicXml, 'application/xml');
  if (doc.documentElement.localName === 'parsererror' || descendants(doc, 'parsererror').length) throw new Error('MusicXML could not be parsed');
  if (options.hideEmptyStaves) removeEmptyStaves(doc);
  if (options.showNoteNames || options.showCounts) annotateScore(doc, options);
  return new XMLSerializer().serializeToString(doc);
}

import { describe, expect, it } from 'vitest';
import { formatBeatCount, prepareMusicXml, writtenKeyFifthsDelta } from './scoreTransform';

const SCORE = `<?xml version="1.0"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign></clef><clef number="2"><sign>F</sign></clef></attributes>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><staff>1</staff></note>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><staff>1</staff></note>
<backup><duration>4</duration></backup><note><rest/><duration>4</duration><staff>2</staff></note>
</measure></part></score-partwise>`;

describe('uploaded score transformation', () => {
  it('rejects malformed XML before it reaches Verovio', () => {
    expect(() => prepareMusicXml('<score-partwise>', {})).toThrow('could not be parsed');
  });

  it('hides only the globally empty staff and its time reset', () => {
    const doc = new DOMParser().parseFromString(prepareMusicXml(SCORE, { hideEmptyStaves: true }), 'application/xml');
    expect(doc.querySelector('staves')?.textContent).toBe('1');
    expect(doc.querySelectorAll('clef')).toHaveLength(1);
    expect(doc.querySelectorAll('note')).toHaveLength(3);
    expect(doc.querySelector('backup')).toBeNull();
    expect([...doc.querySelectorAll('staff')].map((el) => el.textContent)).toEqual(['1', '1', '1']);
  });

  it('adds note-name and meter-relative count lyric lines with independent sizes', () => {
    const output = prepareMusicXml(SCORE, { showNoteNames: true, noteNameSize: 'XL', showCounts: true, countSize: 'S' });
    const doc = new DOMParser().parseFromString(output, 'application/xml');
    const names = [...doc.querySelectorAll('lyric[name="wc-note-name"] text')];
    const counts = [...doc.querySelectorAll('lyric[name="wc-count"] text')];
    expect(names.map((el) => el.textContent)).toEqual(['E', 'D', 'C']);
    expect(names.map((el) => el.getAttribute('font-size'))).toEqual(['12', '12', '12']);
    expect(counts.map((el) => el.textContent)).toEqual(['1', '2', '&']);
    expect(counts.map((el) => el.getAttribute('font-size'))).toEqual(['6', '6', '6']);
    expect(names[0].closest('lyric')?.getAttribute('number')).toBe('1');
    expect(counts[0].closest('lyric')?.getAttribute('number')).toBe('2');
  });

  it('calculates displayed note names using the notation transposition', () => {
    const output = prepareMusicXml(SCORE, { showNoteNames: true, transposeSemitones: 9 });
    const doc = new DOMParser().parseFromString(output, 'application/xml');
    expect([...doc.querySelectorAll('lyric[name="wc-note-name"] text')].map((el) => el.textContent)).toEqual(['C♯', 'B', 'A']);
  });

  it('uses standard quarter/eighth/sixteenth count syllables', () => {
    expect([0, .25, .5, .75, 1].map(formatBeatCount)).toEqual(['1', 'e', '&', 'a', '2']);
  });

  it('maps concert keys to the selected transposing instrument written key', () => {
    expect(writtenKeyFifthsDelta(-2)).toBe(2); // B-flat instrument: C concert -> D written
    expect(writtenKeyFifthsDelta(-9)).toBe(3); // E-flat alto: C concert -> A written
    expect(writtenKeyFifthsDelta(12)).toBe(0); // octave-only transposition
  });
});

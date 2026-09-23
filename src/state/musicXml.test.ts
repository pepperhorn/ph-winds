import { describe, expect, it } from 'vitest';
import { isMusicXml, MAX_MUSIC_XML_CHARS, musicXmlFromFile, sanitizeGrandStaff } from './musicXml';

const PARTWISE = '<?xml version="1.0"?><score-partwise version="4.0"><part-list/></score-partwise>';
const TIMEWISE = '<m:score-timewise xmlns:m="urn:test" version="4.0"><m:part-list/></m:score-timewise>';

describe('MusicXML board score', () => {
  it('accepts partwise/timewise MusicXML and rejects other XML', () => {
    expect(isMusicXml(PARTWISE)).toBe(true);
    expect(isMusicXml(TIMEWISE)).toBe(true);
    expect(isMusicXml('<mei/>')).toBe(false);
    expect(isMusicXml('not xml')).toBe(false);
  });

  it('sanitizes the persisted filename and scale independently', () => {
    expect(sanitizeGrandStaff({ musicXml: PARTWISE, fileName: '', scale: 4 })).toEqual({
      musicXml: PARTWISE,
      fileName: 'score.musicxml',
      scale: 1,
    });
  });

  it('reads a MusicXML file and refuses oversized input', async () => {
    await expect(musicXmlFromFile(new File([PARTWISE], 'piano.musicxml'))).resolves.toEqual({
      musicXml: PARTWISE,
      fileName: 'piano.musicxml',
      scale: 1,
    });
    await expect(musicXmlFromFile(new File(['x'.repeat(MAX_MUSIC_XML_CHARS + 1)], 'huge.xml')))
      .rejects.toThrow('under 500 KB');
  });
});

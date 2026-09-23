import type { GrandStaff } from './types';

/** A single grand staff is tiny; this leaves generous room without consuming the whole localStorage budget. */
export const MAX_MUSIC_XML_CHARS = 500_000;
export const ACCEPTED_MUSIC_XML_TYPES = '.musicxml,.xml,application/vnd.recordare.musicxml+xml,application/xml,text/xml';

const SCORE_ROOT = /<(?:[A-Za-z_][\w.-]*:)?score-(?:partwise|timewise)(?:\s|>)/i;

export function isMusicXml(text: unknown): text is string {
  return typeof text === 'string'
    && text.length > 0
    && text.length <= MAX_MUSIC_XML_CHARS
    && SCORE_ROOT.test(text);
}

export function sanitizeGrandStaff(value: unknown): GrandStaff | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (!isMusicXml(raw.musicXml)) return undefined;
  return {
    musicXml: raw.musicXml,
    fileName: typeof raw.fileName === 'string' && raw.fileName.trim() ? raw.fileName : 'score.musicxml',
    scale: typeof raw.scale === 'number' && raw.scale >= 0.5 && raw.scale <= 2 ? raw.scale : 1,
  };
}

export async function musicXmlFromFile(file: File): Promise<GrandStaff> {
  if (file.size > MAX_MUSIC_XML_CHARS) throw new Error('That MusicXML file is too large. Choose a file under 500 KB.');
  const musicXml = await file.text();
  if (!isMusicXml(musicXml)) {
    throw new Error('Choose an uncompressed MusicXML file containing a score-partwise or score-timewise document.');
  }
  return { musicXml, fileName: file.name || 'score.musicxml', scale: 1 };
}

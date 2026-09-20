import { describe, it, expect } from 'vitest';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { autoHeading, autoSubtitle, resolveCardText, resolveStyle } from './resolve';
import { parsePitch } from '@/music/pitch';

const alto = () => ({ ...createBoard('saxophone'), meta: { ...createBoard('saxophone').meta, horn: 'alto' } });

describe('resolve', () => {
  it('auto labels', () => {
    expect(autoHeading(parsePitch('F#4'))).toBe('G♭4 / F♯4');
    expect(autoHeading(parsePitch('C5'))).toBe('C5');
    expect(autoSubtitle(parsePitch('C5'), -9)).toBe('Concert Pitch: E♭4 / D♯4');
    expect(autoSubtitle(parsePitch('C5'), 0)).toBe('');
    expect(autoSubtitle(parsePitch('G#4'), -2)).toBe('Concert Pitch: G♭4 / F♯4');
  });
  it('written accidental gets both spellings flat-first; a natural sounding pitch does not', () => {
    // alto sax (-9): written C♯5 sounds E4 (natural).
    expect(autoHeading(parsePitch('C#5'))).toBe('D♭5 / C♯5');
    expect(autoSubtitle(parsePitch('C#5'), -9)).toBe('Concert Pitch: E4');
  });
  it('card text falls back to board defaults then auto labels', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5') }, b.meta);
    expect(t.heading.text).toBe('C5');
    expect(t.subtitle.text).toBe('Concert Pitch: E♭4 / D♯4');
    expect(t.subtitle.show).toBe(true);
    expect(t.footer.show).toBe(false);
  });
  it('card override wins field by field', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5'), text: { heading: { text: 'Middle C', size: 'L' } } }, b.meta);
    expect(t.heading).toMatchObject({ text: 'Middle C', size: 'L', align: 'center', show: true });
  });
  it('subtitle hides itself on non-transposing instruments when empty', () => {
    const b = createBoard('flute');
    expect(resolveCardText({ pitch: parsePitch('C5') }, b.meta).subtitle.show).toBe(false);
  });
  it('style merges', () => {
    const b = alto();
    expect(resolveStyle({}, b.meta)).toEqual(DEFAULT_STYLE);
    expect(resolveStyle({ style: { primary: '#ff0000' } }, b.meta).primary).toBe('#ff0000');
  });
  it('new card draft defaults', () => {
    expect(newCardDraft(parsePitch('D4'))).toMatchObject({ fingeringIndex: 0, display: 'both', orientation: 'vertical', scale: 1 });
  });
});

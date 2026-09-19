import { describe, it, expect } from 'vitest';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { autoHeading, autoSubtitle, resolveCardText, resolveStyle } from './resolve';
import { parsePitch } from '@/music/pitch';

const alto = () => ({ ...createBoard('saxophone'), meta: { ...createBoard('saxophone').meta, horn: 'alto' } });

describe('resolve', () => {
  it('auto labels', () => {
    expect(autoHeading(parsePitch('F#4'))).toBe('F♯4');
    expect(autoSubtitle(parsePitch('C5'), -9)).toBe('sounds E♭4');
    expect(autoSubtitle(parsePitch('C5'), 0)).toBe('');
  });
  it('card text falls back to board defaults then auto labels', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5') }, b.meta);
    expect(t.heading.text).toBe('C5');
    expect(t.subtitle.text).toBe('sounds E♭4');
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

import { describe, it, expect } from 'vitest';
import { applyCardPatch, boardImageChars, isTextCardBlank, newTextCardDraft, TEXT_CARD_PLACEHOLDER } from './textCards';
import { isFingeringCard, isTextCard, type CardItem, type FingeringCard, type TextCard } from './types';
import { newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';

const PNG = 'data:image/png;base64,AAAA';
const fingering = (id: string): FingeringCard => ({ id, ...newCardDraft(parsePitch('C5')) });
const text = (id: string, p: Partial<TextCard> = {}): TextCard => ({ id, ...newTextCardDraft(), ...p });

describe('the card union', () => {
  it('discriminates on kind, and an absent kind is a fingering card', () => {
    const f = fingering('a');
    expect(isTextCard(f)).toBe(false);
    expect(isFingeringCard(f)).toBe(true);
    expect('kind' in f).toBe(false);

    const t = text('b');
    expect(isTextCard(t)).toBe(true);
    expect(isFingeringCard(t)).toBe(false);
  });

  it('a card saved with an explicit kind: fingering is still a fingering card', () => {
    expect(isTextCard({ ...fingering('a'), kind: 'fingering' })).toBe(false);
  });

  it('a new text card is never blank — an empty one is an invisible box', () => {
    const t = newTextCardDraft();
    expect(t.text?.heading?.text).toBe(TEXT_CARD_PLACEHOLDER);
    expect(isTextCardBlank({ id: 'x', ...t })).toBe(false);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1 })).toBe(true);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1, icon: 'music:trebleClef' })).toBe(false);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1, text: { heading: { text: '' } } })).toBe(true);
  });
});

describe('applyCardPatch — the one place icon/picture exclusion lives', () => {
  it('setting an icon clears the picture', () => {
    const before = text('a', { image: PNG });
    const after = applyCardPatch(before, { icon: 'music:trebleClef' }) as TextCard;
    expect(after.icon).toBe('music:trebleClef');
    expect(after.image).toBeUndefined();
  });

  it('setting a picture clears the icon', () => {
    const before = text('a', { icon: 'music:trebleClef' });
    const after = applyCardPatch(before, { image: PNG }) as TextCard;
    expect(after.image).toBe(PNG);
    expect(after.icon).toBeUndefined();
  });

  it('clearing the icon leaves a card with neither — the only route back', () => {
    const after = applyCardPatch(text('a', { icon: 'music:trebleClef' }), { icon: undefined }) as TextCard;
    expect(after.icon).toBeUndefined();
    expect(after.image).toBeUndefined();
  });

  it('a card arriving with both keeps the icon', () => {
    const after = applyCardPatch(text('a', { icon: 'obj:star', image: PNG })) as TextCard;
    expect(after.icon).toBe('obj:star');
    expect(after.image).toBeUndefined();
  });

  it('leaves a fingering card alone', () => {
    const f = fingering('a');
    expect(applyCardPatch(f, { scale: 1.5 })).toEqual({ ...f, scale: 1.5 });
  });

  it('an unrelated patch does not disturb existing art', () => {
    const after = applyCardPatch(text('a', { image: PNG }), { scale: 2 }) as TextCard;
    expect(after.image).toBe(PNG);
    expect(after.scale).toBe(2);
  });
});

describe('boardImageChars', () => {
  it('counts only text-card pictures, and can exclude the card being edited', () => {
    const items: CardItem[] = [fingering('a'), text('b', { image: PNG }), text('c', { image: `${PNG}BBBB` })];
    expect(boardImageChars(items)).toBe(PNG.length * 2 + 4);
    expect(boardImageChars(items, 'b')).toBe(PNG.length + 4);
    expect(boardImageChars([fingering('a')])).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { applyCardPatch, boardImageChars, cardIconRenders, exceedsImageBudget, IMAGE_BUDGET_CHARS, isTextCardBlank, newTextCardDraft, TEXT_CARD_PLACEHOLDER } from './textCards';
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

  it('a new text card is never blank — an empty one is a bare unexplained bar', () => {
    const t = newTextCardDraft();
    expect(t.text?.heading?.text).toBe(TEXT_CARD_PLACEHOLDER);
    expect(isTextCardBlank({ id: 'x', ...t })).toBe(false);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1 })).toBe(true);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1, icon: 'music:trebleClef' })).toBe(false);
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1, text: { heading: { text: '' } } })).toBe(true);
  });

  it('a card whose only content is an icon this build cannot draw is blank', () => {
    // "Has an icon" is not "shows an icon": `parseIcon` deliberately admits a
    // forward-compatible id and `CardIcon` renders an unknown one as nothing,
    // so this card has nothing on it and needs the placeholder like any other.
    expect(isTextCardBlank({ id: 'x', kind: 'text', scale: 1, icon: 'music:notYetDrawn' })).toBe(true);
    expect(cardIconRenders('music:notYetDrawn')).toBe(false);
    expect(cardIconRenders('music:trebleClef')).toBe(true);
    expect(cardIconRenders(undefined)).toBe(false);
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

  it('a card arriving with both keeps the icon — the cheap one', () => {
    const after = applyCardPatch(text('a', { icon: 'obj:metronome', image: PNG })) as TextCard;
    expect(after.icon).toBe('obj:metronome');
    expect(after.image).toBeUndefined();
  });

  it('...unless this build cannot draw that icon, in which case the picture is the only art left', () => {
    // `parseIcon` admits a well-prefixed id from a newer build on purpose, and
    // `CardIcon` draws it as nothing. Keeping it over a real picture would
    // leave the card with no visible art at all.
    const after = applyCardPatch(text('a', { icon: 'obj:notYetDrawn', image: PNG })) as TextCard;
    expect(after.icon).toBeUndefined();
    expect(after.image).toBe(PNG);
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

describe('exceedsImageBudget', () => {
  const big = (n: number) => 'A'.repeat(n);

  it('is the one question every path that grows a board asks', () => {
    const half = big(IMAGE_BUDGET_CHARS / 2);
    expect(exceedsImageBudget([], half)).toBe(false);
    expect(exceedsImageBudget([text('a', { image: half })], half)).toBe(false);
    expect(exceedsImageBudget([text('a', { image: half }), text('b', { image: half })], big(1))).toBe(true);
  });

  it('excludes the card whose own picture is being replaced, so it is not billed twice', () => {
    const almost = big(IMAGE_BUDGET_CHARS - 10);
    const items = [text('a', { image: almost })];
    expect(exceedsImageBudget(items, almost)).toBe(true);
    expect(exceedsImageBudget(items, almost, 'a')).toBe(false);
  });
});

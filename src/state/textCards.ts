import type { CardItem, CardPatch, TextCard, TextCardDraft } from './types';
import { isTextCard } from './types';

/**
 * A brand-new text card is never blank. An empty text card has no art and no
 * visible text, so it renders as an invisible box the user cannot click to
 * select or edit — a dead card on the board. Seeding a heading means the card
 * is always something you can see and grab.
 */
export const TEXT_CARD_PLACEHOLDER = 'Section';

export const newTextCardDraft = (heading = TEXT_CARD_PLACEHOLDER): TextCardDraft => ({
  kind: 'text',
  text: { heading: { text: heading } },
  scale: 1,
});

/**
 * Apply a patch to a card, keeping the result well-formed.
 *
 * This is the ONE place the icon/picture mutual exclusion is enforced. Every
 * card mutation goes through it (the reducer's `add` and `update`, and the
 * importer's sanitiser), so no UI handler has to remember the rule — which is
 * exactly the bug the chordl original had, where two host handlers each
 * enforced it and every other path did not.
 *
 * Rules:
 * - a patch that sets `icon` to a truthy value clears `image`, and vice versa;
 * - setting either to `undefined` just clears that one (how the picker's
 *   "click the selected icon again" gets you back to a bare card);
 * - a card that somehow arrives carrying both — only possible from an imported
 *   file — keeps the icon, the cheap always-renderable one.
 */
export function applyCardPatch(card: CardItem, patch: CardPatch = {}): CardItem {
  const next = { ...card, ...patch } as CardItem;
  if (!isTextCard(next)) return next;
  if ('icon' in patch && patch.icon) return { ...next, icon: patch.icon, image: undefined };
  if ('image' in patch && patch.image) return { ...next, image: patch.image, icon: undefined };
  if (next.icon && next.image) return { ...next, image: undefined };
  return next;
}

/** Every text card's stored picture, for budget accounting. */
export const boardImages = (items: readonly CardItem[]): string[] =>
  items.filter(isTextCard).map((c) => c.image).filter((s): s is string => !!s);

/**
 * How many characters of picture data a board is carrying. Measured on the
 * stored data-URI strings, because that is what actually lands in
 * `localStorage` and in an exported JSON file.
 */
export const boardImageChars = (items: readonly CardItem[], exceptId?: string): number =>
  boardImages(exceptId ? items.filter((c) => c.id !== exceptId) : items).reduce((n, s) => n + s.length, 0);

/**
 * Picture data a whole board may carry, in data-URI characters.
 *
 * The ~5 MB `localStorage` quota is counted in UTF-16 code units by every
 * major browser, so ~5 MB of quota is ~2.5M characters. Half of that again
 * leaves the cards, text and meta room to grow. Data URIs are ASCII, so
 * "characters" is the honest unit here.
 */
export const IMAGE_BUDGET_CHARS = 1.5 * 1024 * 1024;

export const isTextCardBlank = (c: TextCard): boolean =>
  !c.icon && !c.image && !Object.values(c.text ?? {}).some((f) => f?.text);

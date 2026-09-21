import type { CardItem, CardPatch, TextCard, TextCardDraft } from './types';
import { isTextCard } from './types';
import { CARD_ICONS } from '@/components/cardIcons';

/**
 * A brand-new text card is never blank. A card with no art and no visible text
 * is not invisible — the wrapper keeps its width, border and shadow, so it
 * draws as a bare ~168×32 bar — but it is meaningless: nothing on it says what
 * it is, that it is yours to fill in, or that the board did not glitch.
 * Seeding a heading means a new card arrives saying something.
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
 *   file — keeps the icon: it is the cheap one, costing an id where a picture
 *   costs up to half a megabyte of the board's budget. But only if this build
 *   can actually draw it. An id from a newer build renders as nothing, so
 *   keeping it over a real picture would throw away the card's only visible
 *   art; in that one case the picture wins.
 *
 * `TextCardView` resolves the same contest the same way — icon first, then
 * picture — so the layer that decides which one survives and the layer that
 * draws it can never disagree about which one leaked.
 */
export function applyCardPatch(card: CardItem, patch: CardPatch = {}): CardItem {
  const next = { ...card, ...patch } as CardItem;
  if (!isTextCard(next)) return next;
  if ('icon' in patch && patch.icon) return { ...next, icon: patch.icon, image: undefined };
  if ('image' in patch && patch.image) return { ...next, image: patch.image, icon: undefined };
  if (next.icon && next.image) {
    return cardIconRenders(next.icon) ? { ...next, image: undefined } : { ...next, icon: undefined };
  }
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

/**
 * Would adding `image` to this board push it past the budget?
 *
 * The ONE predicate every path that grows a board's picture data asks: the
 * upload handler, the reducer's `duplicate`, and the toast that warns about
 * the latter. They cannot disagree about what fits because they ask the same
 * question. `exceptId` drops a card from the tally, for the upload case where
 * the card's existing picture is being replaced and must not be billed twice.
 */
export const exceedsImageBudget = (items: readonly CardItem[], image: string, exceptId?: string): boolean =>
  boardImageChars(items, exceptId) + image.length > IMAGE_BUDGET_CHARS;

/**
 * Does this build have a glyph for `id`? `parseIcon` deliberately admits any
 * well-prefixed id so a board written by a newer build round-trips, and
 * `CardIcon` renders an unknown one as nothing — so "has an icon" and "shows
 * an icon" are different questions and callers have to ask the right one.
 */
const RENDERABLE_ICONS = new Set(CARD_ICONS.map((i) => i.id));
export const cardIconRenders = (id: string | undefined): boolean => !!id && RENDERABLE_ICONS.has(id);

/**
 * Has this card nothing to show? Not "has no icon set" — an imported card
 * whose only content is a forward-compatible icon id this build doesn't ship
 * renders nothing at all, so it is blank in every sense the user cares about
 * and needs the placeholder just as much as a truly empty one.
 */
export const isTextCardBlank = (c: TextCard): boolean =>
  !cardIconRenders(c.icon) && !c.image && !Object.values(c.text ?? {}).some((f) => f?.text);

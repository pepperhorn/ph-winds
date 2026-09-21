import type { BoardMeta, CardText, DiagramStyle, FingeringCard, TextCard, TextKey } from './types';
import { type Pitch, formatPitchPair, transposePitch } from '@/music/pitch';
import { registerName } from '@/music/registers';
import { semitones } from '@/music/instruments';
import { CARD_TEXT_TEMPLATES } from './defaults';

/**
 * The subtitle a card gets when its slot is left blank, for the Builder's
 * placeholder. It has to agree with what `resolveCardText` produces from
 * `CARD_TEXT_TEMPLATES.subtitle` — a placeholder promises "this is what you
 * get if you leave this empty" — and it does: same pitch pair, same
 * transposition, and empty on a non-transposing instrument either way.
 *
 * There is deliberately no `autoHeading` twin. The heading template resolves
 * `{noteName}`, which needs the board's instrument and horn, so the Builder
 * asks `resolveCardText` for it rather than guessing from the pitch alone.
 */
export const autoSubtitle = (p: Pitch, semis: number) =>
  semis === 0 ? '' : `Concert Pitch: ${formatPitchPair(transposePitch(p, semis))}`;

const KEYS: TextKey[] = ['heading', 'subtitle', 'footer'];

/** What a card's text is resolved against: the card's own written pitch plus
 * the board's instrument/horn. */
export type WildcardContext = Pick<BoardMeta, 'instrument' | 'horn'>;

/** The wildcard tokens users can type into card text, for the UI hint. */
export const WILDCARDS = ['{noteName}', '{transposedPitch}', '{concertPitch}'] as const;

/**
 * Replace `{noteName}` / `{transposedPitch}` / `{concertPitch}` in a card
 * text string with the values for that card's written pitch. Case-sensitive,
 * every occurrence; anything else in braces is left as literal text.
 *
 * `{concertPitch}` on a non-transposing instrument is simply the same pitch —
 * it never resolves to empty.
 *
 * Each value is a thunk: this runs for every text field of every card on the
 * board, and `{noteName}` re-reads and re-parses the instrument's register
 * bands. Text with no token — or only an unknown one — now costs nothing.
 */
export function applyWildcards(text: string, pitch: Pitch, meta: WildcardContext): string {
  if (!text.includes('{')) return text;
  const values: Record<string, () => string> = {
    noteName: () => registerName(meta.instrument, meta.horn, pitch),
    transposedPitch: () => formatPitchPair(pitch),
    concertPitch: () => {
      const semis = semitones(meta.instrument, meta.horn);
      return formatPitchPair(semis === 0 ? pitch : transposePitch(pitch, semis));
    },
  };
  return text.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.hasOwn(values, key) ? values[key]() : token);
}

export function resolveCardText(card: Pick<FingeringCard, 'pitch' | 'text'>, meta: BoardMeta): CardText {
  const semis = semitones(meta.instrument, meta.horn);
  const auto: Record<TextKey, string> = {
    heading: CARD_TEXT_TEMPLATES.heading,
    // A non-transposing instrument has nothing to say here, so the default
    // stays empty and the line hides itself.
    subtitle: semis === 0 ? '' : CARD_TEXT_TEMPLATES.subtitle,
    footer: CARD_TEXT_TEMPLATES.footer,
  };
  const out = {} as CardText;
  for (const k of KEYS) {
    const merged = { ...meta.cardText[k], ...card.text?.[k] };
    const text = applyWildcards(merged.text || auto[k], card.pitch, meta);
    out[k] = { ...merged, text, show: merged.show && text !== '' };
  }
  return out;
}

/**
 * A text card's three slots, resolved against the board's card-text defaults
 * for size/align/show — the same `TextField` machinery a fingering card uses.
 *
 * Two deliberate differences: there is no auto text (a text card has no pitch
 * to name), and NO wildcard substitution. Wildcards like `{noteName}` resolve
 * against a card's pitch, so on a text card they stay exactly as typed rather
 * than throwing or blanking the line.
 */
export function resolveTextCardText(card: Pick<TextCard, 'text'>, meta: BoardMeta): CardText {
  const out = {} as CardText;
  for (const k of KEYS) {
    const merged = { ...meta.cardText[k], ...card.text?.[k] };
    out[k] = { ...merged, show: merged.show && merged.text !== '' };
  }
  return out;
}

export const resolveStyle = (card: Pick<FingeringCard, 'style'>, meta: BoardMeta): DiagramStyle => ({
  ...meta.style,
  ...card.style,
});

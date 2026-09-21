import type { BoardMeta, CardText, DiagramStyle, FingeringCard, TextCard, TextKey } from './types';
import { type Pitch, formatPitchPair, transposePitch } from '@/music/pitch';
import { semitones } from '@/music/instruments';

export const autoHeading = (p: Pitch) => formatPitchPair(p);

export const autoSubtitle = (p: Pitch, semis: number) =>
  semis === 0 ? '' : `Concert Pitch: ${formatPitchPair(transposePitch(p, semis))}`;

const KEYS: TextKey[] = ['heading', 'subtitle', 'footer'];

export function resolveCardText(card: Pick<FingeringCard, 'pitch' | 'text'>, meta: BoardMeta): CardText {
  const semis = semitones(meta.instrument, meta.horn);
  const auto: Record<TextKey, string> = {
    heading: autoHeading(card.pitch),
    subtitle: autoSubtitle(card.pitch, semis),
    footer: '',
  };
  const out = {} as CardText;
  for (const k of KEYS) {
    const merged = { ...meta.cardText[k], ...card.text?.[k] };
    const text = merged.text || auto[k];
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

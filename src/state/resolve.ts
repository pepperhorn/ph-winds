import type { BoardMeta, CardItem, CardText, DiagramStyle, TextKey } from './types';
import { type Pitch, formatPitchPair, transposePitch } from '@/music/pitch';
import { semitones } from '@/music/instruments';

export const autoHeading = (p: Pitch) => formatPitchPair(p);

export const autoSubtitle = (p: Pitch, semis: number) =>
  semis === 0 ? '' : `sounds ${formatPitchPair(transposePitch(p, semis))}`;

const KEYS: TextKey[] = ['heading', 'subtitle', 'footer'];

export function resolveCardText(card: Pick<CardItem, 'pitch' | 'text'>, meta: BoardMeta): CardText {
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

export const resolveStyle = (card: Pick<CardItem, 'style'>, meta: BoardMeta): DiagramStyle => ({
  ...meta.style,
  ...card.style,
});

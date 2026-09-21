import type { BoardState, CardDraft, DiagramStyle, TextField, TextKey } from './types';
import type { Pitch } from '@/music/pitch';
import { getInstrument } from '@/music/instruments';

export const textField = (p: Partial<TextField> = {}): TextField => ({
  text: '',
  show: true,
  size: 'M',
  align: 'center',
  ...p,
});

/**
 * The default card text, as wildcard templates resolved per card by
 * `resolveCardText`/`applyWildcards`. They are *not* written into
 * `meta.cardText` — those stay empty ("use default"), so the subtitle can
 * still hide itself entirely on a non-transposing instrument and a user's own
 * text keeps winning over the default exactly as before.
 */
export const CARD_TEXT_TEMPLATES: Record<TextKey, string> = {
  heading: '{noteName}',
  subtitle: 'Concert Pitch: {concertPitch}',
  footer: '',
};

export const COLOR_PRESETS =['#1c2233', '#6d5dfc', '#2f80ed', '#12a594', '#e5484d', '#f76b15', '#d6409f', '#8e4ec6'];

export const DEFAULT_STYLE: DiagramStyle = {
  variants: [],
  look: 'solid',
  twoTone: false,
  hints: false,
  primary: '#1c2233',
  secondary: '#2f80ed',
};

export function createBoard(instrument = 'saxophone'): BoardState {
  const info = getInstrument(instrument);
  return {
    version: 1,
    meta: {
      instrument,
      horn: info.defaultHorn,
      pitchMode: 'written',
      musicFont: 'bravura',
      columns: 'auto',
      title: textField({ size: 'L' }),
      subtitle: textField(),
      footer: textField({ size: 'S' }),
      cardText: {
        heading: textField(),
        subtitle: textField({ size: 'S' }),
        footer: textField({ size: 'S', show: false }),
      },
      style: DEFAULT_STYLE,
      diagramOrient: 'vertical',
    },
    items: [],
  };
}

export const newCardDraft = (pitch: Pitch): CardDraft => ({
  pitch,
  fingeringIndex: 0,
  display: 'both',
  orientation: 'vertical',
  scale: 1,
});

import type { Pitch } from '@/music/pitch';

export type PitchMode = 'written' | 'concert';
export type MusicFont = 'bravura' | 'petaluma';
export type CardDisplay = 'fingering' | 'both' | 'notation';
export type Orientation = 'vertical' | 'horizontal';
export type TextSize = 'S' | 'M' | 'L';
export type Align = 'left' | 'center' | 'right';

export interface TextField {
  text: string;
  show: boolean;
  size: TextSize;
  align: Align;
}

export type TextKey = 'heading' | 'subtitle' | 'footer';
export type CardText = Record<TextKey, TextField>;

export interface DiagramStyle {
  variants: string[];
  look: 'solid' | 'dotted' | 'ghost';
  twoTone: boolean;
  hints: boolean;
  primary: string;
  secondary: string;
}

export interface CardItem {
  id: string;
  pitch: Pitch;
  fingeringIndex: number;
  display: CardDisplay;
  orientation: Orientation;
  scale: number;
  text?: Partial<Record<TextKey, Partial<TextField>>>;
  style?: Partial<DiagramStyle>;
}

export type CardDraft = Omit<CardItem, 'id'>;

export interface BoardMeta {
  instrument: string;
  horn?: string;
  pitchMode: PitchMode;
  musicFont: MusicFont;
  columns: number | 'auto';
  title: TextField;
  subtitle: TextField;
  footer: TextField;
  cardText: CardText;
  style: DiagramStyle;
  diagramOrient: 'vertical' | 'horizontal';
}

export interface BoardState {
  version: 1;
  meta: BoardMeta;
  items: CardItem[];
}

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

/**
 * Boards carry two kinds of card. `kind` is the discriminant of a REAL
 * discriminated union (not a soft "extra optional field plus hand-written
 * guards" union): narrowing on it is what stops a text card ever reaching
 * pitch math, fingering lookup or audio playback.
 *
 * `kind` is optional on a fingering card and absent === 'fingering', so every
 * board saved before text cards existed parses unchanged with no migration
 * pass — the CLAUDE.md "optional fields = use default" rule.
 */
export type CardKind = 'fingering' | 'text';

/** Card text overrides: per-slot, per-sub-field, all optional ("use the board default"). */
export type CardTextOverride = Partial<Record<TextKey, Partial<TextField>>>;

export interface FingeringCard {
  id: string;
  kind?: 'fingering';
  pitch: Pitch;
  fingeringIndex: number;
  display: CardDisplay;
  orientation: Orientation;
  scale: number;
  text?: CardTextOverride;
  style?: Partial<DiagramStyle>;
}

/**
 * A free text card: heading/subtitle/footer over at most one piece of art.
 *
 * `icon` (a `CardIconId`) and `image` (a `data:image/...` URI) are MUTUALLY
 * EXCLUSIVE — never both. That invariant is enforced in exactly one place,
 * `applyCardPatch` in `state/textCards.ts`, which every mutation and the
 * importer run through.
 *
 * It reuses `TextField`/`TextKey` rather than inventing its own fields, so the
 * existing size/align/show controls work on it unchanged. It has no pitch, so
 * it has no auto text and no wildcard resolution.
 */
export interface TextCard {
  id: string;
  kind: 'text';
  text?: CardTextOverride;
  icon?: string;
  image?: string;
  scale: number;
}

export type CardItem = FingeringCard | TextCard;

export const isTextCard = (c: CardItem): c is TextCard => c.kind === 'text';

/** The complement of `isTextCard`, for the many sites that want the pitch-bearing card. */
export const isFingeringCard = (c: CardItem): c is FingeringCard => c.kind !== 'text';

export type CardDraft = Omit<FingeringCard, 'id'>;
export type TextCardDraft = Omit<TextCard, 'id'>;

/**
 * A patch the `update` action accepts. It spans both kinds because the
 * reducer is kind-agnostic; `applyCardPatch` keeps the result well-formed.
 */
export type CardPatch = Partial<Omit<FingeringCard, 'id' | 'kind'> & Omit<TextCard, 'id' | 'kind'>>;

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

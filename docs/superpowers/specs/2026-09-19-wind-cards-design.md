# Wind Cards — design

Date: 2026-09-19
Status: approved in brainstorming, pending spec review

## Goal

A single-page builder for wind-instrument note cards. The user picks one instrument per board, selects a note on a virtual piano (in written or concert pitch), chooses a fingering, and adds a card showing the fingering diagram, the written note on a staff, or both. Cards collect on a board that exports to PNG, PDF and JSON. Structure follows chordl (`~/chordl`); the look is a light, bright Material-inspired Tailwind UI with soft glow.

## Scope

In:
- Changes to `fingering-components`: skill-level range data, verification, publish to npm as `@pepperhorn/fingering-components`.
- New app `ph-winds`: Astro 7 + one React 19 island, Tailwind v4, Poppins, Verovio (Bravura + Petaluma).
- One board in localStorage, JSON import/export, PNG/PDF export.
- Single-note playback with smplr: instrument voice and piano, at sounding pitch.

Out (YAGNI): multiple saved boards, share links, sequenced/multi-note playback, audio export, text-only cards, dark mode, accounts/backend.

## Part 0 — fingering-components changes

1. Add `ranges` to every `instruments/*.json`, in **written** pitch, inclusive:
   ```json
   "ranges": {
     "beginner":     { "low": "D4",  "high": "C6"  },
     "intermediate": { "low": "B♭3", "high": "E♭6" },
     "pro":          { "low": "B♭3", "high": "F♯6" }
   }
   ```
   - Pitch strings use the same spelling conventions as the fingering files (`Bb3`, `F#6` ASCII in JSON).
   - Bands nest: beginner ⊆ intermediate ⊆ pro.
   - Where horns differ in written range (e.g. saxophone has no difference; tin whistles are separate fingering files), a horn may override with `horns.<id>.ranges`. Only add overrides where real.
   - Values drafted from standard pedagogy, reviewed by the user before publish.
   - Saxophone `pro` may reach into `saxophone-altissimo.json`; the app loads both files for saxophone.
2. Extend `verify.mjs`: every range bound parses, bands nest, and every note in `pro` has at least one fingering in the instrument's fingering file(s). Report gaps rather than fail for chromatic holes that genuinely lack fingerings (whistles), via an explicit allow-list.
3. Rename the package to `@pepperhorn/fingering-components`, bump to `0.2.0`, publish publicly (`npm publish --access public`). The user confirms before publish.

## Part 1 — architecture

- **Astro 7** page `src/pages/index.astro` renders the shell (meta, fonts, background) and one island: `<WindCardsApp client:only="react" />`. The whole builder is interactive, so a single island sharing state is simplest.
- **Tailwind v4** via `@tailwindcss/vite`. Every element gets a semantic class name alongside utilities (`wc-card`, `wc-piano-key`, `btn-add-card`, …).
- **Poppins** via `@fontsource/poppins` (400/500/600/700).
- **pnpm**, TypeScript, Vitest, Playwright.
- Dev server: `pnpm dev -- --host 0.0.0.0`.

### Source layout

```
src/
  pages/index.astro
  app/WindCardsApp.tsx          island root: wires state to UI
  state/
    types.ts                    BoardState, CardItem, TextField, DiagramStyle
    useWindBoard.ts             reducer + actions
    storage.ts                  StorageAdapter, localStorage + memory adapters
    io.ts                       versioned JSON export/import + validation
  music/
    pitch.ts                    parse/format pitches, midi, written⇄concert
    instruments.ts              load instrument + fingering JSON, ranges, lookups
  notation/
    verovio.ts                  lazy WASM singleton, prefetch, font registration
    fonts.generated.ts          Bravura/Petaluma zips as base64 (build script)
    StaffNote.tsx               single written note → SVG via Verovio
  components/
    AppBar.tsx
    Builder.tsx                 preview + controls
    BoardSettings.tsx
    DiagramStyleControls.tsx
    TextFieldControls.tsx       heading/subtitle/footer editors
    Board.tsx                   grid, drag reorder, card toolbar
    WindCard.tsx                one card (used by preview and board)
    PianoDrawer.tsx             fixed bottom drawer
    PianoKeyboard.tsx           SVG keyboard with range bands
  audio/
    playback.ts                 smplr Soundfont loader + playNote(voice, midi)
    voices.ts                   instrument/horn → GM soundfont voice
  export/
    image.ts                    PNG/PDF via html-to-image + jsPDF
scripts/build-verovio-fonts.mjs
```

Each unit has one job. `WindCard` is pure: props in, card out, no store access, so the builder preview and the board render identically.

## Part 2 — data model

```ts
type PitchMode = 'written' | 'concert';
type MusicFont = 'bravura' | 'petaluma';
type CardDisplay = 'fingering' | 'both' | 'notation';
type Orientation = 'vertical' | 'horizontal';
type TextSize = 'S' | 'M' | 'L';
type Align = 'left' | 'center' | 'right';

interface TextField { text: string; show: boolean; size: TextSize; align: Align }
interface CardText { heading: TextField; subtitle: TextField; footer: TextField }

interface DiagramStyle {
  variants: string[];          // instrument's named variants, stacked in order
  look: 'solid' | 'dotted' | 'ghost';
  twoTone: boolean;            // right hand in secondary colour
  hints: boolean;
  primary: string;             // → --fc-ink (pressed keys)
  secondary: string;           // → --fc-ink-2 (right hand when twoTone)
}

interface WrittenPitch { step: 'C'|'D'|'E'|'F'|'G'|'A'|'B'; alter: -1|0|1; octave: number }

interface CardItem {
  id: string;
  pitch: WrittenPitch;         // always written pitch
  fingeringIndex: number;      // index among fingerings for that pitch (0 = primary)
  display: CardDisplay;
  orientation: Orientation;
  scale: number;               // 0.5–2.0, sizes diagram + staff together
  text?: Partial<Record<keyof CardText, Partial<TextField>>>;  // overrides board defaults
  style?: Partial<DiagramStyle>;                                // overrides board style
}

interface BoardMeta {
  instrument: string;          // fingering-components instrument id
  horn?: string;               // e.g. 'alto'
  pitchMode: PitchMode;
  musicFont: MusicFont;
  columns: number | 'auto';    // 1–4 or auto
  title: TextField; subtitle: TextField; footer: TextField;   // board chrome
  cardText: CardText;          // defaults for every card
  style: DiagramStyle;
  diagramOrient: 'vertical' | 'horizontal';  // board-wide only; cards cannot override
}

interface BoardState { version: 1; meta: BoardMeta; items: CardItem[] }
```

Rules:
- Optional fields mean "use the default", so stored JSON never needs migration for additive changes. `version` bumps only on breaking changes.
- Card text resolves field by field: card override → board `cardText` default. Empty heading text falls back to the auto label (e.g. `F♯4`). Empty subtitle falls back to `sounds E4` when the instrument transposes, otherwise hidden.
- Instrument (and horn) is locked while the board has cards; changing it asks to clear the board.
- Pitch mode only affects the piano labels and selection mapping. Notation on cards is **always written pitch**.

## Part 3 — music logic

- `pitch.ts`: parse `"F#4"`/`"Bb3"`, format with ♯/♭ for display, `toMidi`, `fromMidi(midi, preferFlat)`, `writtenToConcert(p, semis)`, `concertToWritten(p, semis)`. Semitones come from `transposeFor(layout, horn)` in fingering-components (negative = sounds lower).
- Spelling: the written pitch is taken from the fingering file's own spelling when a fingering exists at that midi number; otherwise sharps above the key, flats for B♭/E♭/A♭ by convention.
- `instruments.ts`:
  - `listInstruments()` → id, name, horns.
  - `fingeringsFor(instrument, horn, midi)` → all fingerings whose written pitch matches, primary first. Saxophone merges the altissimo file. Tin whistle picks the fingering file for the chosen horn (`tin-whistle-d.json`, etc.).
  - `rangeBands(instrument, horn)` → `{ beginner, intermediate, pro }` as midi spans (written).

## Part 4 — UI

Single column, max width ~1200px, order top to bottom:

1. **App bar** — wordmark "ph-winds", buttons: New, Import JSON, Export JSON, PNG, PDF.
2. **Builder card**
   - Left: live `WindCard` preview of the pending card.
   - Right: display (Fingering / Both / Notation) and orientation (Vertical / Horizontal) as segmented buttons; scale slider 50–200% (step 10); fingering alternates as small clickable thumbnails (primary first, selected one glows); heading/subtitle/footer overrides via `TextFieldControls` (text, show, S/M/L, align).
   - Primary action "Add to board". When editing an existing card, the button reads "Update card" with a "Cancel" link.
   - With no note selected, the preview shows a hint: "Pick a note on the keyboard below".
3. **Board settings** (collapsible sections as chips):
   - Instrument + horn select; Written / Concert toggle; Bravura / Petaluma; columns (auto, 1–4).
   - Diagram orientation (upright / sideways), board-wide.
   - Board title/subtitle/footer and card text defaults.
   - **Diagram style**: variant chips (multi-select, from the instrument's `variants`), look (Solid / Dotted / Ghost), two-tone hands, hints, primary + secondary colour (preset swatches plus custom picker).
4. **Board** — title and subtitle above the grid, footer below, editable in place. Grid of `WindCard`s honouring each card's scale/orientation. Drag-handle reorder (native HTML5 DnD, chordl style). Hover toolbar: edit (loads into builder), duplicate, delete. Empty state explains adding the first card.
5. **Piano drawer** — `position: fixed` at the bottom of the viewport, full width, with a handle tab to show/hide (state kept in localStorage; page gets bottom padding while open).
   - Spans the pro range plus 2 semitones margin each side, snapped to whole octaves' white keys.
   - Range bands drawn behind/under keys in soft tints: beginner mint, intermediate sky, pro lavender; legend at the left.
   - Keys outside pro range, or with no fingering, are dimmed and disabled.
   - Clicking selects the note; the selected key glows in the accent.
   - Labels follow pitch mode: in concert mode keys are concert pitch and clicking converts to written for the card.

### Card anatomy

- **Vertical**: heading, subtitle, fingering diagram, staff, footer (stacked, centred).
- **Horizontal**: heading and subtitle on top, diagram and staff side by side, footer below. The fingering diagram rotates only via the board's `diagramOrient` (independent of card orientation, not overridable per card).
- `display` hides the diagram or the staff.
- `scale` multiplies a base width for both diagram and staff.
- Text sizes: S/M/L map to 12/14/18px (heading), 11/12/14px (subtitle/footer).

### Rendering

- Fingering: `renderFingering(layout, fingering, { title: false, variant, look, orient: meta.diagramOrient, twoTone: twoTone ? 'hand' : undefined, hints, width })` with CSS vars `--fc-ink`, `--fc-ink-2`, `--fc-font: Poppins`.
- Staff: Verovio renders a one-note MEI (treble clef, or the instrument's clef — bass for trombone), no time signature, whole note, with the chosen font. Results are memoised by `(pitch, clef, font, width)`.
- Verovio loading follows chordl: dynamic `verovio/wasm` + `verovio/esm` import on the main thread, singleton promise that retries on failure, `prefetchVerovio()` after first paint unless save-data/slow connection. Fonts registered with `fontAddCustom` from zips built by `scripts/build-verovio-fonts.mjs`. While loading, the staff area shows a skeleton.

### Look

- Background `#f7f9fc` with a soft radial mesh wash; surfaces white.
- Cards: 16px radius, hairline border, soft coloured shadow ("glow") that brightens on hover and selection.
- One bright blue-violet accent, used for focus rings, selected key glow and primary buttons.
- Poppins throughout; Material-like controls (segmented buttons, filled/tonal buttons, sliders, chips) built with Tailwind.

## Part 4b — playback (smplr)

- `smplr` `Soundfont` players, lazily imported on first play, one shared `AudioContext` (created/resumed on the user gesture). Players are cached per voice with an in-flight promise map and retry after failure (chordl `audio/playback.ts` pattern).
- Two voices per board:
  - **Instrument voice**, mapped in `voices.ts`: saxophone → `soprano_sax` / `alto_sax` / `tenor_sax` / `baritone_sax` by horn; clarinet → `clarinet`; flute → `flute`; recorder → `recorder`; trumpet → `trumpet`; trombone → `trombone`; tin whistle → `whistle`; Nuvo Dood → `clarinet`; Nuvo TooT → `recorder`.
  - **Piano** → `acoustic_grand_piano`.
- Always plays **sounding (concert) pitch**: `midi = toMidi(written) + transposeFor(layout, horn)`, whatever the board's pitch mode. So both buttons play the same pitch in different timbres.
- One note, ~1.5 s, a new play stops the previous note.
- UI:
  - Each card (board and builder preview) shows two small icon buttons, "Play voice" and "Play piano", visible on hover/focus and always in the preview. Hidden in PNG/PDF export.
  - Piano drawer has a "Sound on click" toggle (default on, remembered) with a voice/piano choice; clicking a key selects it and plays it.
  - While a voice loads, its button shows a spinner; load failure shows a toast and leaves the UI usable.
- Unit tests: voice mapping for every instrument/horn; sounding midi for transposing horns (alto written C5 → concert E♭4 = midi 63).

## Part 5 — persistence and export

- `StorageAdapter { load(): BoardState | null; save(s: BoardState): void }`; `localStorageAdapter('ph-winds-board', { onError })` never throws, reports quota errors via a toast.
- JSON export/import is versioned and validated field by field; invalid files show an error and leave the board unchanged.
- PNG/PDF export renders the board element (title → footer) with `html-to-image` and `jsPDF`. Export waits for pending Verovio renders.

## Part 6 — testing

- **fingering-components**: `verify.mjs` range checks (Part 0).
- **Vitest** (ph-winds): pitch parse/format and written⇄concert per instrument/horn; `rangeBands` output; `fingeringsFor` including alternates, altissimo merge and whistle horn files; JSON import validation (valid, missing fields, bad version); card text resolution (override → default → auto label).
- **Playwright smoke**: choose alto sax, click a piano key, pick an alternate, add card, reload and confirm the card persists; click Play voice and confirm no error (audio stubbed); switch to Petaluma and confirm the staff `<svg>` renders.

## Part 7 — deployment

- Astro static build (`output: 'static'`) to `dist`.
- `nixpacks.toml` as chordl: `pnpm install && pnpm build`, serve with `npx serve dist -l 3000`; `/healthz` static file for Coolify.
- Deploy target: Coolify (pepperhorn), set up after the app works locally.

## Build order

1. fingering-components: ranges + verify + npm rename/publish.
2. ph-winds scaffold: Astro, React, Tailwind, fonts, lint/test config.
3. Music logic (`pitch.ts`, `instruments.ts`) with tests.
4. State, storage, JSON io with tests.
5. Verovio loader + `StaffNote`.
6. `WindCard`, then Builder, BoardSettings, Board, PianoDrawer.
7. smplr playback.
8. Export, Playwright smoke, deploy config.

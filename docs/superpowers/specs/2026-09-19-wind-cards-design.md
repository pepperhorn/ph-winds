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
    verovio.ts                  lazy WASM singleton, prefetch, lazy per-font registration
    verovio-font-bravura.generated.ts, verovio-font-petaluma.generated.ts
                                 Bravura/Petaluma zips as base64, one module each (build script)
    StaffNote.tsx               single written note → SVG via Verovio; shows a "Loading notation…"
                                 spinner while the toolkit itself isn't ready yet, a light skeleton
                                 once it's ready but this note is still queued
  components/
    AppBar.tsx
    Builder.tsx                 instrument/horn/pitch/font/diagram/columns strip, preview + controls, embedded piano panel
    instrumentIcons.ts          instrument id → bundled icon asset
    BoardSettings.tsx
    DiagramStyleControls.tsx
    TextFieldControls.tsx       heading/subtitle/footer editors
    Board.tsx                   grid, drag reorder, card toolbar
    WindCard.tsx                one card (used by preview and board); renders the unavailable/grey state
    PianoPanel.tsx               collapsible panel embedded at the bottom of the Builder card (was a fixed bottom drawer)
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
- Card text resolves field by field: card override → board `cardText` default. Empty heading text falls back to the auto label. For an accidental, the auto label pairs both enharmonic spellings flat-first, e.g. `G♭4 / F♯4`; a natural pitch (including an enharmonic-natural spelling like `C♭4`) is unchanged, e.g. `C4` or `C♭4`. Empty subtitle falls back to `Concert Pitch: E4` when the instrument transposes, otherwise hidden.
- Switching instrument or horn never clears the board or asks for confirmation. Every card **keeps its sounding (concert) pitch**: the reducer computes the semitone delta between the old and new instrument/horn, applies it to each card's written midi, and re-spells the result from the target instrument's own fingering chart (falling back to chromatic respelling when the target chart has no fingering at that midi). Each remapped card's `fingeringIndex` resets to `0` (primary fingering). Diagram-style `variants` reset to the default set only when the *instrument* id actually changes — a horn-only switch (e.g. alto sax → tenor sax) keeps the user's chosen variants, since variant names are layout-scoped, not horn-scoped.
- A card whose remapped pitch has no fingering on the current instrument/horn becomes an **unavailable** card (see "Card anatomy" below) rather than being dropped or blocking the switch. Switching to an instrument where nothing on the board fits yields an all-grey board.
- Pitch mode only affects the piano labels and selection mapping. Notation on cards is **always written pitch**.

## Part 3 — music logic

- `pitch.ts`: parse `"F#4"`/`"Bb3"`, format with ♯/♭ for display, `toMidi`, `fromMidi(midi, preferFlat)`, `writtenToConcert(p, semis)`, `concertToWritten(p, semis)`. Semitones come from `transposeFor(layout, horn)` in fingering-components (negative = sounds lower).
- Spelling: the written pitch is taken from the fingering file's own spelling when a fingering exists at that midi number; otherwise sharps above the key, flats for B♭/E♭/A♭ by convention.
- `instruments.ts`:
  - `listInstruments()` → id, name, `shortName` (compact display name for the icon picker and "not available on …" text — e.g. "Tin whistle" vs. the full `name`'s parentheticals), horns.
  - `fingeringsFor(instrument, horn, midi)` → all fingerings whose written pitch matches, primary first. Saxophone merges the altissimo file. Tin whistle picks the fingering file for the chosen horn (`tin-whistle-d.json`, etc.).
  - `hasFingering(instrument, horn, midi)` → shared predicate (`fingeringsFor(...).length > 0`) used by both the card renderer and the board grid to decide whether a card is available, so the "no fingering" check only ever lives in one place.
  - `rangeBands(instrument, horn)` → `{ beginner, intermediate, pro }` as midi spans (written).

## Part 4 — UI

Single column, max width ~1200px, order top to bottom:

1. **App bar** — wordmark "ph-winds", buttons: New, Import JSON, Export JSON, PNG, PDF.
2. **Builder card** — holds the settings strip, the pending-card preview/controls, and the embedded piano panel:
   - **Settings strip** (`role="group" aria-label="Board settings"`): instrument icon picker (see below) on its own line, then horn select, then four captioned groups of segmented controls that wrap independently at narrow widths — each a `role="group"` `<div>` with a small muted (`text-[11px]`, `wc-settings-caption`) caption above its `Segmented` control, `aria-labelledby`-linked to the caption without touching the `Segmented`'s own `aria-label` (which stays "Pitch" / "Music font" / "Diagram" / "Columns" for tests): **"Written as:"** → pitch mode ("Played" = written, "Concert Pitch (Piano)" = concert), **"Notation:"** → music font ("Standard" = bravura, "Handwritten" = petaluma), **"Orientation:"** → diagram orientation (Upright / Sideways, board-wide), **"Cards per Row:"** → columns (Auto, 1–4). Stored values for pitch mode and music font are unchanged (`written`/`concert`, `bravura`/`petaluma`) — only the visible labels changed.
     - **Instrument icon picker** replaces the old instrument `<select>`: a `role="radiogroup" aria-label="Instrument"` row of ~44px rounded-xl icon buttons (`role="radio"`, one per `listInstruments()` entry, in that order), each a black silhouette PNG (`src/icons/*.png`, mapped in `instrumentIcons.ts`) left un-tinted. Unselected icons are muted (`opacity-50 grayscale`, brightening on hover); the selected icon is full-opacity with an accent-soft background, accent ring and glow. Each button's accessible name is the instrument's full name (e.g. "Flute (Boehm, C foot)"); the `<img>` itself is decorative (`alt=""`). Wraps to a second row on narrow viewports (~390px). The horn `<select>` is unaffected by this change.
   - **Preview** — live `WindCard` preview of the pending card, with the unavailable hint below it when the picked note has no fingering on the current instrument/horn (see "Card anatomy").
   - **Controls** — display (Fingering / Both / Notation) and orientation (Vertical / Horizontal) as segmented buttons; scale slider 50–200% (step 10); fingering alternates as small clickable thumbnails (primary first, selected one glows); heading/subtitle/footer overrides via `TextFieldControls` (text, show, S/M/L, align).
   - Primary action "Add to board" (`aria-describedby` pointing at the unavailable hint when disabled for that reason). When editing an existing card, the button reads "Update card" with a "Cancel" link.
   - With no note selected, the preview shows a hint: "Pick a note on the keyboard below".
   - **Piano panel** — embedded at the bottom of the Builder card, in normal page flow (not a fixed overlay); see item 5 below.
3. **Board settings** (collapsible sections as chips) — now scoped to purely visual/text defaults, since instrument/horn/pitch/font/diagram-orientation/columns moved into the Builder card's settings strip (item 2):
   - **Diagram style**: variant chips (multi-select, from the instrument's `variants`), look (Solid / Dotted / Ghost), two-tone hands, hints, primary + secondary colour (preset swatches plus custom picker).
   - **Text**: board title/subtitle/footer and card text defaults.
4. **Board** — title and subtitle above the grid, footer below, editable in place. Grid of `WindCard`s honouring each card's scale/orientation. Drag-handle reorder (native HTML5 DnD, chordl style). Hover toolbar: edit (loads into builder), duplicate, delete. Empty state explains adding the first card. A card with no fingering on the current instrument/horn renders greyed out (see "Card anatomy") and is excluded from PNG/PDF export, including the grid wrapper around it, so it leaves neither a gap (auto columns) nor a blank cell (fixed columns).
5. **Piano panel** — embedded as the bottom section of the Builder card (item 2), spanning its full width, in normal page flow (no longer a `position: fixed` bottom drawer). A header row (legend, "Sound on click" + voice select, and the show/hide toggle) is always visible; the show/hide toggle ("Hide keyboard ▾" / "Show keyboard ▴", state kept in localStorage) collapses/expands the keyboard itself below that row — no page bottom-padding compensation is needed since the panel no longer floats over content.
   - Spans the pro range plus 2 semitones margin each side, snapped to whole octaves' white keys.
   - Range bands drawn behind/under keys in soft tints: beginner mint, intermediate sky, pro lavender; legend at the left.
   - Keys outside pro range, or with no fingering, are dimmed and disabled.
   - Clicking selects the note; the selected key glows in the accent.
   - Labels follow pitch mode: in concert mode keys are concert pitch and clicking converts to written for the card.
   - Sized to the Builder card's own width (a `ResizeObserver` on the panel, not the viewport), with horizontal scroll for overflow.

### Card anatomy

- **Vertical**: heading, subtitle, fingering diagram, staff, footer (stacked, centred).
- **Horizontal**: heading and subtitle on top, diagram and staff side by side, footer below. The fingering diagram rotates only via the board's `diagramOrient` (independent of card orientation, not overridable per card).
- `display` hides the diagram or the staff.
- `scale` multiplies a base width for both diagram and staff.
- Text sizes: S/M/L map to 12/14/18px (heading), 11/12/14px (subtitle/footer).
- **Unavailable state** (derived, never stored): when `hasFingering(instrument, horn, writtenMidi)` is false for a card's remapped pitch, `WindCard` renders a greyed-out placeholder instead of the normal diagram/staff layout — no fingering diagram, no staff, no play buttons. It shows the pitch (via `formatPitchPair`, so an unavailable accidental still gets its sharp/flat pairing) and, if the user set their own heading text for that card, that heading text; otherwise the "not available on …" line. The card and its board-grid wrapper both carry `data-export-hide`, so an unavailable card is skipped entirely by PNG/PDF export (no gap, no blank cell) but is kept as normal in the saved/exported JSON — it's a render-time, not a data, concept. In the Builder, an unavailable draft shows the same greyed preview and disables "Add to board" with the "Pick another note…" hint.

### Rendering

- Fingering: `renderFingering(layout, fingering, { title: false, variant, look, orient: meta.diagramOrient, twoTone: twoTone ? 'hand' : undefined, hints, width })` with CSS vars `--fc-ink`, `--fc-ink-2`, `--fc-font: Poppins`.
- Staff: Verovio renders a one-note MEI (treble clef, or the instrument's clef — bass for trombone), no time signature, whole note, with the chosen font. Results are memoised by `(pitch, clef, font, width)`.
- Verovio loading follows chordl: dynamic `verovio/wasm` + `verovio/esm` import on the main thread, singleton promise that retries on failure, `prefetchVerovioWhenIdle()` after first paint (idle callback, unless save-data/slow connection) pre-warms the toolkit and the board's current default font. Only the font actually being rendered is registered via `fontAddCustom` on first use (dynamically importing that font's generated module from `scripts/embed-verovio-fonts.mjs`'s output); switching to the other font registers it lazily on first use and is free on every switch after that. While the toolkit itself is still loading, the staff area shows a "Loading notation…" spinner (`role="status" aria-live="polite"`, respects `prefers-reduced-motion`); once the toolkit is ready but a given note is still queued behind the serial render queue, it shows the lighter skeleton pulse instead.

### Look

- Background `#f7f9fc` with a soft radial mesh wash; surfaces white.
- Cards: 16px radius, hairline border, soft coloured shadow ("glow") that brightens on hover and selection.
- One bright blue-violet accent, used for focus rings, selected key glow and primary buttons.
- Poppins throughout; Material-like controls (segmented buttons, filled/tonal buttons, sliders, chips) built with Tailwind.

## Part 4b — playback (smplr)

- `smplr` 1.x `Soundfont(ctx, { instrument, kit })` players (await `.ready`), lazily imported on first play, one shared `AudioContext` (created/resumed on the user gesture). Players are cached per voice with an in-flight promise map and retry after failure (chordl `audio/playback.ts` pattern).
- **Load only what is needed**: nothing loads until the first play; then only the voice that was asked for (the board's instrument voice or the piano), never the full catalogue. Changing instrument drops the old voice's player.
- **Sources** (all allow commercial use):
  - `FluidR3_GM` via smplr `Soundfont` (the lighter of smplr's two gleitz midi-js-soundfonts kits; FluidR3 is MIT, gleitz renders CC BY 3.0) for every voice except the fipple/recorder voice. No `SplendidGrandPiano`.
  - **VCSL** (Versilian Community Sample Library, **CC0**) via smplr `Versilian`, instrument `Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain`, for recorder and all tin whistles. Loads only that one SFZ and its samples from `smpldsnds.github.io/sgossner-vcsl`. smplr marks Versilian support as partial, so if it fails to load or the note is out of its sample range, fall back to `FluidR3_GM` `recorder`.
  - An About/credits dialog lists FluidR3 (Frank Wen), gleitz midi-js-soundfonts, VCSL (Sam Gossner) and Verovio/SMuFL fonts.
- Two voices per board:
  - **Instrument voice**, mapped in `voices.ts`: saxophone → `soprano_sax` / `alto_sax` / `tenor_sax` / `baritone_sax` by horn; clarinet → `clarinet`; flute → `flute`; recorder → VCSL soprano recorder; trumpet → `trumpet`; trombone → `trombone`; Nuvo Dood → `clarinet`; Nuvo TooT → `flute`; tin whistle (all keys) → VCSL soprano recorder (GM has no tin whistle and GM `whistle` is a human whistle; the only tin whistle sample set found, MF Tin Whistle, is CC BY-NC-SA, so it is excluded).
  - **Piano** → `acoustic_grand_piano` from `FluidR3_GM` (small multisample, not the Splendid grand).
- Always plays **sounding (concert) pitch**: `midi = toMidi(written) + transposeFor(layout, horn)`, whatever the board's pitch mode. So both buttons play the same pitch in different timbres.
- One note, ~1.5 s, a new play stops the previous note.
- UI:
  - Each card (board and builder preview) shows two small icon buttons, "Play voice" and "Play piano", visible on hover/focus and always in the preview. Hidden in PNG/PDF export.
  - Piano drawer has a "Sound on click" toggle (default on, remembered) with a voice/piano choice; clicking a key selects it and plays it.
  - While a voice loads, its button shows a spinner; load failure shows a toast and leaves the UI usable.
- Unit tests: voice mapping (source + name) for every instrument/horn; VCSL→FluidR3 fallback; sounding midi for transposing horns (alto written C5 → concert E♭4 = midi 63).

## Part 5 — persistence and export

- `StorageAdapter { load(): BoardState | null; save(s: BoardState): void }`; `localStorageAdapter('ph-winds-board', { onError })` never throws, reports quota errors via a toast.
- JSON export/import is versioned and validated field by field; invalid files show an error and leave the board unchanged.
- PNG/PDF export renders the board element (title → footer) with `html-to-image` and `jsPDF`. Export waits for pending Verovio renders.

## Part 6 — testing

- **fingering-components**: `verify.mjs` range checks (Part 0).
- **Vitest** (ph-winds): pitch parse/format and written⇄concert per instrument/horn; `rangeBands` output; `fingeringsFor` including alternates, altissimo merge and whistle horn files; JSON import validation (valid, missing fields, bad version); card text resolution (override → default → auto label).
- **Playwright smoke**: choose alto sax, click a piano key, pick an alternate, add card, reload and confirm the card persists; click Play voice and confirm no error (audio stubbed); switch to Handwritten and confirm the staff `<svg>` renders.

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
6. `WindCard`, then Builder, BoardSettings, Board, PianoPanel.
7. smplr playback.
8. Export, Playwright smoke, deploy config.

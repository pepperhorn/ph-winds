# ph-winds

Astro 7 + React 19 + Tailwind v4 app (one React island) that renders wind-instrument
fingering/notation cards, built on `@pepperhorn/fingering-components`.

## Stack
- Astro 7 (`output: 'static'`), `@astrojs/react`, Tailwind v4 via `@tailwindcss/vite`.
- Single React island: `src/app/WindCardsApp.tsx`, mounted with `client:only="react"`.
- `@/` path alias → `src/`.
- pnpm, Node ≥ 22.

## Commands
- `pnpm dev` — dev server, binds `0.0.0.0` (`astro dev --host 0.0.0.0`).
- `pnpm build` — static build to `dist/`.
- `pnpm preview` — preview the build, also binds `0.0.0.0`.
- `pnpm test` — Vitest unit tests.
- `pnpm e2e` — Playwright end-to-end tests.
- `pnpm verify` — `astro check && vitest run`.

## Global constraints
- Package manager: pnpm. Node ≥ 22.
- Every JSX element gets a semantic class name before its Tailwind utilities, e.g.
  `className="wc-card rounded-2xl ..."`. Prefix app classes with `wc-`, buttons with `btn-`.
- Font: Poppins everywhere in UI (`@fontsource/poppins` 400/500/600/700).
- Dev server always: `pnpm dev` (binds `0.0.0.0`).
- Cards store and notate **written** pitch. Concert pitch only changes piano
  labels/selection. Playback always sounds **concert** pitch.
- Optional fields = "use default"; never write migration code for additive fields.
- Light theme only. Accent `#6d5dfc` (blue-violet). Background `#f7f9fc`. Range tints:
  beginner `#d9f5e8` (mint), intermediate `#dbeafe` (sky), pro `#ede4ff` (lavender).
- Audio sources: smplr `Soundfont` kit `FluidR3_GM`; VCSL
  `Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain`
  (sample range midi 72–98). Never `SplendidGrandPiano`.

## Workflow
- Commit as you go.

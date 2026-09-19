# Wind Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ph-winds — an Astro 7 + React app where a user picks a wind instrument, selects notes on a range-banded piano, and composes a board of fingering/notation cards with playback and export.

**Architecture:** One Astro page hosts a single `client:only="react"` island. Pure TypeScript modules own music logic (`src/music`), board state (`src/state`), notation (`src/notation`) and audio (`src/audio`); React components in `src/components` are thin views over them. Fingering data and diagrams come from `@pepperhorn/fingering-components` (published from `~/fingering-components` in Tasks 1–2).

**Tech Stack:** Astro 7, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), `@fontsource/poppins`, Verovio 6 (WASM, Bravura + Petaluma), smplr 1.x, html-to-image, jsPDF, Vitest + Testing Library (jsdom), Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-19-wind-cards-design.md` — read it before any task.

## Global Constraints

- Package manager: **pnpm**. Node ≥ 22.
- Every JSX element gets a semantic class name before its Tailwind utilities, e.g. `className="wc-card rounded-2xl ..."`. Prefix app classes with `wc-`, buttons with `btn-`.
- Font: **Poppins** everywhere in UI (`@fontsource/poppins` 400/500/600/700).
- Dev server always: `pnpm dev --host 0.0.0.0`.
- Cards store and notate **written** pitch. Concert pitch only changes piano labels/selection. Playback always sounds **concert** pitch.
- Optional fields = "use default"; never write migration code for additive fields.
- Light theme only. Accent `#6d5dfc` (blue-violet). Background `#f7f9fc`. Range tints: beginner `#d9f5e8` (mint), intermediate `#dbeafe` (sky), pro `#ede4ff` (lavender).
- Audio sources: smplr `Soundfont` kit `FluidR3_GM`; VCSL `Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain` (sample range midi 72–98). Never `SplendidGrandPiano`.
- Commit at the end of each task with a message ending in the two lines:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FDhLyH6CXkkuUdAtjhvzmY
  ```
- Work on a branch `feat/wind-cards` in ph-winds; `feat/ranges` in fingering-components.

## File Map

```
~/fingering-components
  instruments/*.json            + "ranges" (Task 1)
  verify.mjs                    + range checks (Task 1)
  package.json                  name → @pepperhorn/fingering-components, 0.2.0 (Task 1)

~/ph-winds
  astro.config.mjs, tsconfig.json, vitest.config.ts, playwright.config.ts, nixpacks.toml
  public/healthz, public/favicon.svg
  src/pages/index.astro
  src/styles/global.css
  src/types/fingering-components.d.ts
  src/music/pitch.ts            (+ .test.ts)
  src/music/instruments.ts      (+ .test.ts)
  src/state/types.ts
  src/state/defaults.ts
  src/state/resolve.ts          (+ .test.ts)
  src/state/boardReducer.ts     (+ .test.ts)
  src/state/storage.ts          (+ .test.ts)
  src/state/io.ts               (+ .test.ts)
  src/state/useWindBoard.ts
  src/notation/mei.ts           (+ .test.ts)
  src/notation/verovio.ts
  src/notation/verovio-fonts.generated.ts   (copied from chordl)
  src/notation/verovio-modules.d.ts         (copied from chordl)
  src/notation/StaffNote.tsx
  src/audio/voices.ts           (+ .test.ts)
  src/audio/playback.ts
  src/components/FingeringView.tsx
  src/components/WindCard.tsx   (+ .test.tsx)
  src/components/ui.tsx         (Segmented, Chip, Slider, IconButton, Swatches)
  src/components/TextFieldControls.tsx
  src/components/Builder.tsx
  src/components/DiagramStyleControls.tsx
  src/components/BoardSettings.tsx
  src/components/Board.tsx
  src/components/PianoKeyboard.tsx  (+ pianoLayout.ts + .test.ts)
  src/components/PianoDrawer.tsx
  src/components/AppBar.tsx
  src/components/AboutDialog.tsx
  src/components/Toast.tsx
  src/export/image.ts
  src/app/WindCardsApp.tsx
  e2e/smoke.spec.ts
```

---

## Part A — fingering-components

### Task 1: Skill-level ranges, verification, package rename

Work in `~/fingering-components` on branch `feat/ranges`.

**Files:**
- Modify: `instruments/*.json` (all 9), `verify.mjs`, `package.json`, `README.md`

**Interfaces:**
- Produces: `layout.ranges = { beginner, intermediate, pro }`, each `{ low: string, high: string }` in written pitch (ASCII `Bb3`, `F#6`). Optional per-horn override `layout.horns[h].ranges` with the same shape. Consumed by ph-winds `rangeBands()` (Task 5).

- [ ] **Step 1: Branch**

```bash
cd ~/fingering-components && git checkout -b feat/ranges
```

- [ ] **Step 2: Write the failing range checks in `verify.mjs`**

Append after the existing fingering loop:

```js
// --- skill-level ranges -------------------------------------------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (s) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad pitch "${s}"`);
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
const fmidi = (fg) => midi(`${fg.note}${fg.octave}`);
// which fingering sheets belong to an instrument (+ horn)
const sheetsFor = (id, horn) => readdirSync('fingerings')
  .map((f) => J(`fingerings/${f}`))
  .filter((d) => d.instrument === id && (!d.horn || !horn || d.horn === horn));
// chromatic notes an instrument genuinely cannot finger (reported, not fatal)
const RANGE_GAPS_OK = {};
const LEVELS = ['beginner', 'intermediate', 'pro'];
for (const f of readdirSync('instruments')) {
  const inst = J(`instruments/${f}`);
  const hornIds = inst.horns ? Object.keys(inst.horns) : [undefined];
  for (const horn of hornIds) {
    const r = (horn && inst.horns[horn].ranges) || inst.ranges;
    if (!r) throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: "ranges" is required`);
    const span = LEVELS.map((l) => {
      if (!r[l]) throw new Error(`${inst.id}: ranges.${l} missing`);
      const lo = midi(r[l].low), hi = midi(r[l].high);
      if (lo > hi) throw new Error(`${inst.id}: ranges.${l} low > high`);
      return [lo, hi];
    });
    for (let i = 1; i < span.length; i++) {
      if (span[i][0] > span[i - 1][0] || span[i][1] < span[i - 1][1])
        throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: ranges.${LEVELS[i - 1]} must sit inside ranges.${LEVELS[i]}`);
    }
    const sheets = sheetsFor(inst.id, horn);
    if (!sheets.length) continue;          // layout without fingering data yet
    const have = new Set(sheets.flatMap((d) => d.fingerings.filter((fg) => fg.note).map(fmidi)));
    const [lo, hi] = span[2];
    const gaps = [];
    for (let m = lo; m <= hi; m++) if (!have.has(m)) gaps.push(m);
    const allowed = new Set(RANGE_GAPS_OK[`${inst.id}${horn ? `/${horn}` : ''}`] || []);
    const bad = gaps.filter((m) => !allowed.has(m));
    if (bad.length) throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: pro range has no fingering for midi ${bad.join(', ')}`);
    console.log(`${(inst.id + (horn ? `/${horn}` : '')).padEnd(22)} ranges ok`);
  }
}
```

- [ ] **Step 3: Run it to see it fail**

Run: `node verify.mjs`
Expected: FAIL with `clarinet: "ranges" is required` (or the first instrument alphabetically).

- [ ] **Step 4: Add `ranges` to every instrument JSON**

Insert a top-level `"ranges"` key after `"transpose"` in each file (keep the file's existing formatting style). Values (written pitch; drafted from standard pedagogy — the user reviews them in Step 7):

| file | beginner | intermediate | pro |
| --- | --- | --- | --- |
| `saxophone.json` | D4–C6 | Bb3–F6 | Bb3–F7 |
| `clarinet.json` | E3–C5 | E3–C6 | E3–A6 |
| `flute.json` | D4–D6 | C4–G6 | C4–C7 |
| `recorder.json` | D4–D5 | C4–A5 | C4–C6 |
| `trumpet.json` | C4–C5 | F#3–G5 | F#3–C6 |
| `trombone.json` | F2–D4 | E2–F4 | E2–C5 |
| `nuvo-dood.json` | C4–A4 | C4–C5 | C4–D5 |
| `nuvo-toot.json` | C4–A4 | C4–D5 | C4–G5 |
| `tin-whistle.json` (top level = D) | D5–D6 | D5–A6 | D5–B6 |

Example (`flute.json`):

```json
"ranges": {
  "beginner":     { "low": "D4", "high": "D6" },
  "intermediate": { "low": "C4", "high": "G6" },
  "pro":          { "low": "C4", "high": "C7" }
},
```

Tin whistle: each fingering sheet is written at that whistle's real pitch, so add `ranges` inside each horn of `tin-whistle.json`'s `"horns"`:

| horn | beginner | intermediate | pro |
| --- | --- | --- | --- |
| D | D5–D6 | D5–A6 | D5–B6 |
| C | C5–C6 | C5–G6 | C5–A6 |
| Bb | Bb4–Bb5 | Bb4–F6 | Bb4–G6 |
| Eb | Eb5–Eb6 | Eb5–Bb6 | Eb5–C7 |
| F | F5–F6 | F5–C7 | F5–D7 |

Saxophone pro reaches F7 through `fingerings/saxophone-altissimo.json`; `sheetsFor` already merges both saxophone sheets.

- [ ] **Step 5: Run verify until green**

Run: `node verify.mjs`
Expected: every instrument prints its existing lines plus `… ranges ok` for each instrument/horn, exit 0. If an instrument reports gaps, read its fingering sheet: if the note truly has no fingering on that instrument, add it to `RANGE_GAPS_OK` (key `"id"` or `"id/horn"`, value array of midi numbers) with a comment naming the note; otherwise fix the range.

- [ ] **Step 6: Rename + document**

`package.json`: set `"name": "@pepperhorn/fingering-components"`, `"version": "0.2.0"`, add `"repository": { "type": "git", "url": "git+https://github.com/pepperhorn/fingering-components.git" }`, `"publishConfig": { "access": "public" }`, and add `"./package.json": "./package.json"` to `exports`.

README: add a `## Ranges` section after `## Pitch`:

```md
## Ranges

Every layout carries `ranges` — three nested skill bands at **written** pitch:

​```json
"ranges": { "beginner": { "low": "D4", "high": "C6" }, "intermediate": { … }, "pro": { … } }
​```

A horn may override with its own `ranges` (tin whistles do: each sheet is at
that whistle's pitch). `verify.mjs` checks the bands nest and that every note
in `pro` has a fingering.
```

and change install/import examples from `fingering-components` to `@pepperhorn/fingering-components`.

- [ ] **Step 7: Commit, push, PR, pause for review of range values**

```bash
git add -A && git commit -m "Ranges: beginner/intermediate/pro bands per instrument; scoped package name"
git push -u origin feat/ranges
gh pr create --title "Skill-level ranges + @pepperhorn scope" --body "…"
```

Report the range table to the user and wait for approval/edits before Task 2.

### Task 2: Publish to npm (user-gated)

- [ ] **Step 1:** After the user approves the ranges and says to publish, merge the PR (`gh pr merge --merge`), `git checkout main && git pull`.
- [ ] **Step 2:** `npm whoami` → expect `pepperhorn`. `node verify.mjs` → green. `npm pack --dry-run` → lists only `src`, `instruments`, `fingerings`, `README.md`, `LICENSE`, `package.json`.
- [ ] **Step 3:** `npm publish` (access is public via publishConfig). Then `npm view @pepperhorn/fingering-components version` → `0.2.0`.
- [ ] **Step 4:** `git tag v0.2.0 && git push --tags`.

---

## Part B — ph-winds

All Part B work: `cd ~/ph-winds && git checkout -b feat/wind-cards` (once, at Task 3).

### Task 3: Scaffold

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/pages/index.astro`, `src/styles/global.css`, `src/app/WindCardsApp.tsx`, `src/types/fingering-components.d.ts`, `src/test/setup.ts`, `public/healthz`, `public/favicon.svg`, `nixpacks.toml`, `.gitignore`, `CLAUDE.md`
- Test: `src/app/scaffold.test.ts`

**Interfaces:**
- Produces: `pnpm dev|build|test|verify` scripts; `@/` path alias → `src/`; module types for `@pepperhorn/fingering-components`.

- [ ] **Step 1: Create the Astro project in place**

```bash
cd ~/ph-winds
pnpm create astro@latest . --template minimal --typescript strict --install --no-git --skip-houston --yes
pnpm astro add react tailwind --yes
pnpm add @pepperhorn/fingering-components@^0.2.0 @fontsource/poppins verovio@^6 smplr@^1 html-to-image jspdf
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

(If Task 2 hasn't published yet, temporarily `pnpm add @pepperhorn/fingering-components@link:../fingering-components` and switch to `^0.2.0` before Task 15.)

Confirm `astro --version` reports 7.x. The existing `README.md` and `LICENSE` must survive; restore them from git if the template overwrote them.

- [ ] **Step 2: Config**

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: { host: '0.0.0.0' },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    optimizeDeps: { exclude: ['verovio'] },
  },
});
```

`tsconfig.json` — extend `astro/tsconfigs/strict`, add `"compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] }, "jsx": "react-jsx", "jsxImportSource": "react", "resolveJsonModule": true }`.

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`src/test/setup.ts`: `import '@testing-library/jest-dom/vitest';`

`package.json` scripts: `"dev": "astro dev --host 0.0.0.0"`, `"build": "astro build"`, `"preview": "astro preview --host 0.0.0.0"`, `"test": "vitest run"`, `"e2e": "playwright test"`, `"verify": "astro check && vitest run"`. Add `@astrojs/check` and `typescript` as dev deps for `astro check`.

- [ ] **Step 3: Module types for the JS library**

`src/types/fingering-components.d.ts`:

```ts
declare module '@pepperhorn/fingering-components' {
  export interface Fingering {
    note?: string; octave?: number; label?: string; note_text?: string;
    down?: string[]; half?: string[]; ring?: string[]; optional?: string[]; trill?: string[];
    overblow?: boolean; states?: Record<string, string>;
    alternates?: Omit<Fingering, 'alternates'>[];
  }
  export interface RangeBand { low: string; high: string }
  export interface Ranges { beginner: RangeBand; intermediate: RangeBand; pro: RangeBand }
  export interface Layout {
    id: string; name: string; family: string; transpose: number;
    horn?: string; horns?: Record<string, { name: string; transpose: number; ranges?: Ranges }>;
    ranges?: Ranges; viewBox: [number, number, number, number];
    variants?: Record<string, unknown>; keys: unknown[];
  }
  export interface RenderOptions {
    title?: boolean; width?: number; variant?: string | string[];
    look?: 'dotted' | 'ghost'; twoTone?: 'hand'; hints?: boolean;
    orient?: 'vertical' | 'horizontal'; pitch?: 'written' | 'concert'; horn?: string;
  }
  export function renderFingering(layout: Layout, f: Fingering, opts?: RenderOptions): string;
  export function transposeFor(layout: Layout, horn?: string): number;
  export function sounding(layout: Layout, f: Fingering, opts?: { horn?: string }): { note: string; octave: number | null };
}
declare module '@pepperhorn/fingering-components/instruments/*.json' {
  const layout: import('@pepperhorn/fingering-components').Layout; export default layout;
}
declare module '@pepperhorn/fingering-components/fingerings/*.json' {
  const sheet: { instrument: string; horn?: string; pitch: 'written'; note?: string;
    fingerings: import('@pepperhorn/fingering-components').Fingering[] };
  export default sheet;
}
```

- [ ] **Step 4: Shell page, styles, island stub**

`src/styles/global.css`:

```css
@import "tailwindcss";
@import "@fontsource/poppins/400.css";
@import "@fontsource/poppins/500.css";
@import "@fontsource/poppins/600.css";
@import "@fontsource/poppins/700.css";

@theme {
  --font-sans: "Poppins", system-ui, sans-serif;
  --color-accent: #6d5dfc;
  --color-accent-soft: #ece9ff;
  --color-surface: #ffffff;
  --color-canvas: #f7f9fc;
  --color-ink: #1c2233;
  --color-muted: #667085;
  --color-hairline: #e6e9f2;
  --color-band-beginner: #d9f5e8;
  --color-band-intermediate: #dbeafe;
  --color-band-pro: #ede4ff;
  --shadow-glow: 0 1px 2px rgb(28 34 51 / .06), 0 8px 24px -8px rgb(109 93 252 / .25);
  --shadow-glow-strong: 0 2px 4px rgb(28 34 51 / .08), 0 12px 32px -6px rgb(109 93 252 / .45);
}

html { background: var(--color-canvas); color: var(--color-ink); }
body {
  font-family: var(--font-sans);
  min-height: 100vh;
  background:
    radial-gradient(60rem 40rem at 10% -10%, #efeaff 0%, transparent 60%),
    radial-gradient(50rem 36rem at 110% 10%, #e3f1ff 0%, transparent 55%),
    var(--color-canvas);
}
```

`src/pages/index.astro`:

```astro
---
import '@/styles/global.css';
import WindCardsApp from '@/app/WindCardsApp';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.svg" />
    <title>ph-winds · Wind cards</title>
    <meta name="description" content="Build fingering and notation cards for wind instruments." />
  </head>
  <body>
    <WindCardsApp client:only="react" />
  </body>
</html>
```

`src/app/WindCardsApp.tsx` (stub, replaced in Task 14):

```tsx
export default function WindCardsApp() {
  return <main className="wc-app mx-auto max-w-[1200px] p-6"><h1 className="wc-title text-2xl font-semibold">ph-winds</h1></main>;
}
```

`public/healthz`: `ok`. `public/favicon.svg`: a simple accent-coloured circle with a white music note glyph path.

`nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm build"]

[start]
cmd = "npx serve dist -l 3000"
```

`.gitignore`: `node_modules/`, `dist/`, `.astro/`, `test-results/`, `playwright-report/`.

`CLAUDE.md`: short project notes — stack, commands (`pnpm dev` binds 0.0.0.0, `pnpm verify`, `pnpm e2e`), the Global Constraints bullets above, and "Commit as you go."

- [ ] **Step 5: Scaffold test**

`src/app/scaffold.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sax from '@pepperhorn/fingering-components/instruments/saxophone.json';
import { renderFingering } from '@pepperhorn/fingering-components';

describe('scaffold', () => {
  it('resolves fingering-components with ranges', () => {
    expect(sax.ranges?.pro.low).toBe('Bb3');
    expect(renderFingering(sax, { label: 't', down: ['lh1'] })).toContain('<svg');
  });
});
```

- [ ] **Step 6: Verify**

Run: `pnpm test` → PASS. `pnpm build` → `dist/index.html` exists. `pnpm dev` then `curl -s localhost:4321 | grep ph-winds` → match; stop the server.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "Scaffold Astro 7 + React + Tailwind v4"`

### Task 4: Pitch utilities

**Files:**
- Create: `src/music/pitch.ts`
- Test: `src/music/pitch.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Step = 'C'|'D'|'E'|'F'|'G'|'A'|'B';
  interface Pitch { step: Step; alter: -1|0|1; octave: number }
  parsePitch(s: string): Pitch            // "F#4" | "Bb3" | "F♯4" | "B♭3"
  pitchKey(p: Pitch): string              // ASCII "F#4"
  formatPitch(p: Pitch): string           // "F♯4"
  toMidi(p: Pitch): number                // C4 = 60
  fromMidi(midi: number, preferFlat?: boolean): Pitch
  isBlackKey(midi: number): boolean
  prefersFlats(semis: number): boolean    // true for E♭/B♭/F horns
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parsePitch, pitchKey, formatPitch, toMidi, fromMidi, isBlackKey, prefersFlats } from './pitch';

describe('pitch', () => {
  it('parses ascii and unicode accidentals', () => {
    expect(parsePitch('F#4')).toEqual({ step: 'F', alter: 1, octave: 4 });
    expect(parsePitch('Bb3')).toEqual({ step: 'B', alter: -1, octave: 3 });
    expect(parsePitch('B♭3')).toEqual({ step: 'B', alter: -1, octave: 3 });
    expect(parsePitch('C4')).toEqual({ step: 'C', alter: 0, octave: 4 });
  });
  it('rejects junk', () => { expect(() => parsePitch('H2')).toThrow(); });
  it('formats', () => {
    expect(pitchKey({ step: 'F', alter: 1, octave: 4 })).toBe('F#4');
    expect(formatPitch({ step: 'B', alter: -1, octave: 3 })).toBe('B♭3');
  });
  it('midi round trip', () => {
    expect(toMidi(parsePitch('C4'))).toBe(60);
    expect(toMidi(parsePitch('Bb3'))).toBe(58);
    expect(toMidi(parsePitch('B#3'))).toBe(60);
    expect(fromMidi(61)).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(fromMidi(61, true)).toEqual({ step: 'D', alter: -1, octave: 4 });
    expect(fromMidi(59)).toEqual({ step: 'B', alter: 0, octave: 3 });
  });
  it('black keys', () => {
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(60)).toBe(false);
  });
  it('flat preference follows horn key', () => {
    expect(prefersFlats(-2)).toBe(true);   // B♭
    expect(prefersFlats(-9)).toBe(true);   // E♭ alto
    expect(prefersFlats(-14)).toBe(true);  // B♭ tenor
    expect(prefersFlats(-21)).toBe(true);  // E♭ bari
    expect(prefersFlats(0)).toBe(false);
    expect(prefersFlats(12)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/music/pitch.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export interface Pitch { step: Step; alter: -1 | 0 | 1; octave: number }

const PC: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP: [Step, -1 | 0 | 1][] = [['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]];
const FLAT: [Step, -1 | 0 | 1][] = [['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];

export function parsePitch(s: string): Pitch {
  const m = /^([A-G])(#|b|♯|♭)?(-?\d+)$/.exec(s.trim());
  if (!m) throw new Error(`Not a pitch: "${s}"`);
  const acc = m[2];
  const alter = acc === '#' || acc === '♯' ? 1 : acc === 'b' || acc === '♭' ? -1 : 0;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

const acc = (a: number, sharp: string, flat: string) => (a === 1 ? sharp : a === -1 ? flat : '');
export const pitchKey = (p: Pitch) => `${p.step}${acc(p.alter, '#', 'b')}${p.octave}`;
export const formatPitch = (p: Pitch) => `${p.step}${acc(p.alter, '♯', '♭')}${p.octave}`;

export const toMidi = (p: Pitch) => (p.octave + 1) * 12 + PC[p.step] + p.alter;

export function fromMidi(midi: number, preferFlat = false): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = (preferFlat ? FLAT : SHARP)[pc];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Same rule as fingering-components' `sounding`: E♭, B♭ and F horns read in flats. */
export const prefersFlats = (semis: number) => [3, 5, 10].includes(((semis % 12) + 12) % 12);
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `"Pitch utilities"`.

### Task 5: Instrument catalogue, fingering lookup, range bands

**Files:**
- Create: `src/music/instruments.ts`
- Test: `src/music/instruments.test.ts`

**Interfaces:**
- Consumes: `Pitch`, `parsePitch`, `toMidi`, `fromMidi`, `prefersFlats` (Task 4); library JSON + `transposeFor`.
- Produces:
  ```ts
  type InstrumentId = 'saxophone'|'clarinet'|'flute'|'recorder'|'tin-whistle'|'trumpet'|'trombone'|'nuvo-dood'|'nuvo-toot';
  interface HornOption { id: string; name: string }
  interface InstrumentInfo { id: InstrumentId; name: string; horns: HornOption[]; defaultHorn?: string; clef: 'G'|'F'; layout: Layout }
  type Band = { low: number; high: number };               // midi, written, inclusive
  interface RangeBands { beginner: Band; intermediate: Band; pro: Band }
  listInstruments(): InstrumentInfo[]
  getInstrument(id: string): InstrumentInfo                 // throws on unknown id
  semitones(id: string, horn?: string): number              // written → sounding
  fingeringSheet(id: string, horn?: string): Fingering[]    // merged, sorted by midi
  fingeringsFor(id: string, horn: string|undefined, writtenMidi: number): Fingering[]  // [primary, ...alternates]
  playableMidis(id: string, horn?: string): Set<number>
  spellWritten(id: string, horn: string|undefined, writtenMidi: number): Pitch
  rangeBands(id: string, horn?: string): RangeBands
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { listInstruments, getInstrument, semitones, fingeringSheet, fingeringsFor, playableMidis, spellWritten, rangeBands } from './instruments';

describe('instruments', () => {
  it('lists all nine with horns', () => {
    const ids = listInstruments().map((i) => i.id);
    expect(ids).toEqual(['saxophone', 'clarinet', 'flute', 'recorder', 'tin-whistle', 'trumpet', 'trombone', 'nuvo-dood', 'nuvo-toot']);
    expect(getInstrument('saxophone').horns.map((h) => h.id)).toEqual(['soprano', 'alto', 'tenor', 'baritone']);
    expect(getInstrument('saxophone').defaultHorn).toBe('alto');
    expect(getInstrument('trombone').clef).toBe('F');
    expect(getInstrument('flute').clef).toBe('G');
  });
  it('semitones by horn', () => {
    expect(semitones('saxophone', 'tenor')).toBe(-14);
    expect(semitones('saxophone')).toBe(-9);
    expect(semitones('recorder')).toBe(12);
    expect(semitones('clarinet')).toBe(-2);
  });
  it('merges sax altissimo', () => {
    const s = fingeringSheet('saxophone', 'alto');
    expect(s[0]).toMatchObject({ note: 'Bb', octave: 3 });
    expect(s.at(-1)).toMatchObject({ note: 'F', octave: 7 });
  });
  it('picks the tin whistle sheet by horn', () => {
    expect(fingeringSheet('tin-whistle', 'C')[0]).toMatchObject({ note: 'C', octave: 5 });
    expect(fingeringSheet('tin-whistle', 'D')[0]).toMatchObject({ note: 'D', octave: 5 });
  });
  it('expands alternates after the primary', () => {
    // clarinet written E3 has one alternate
    const fs = fingeringsFor('clarinet', undefined, 52);
    expect(fs.length).toBe(2);
    expect(fs[1]).toMatchObject({ note: 'E', octave: 3, note_text: 'Alt 1' });
    expect(fs[1].alternates).toBeUndefined();
  });
  it('returns [] when no fingering', () => {
    expect(fingeringsFor('flute', undefined, 40)).toEqual([]);
  });
  it('playable set and spelling', () => {
    expect(playableMidis('saxophone', 'alto').has(58)).toBe(true);
    expect(spellWritten('saxophone', 'alto', 58)).toEqual({ step: 'B', alter: -1, octave: 3 });
    // no fingering → falls back to flats for a B♭ instrument
    expect(spellWritten('clarinet', undefined, 30)).toEqual({ step: 'G', alter: -1, octave: 1 });
  });
  it('range bands nest (written midi)', () => {
    const b = rangeBands('saxophone', 'alto');
    expect(b.pro).toEqual({ low: 58, high: 101 });
    expect(b.beginner.low).toBeGreaterThanOrEqual(b.intermediate.low);
    const w = rangeBands('tin-whistle', 'C');
    expect(w.pro).toEqual({ low: 72, high: 93 });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
import { transposeFor, type Fingering, type Layout, type Ranges } from '@pepperhorn/fingering-components';
import saxophone from '@pepperhorn/fingering-components/instruments/saxophone.json';
import clarinet from '@pepperhorn/fingering-components/instruments/clarinet.json';
import flute from '@pepperhorn/fingering-components/instruments/flute.json';
import recorder from '@pepperhorn/fingering-components/instruments/recorder.json';
import tinWhistle from '@pepperhorn/fingering-components/instruments/tin-whistle.json';
import trumpet from '@pepperhorn/fingering-components/instruments/trumpet.json';
import trombone from '@pepperhorn/fingering-components/instruments/trombone.json';
import nuvoDood from '@pepperhorn/fingering-components/instruments/nuvo-dood.json';
import nuvoToot from '@pepperhorn/fingering-components/instruments/nuvo-toot.json';
import fSax from '@pepperhorn/fingering-components/fingerings/saxophone.json';
import fSaxAlt from '@pepperhorn/fingering-components/fingerings/saxophone-altissimo.json';
import fClarinet from '@pepperhorn/fingering-components/fingerings/clarinet.json';
import fFlute from '@pepperhorn/fingering-components/fingerings/flute.json';
import fRecorder from '@pepperhorn/fingering-components/fingerings/recorder.json';
import fTrumpet from '@pepperhorn/fingering-components/fingerings/trumpet.json';
import fTrombone from '@pepperhorn/fingering-components/fingerings/trombone.json';
import fDood from '@pepperhorn/fingering-components/fingerings/nuvo-dood.json';
import fToot from '@pepperhorn/fingering-components/fingerings/nuvo-toot.json';
import fWhistleD from '@pepperhorn/fingering-components/fingerings/tin-whistle-d.json';
import fWhistleC from '@pepperhorn/fingering-components/fingerings/tin-whistle-c.json';
import fWhistleBb from '@pepperhorn/fingering-components/fingerings/tin-whistle-bb.json';
import fWhistleEb from '@pepperhorn/fingering-components/fingerings/tin-whistle-eb.json';
import fWhistleF from '@pepperhorn/fingering-components/fingerings/tin-whistle-f.json';
import { type Pitch, parsePitch, toMidi, fromMidi, prefersFlats } from './pitch';

export type InstrumentId = 'saxophone' | 'clarinet' | 'flute' | 'recorder' | 'tin-whistle' | 'trumpet' | 'trombone' | 'nuvo-dood' | 'nuvo-toot';
export interface HornOption { id: string; name: string }
export interface InstrumentInfo { id: InstrumentId; name: string; horns: HornOption[]; defaultHorn?: string; clef: 'G' | 'F'; layout: Layout }
export type Band = { low: number; high: number };
export interface RangeBands { beginner: Band; intermediate: Band; pro: Band }

type Sheets = (horn?: string) => Fingering[];
const WHISTLE: Record<string, Fingering[]> = {
  D: fWhistleD.fingerings, C: fWhistleC.fingerings, Bb: fWhistleBb.fingerings, Eb: fWhistleEb.fingerings, F: fWhistleF.fingerings,
};
const CATALOGUE: { layout: Layout; clef: 'G' | 'F'; sheets: Sheets }[] = [
  { layout: saxophone, clef: 'G', sheets: () => [...fSax.fingerings, ...fSaxAlt.fingerings] },
  { layout: clarinet, clef: 'G', sheets: () => fClarinet.fingerings },
  { layout: flute, clef: 'G', sheets: () => fFlute.fingerings },
  { layout: recorder, clef: 'G', sheets: () => fRecorder.fingerings },
  { layout: tinWhistle, clef: 'G', sheets: (h) => WHISTLE[h ?? tinWhistle.horn ?? 'D'] ?? [] },
  { layout: trumpet, clef: 'G', sheets: () => fTrumpet.fingerings },
  { layout: trombone, clef: 'F', sheets: () => fTrombone.fingerings },
  { layout: nuvoDood, clef: 'G', sheets: () => fDood.fingerings },
  { layout: nuvoToot, clef: 'G', sheets: () => fToot.fingerings },
];

const INFO: InstrumentInfo[] = CATALOGUE.map(({ layout, clef }) => ({
  id: layout.id as InstrumentId,
  name: layout.name,
  horns: Object.entries(layout.horns ?? {}).map(([id, h]) => ({ id, name: h.name })),
  defaultHorn: layout.horn,
  clef,
  layout,
}));

export const listInstruments = () => INFO;
export function getInstrument(id: string): InstrumentInfo {
  const i = INFO.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown instrument "${id}"`);
  return i;
}
export const semitones = (id: string, horn?: string) => transposeFor(getInstrument(id).layout, horn);

const fMidi = (f: Fingering) => toMidi(parsePitch(`${f.note}${f.octave}`));
const sheetCache = new Map<string, Fingering[]>();
export function fingeringSheet(id: string, horn?: string): Fingering[] {
  const key = `${id}/${horn ?? ''}`;
  let s = sheetCache.get(key);
  if (!s) {
    const entry = CATALOGUE[INFO.indexOf(getInstrument(id))];
    s = entry.sheets(horn).filter((f) => f.note && f.octave != null).sort((a, b) => fMidi(a) - fMidi(b));
    sheetCache.set(key, s);
  }
  return s;
}

export function fingeringsFor(id: string, horn: string | undefined, writtenMidi: number): Fingering[] {
  const primary = fingeringSheet(id, horn).find((f) => fMidi(f) === writtenMidi);
  if (!primary) return [];
  const { alternates = [], ...main } = primary;
  return [main, ...alternates.map((a, i) => ({ ...a, note: main.note, octave: main.octave, note_text: `Alt ${i + 1}` }))];
}

export const playableMidis = (id: string, horn?: string) => new Set(fingeringSheet(id, horn).map(fMidi));

export function spellWritten(id: string, horn: string | undefined, writtenMidi: number): Pitch {
  const f = fingeringSheet(id, horn).find((x) => fMidi(x) === writtenMidi);
  return f ? parsePitch(`${f.note}${f.octave}`) : fromMidi(writtenMidi, prefersFlats(semitones(id, horn)));
}

export function rangeBands(id: string, horn?: string): RangeBands {
  const { layout, defaultHorn } = getInstrument(id);
  const r: Ranges | undefined = layout.horns?.[horn ?? defaultHorn ?? '']?.ranges ?? layout.ranges;
  if (!r) throw new Error(`${id} has no ranges`);
  const band = (b: { low: string; high: string }) => ({ low: toMidi(parsePitch(b.low)), high: toMidi(parsePitch(b.high)) });
  return { beginner: band(r.beginner), intermediate: band(r.intermediate), pro: band(r.pro) };
}
```

- [ ] **Step 4: Run** → PASS. If the whistle `rangeBands` expectation differs, check the ranges added in Task 1 (C whistle pro = C5–A6 = 72–93). **Step 5: Commit** — `"Instrument catalogue, fingering lookup, range bands"`.

### Task 6: State types, defaults, resolution

**Files:**
- Create: `src/state/types.ts`, `src/state/defaults.ts`, `src/state/resolve.ts`
- Test: `src/state/resolve.test.ts`

**Interfaces:**
- Consumes: `Pitch`, `formatPitch`, `toMidi`, `fromMidi`, `prefersFlats` (Task 4); `semitones` (Task 5).
- Produces (types.ts) — exactly the spec's Part 2 model:
  ```ts
  export type PitchMode = 'written' | 'concert';
  export type MusicFont = 'bravura' | 'petaluma';
  export type CardDisplay = 'fingering' | 'both' | 'notation';
  export type Orientation = 'vertical' | 'horizontal';
  export type TextSize = 'S' | 'M' | 'L';
  export type Align = 'left' | 'center' | 'right';
  export interface TextField { text: string; show: boolean; size: TextSize; align: Align }
  export type TextKey = 'heading' | 'subtitle' | 'footer';
  export type CardText = Record<TextKey, TextField>;
  export interface DiagramStyle { variants: string[]; look: 'solid'|'dotted'|'ghost'; twoTone: boolean; hints: boolean; primary: string; secondary: string }
  export interface CardItem {
    id: string; pitch: Pitch; fingeringIndex: number; display: CardDisplay; orientation: Orientation; scale: number;
    text?: Partial<Record<TextKey, Partial<TextField>>>; style?: Partial<DiagramStyle>;
  }
  export type CardDraft = Omit<CardItem, 'id'>;
  export interface BoardMeta {
    instrument: string; horn?: string; pitchMode: PitchMode; musicFont: MusicFont; columns: number | 'auto';
    title: TextField; subtitle: TextField; footer: TextField;
    cardText: CardText; style: DiagramStyle; diagramOrient: 'vertical' | 'horizontal';
  }
  export interface BoardState { version: 1; meta: BoardMeta; items: CardItem[] }
  ```
- Produces (defaults.ts): `textField(p?: Partial<TextField>): TextField`, `DEFAULT_STYLE: DiagramStyle`, `createBoard(instrument?: string): BoardState`, `newCardDraft(pitch: Pitch): CardDraft`, `COLOR_PRESETS: string[]`.
- Produces (resolve.ts): `autoHeading(p: Pitch): string`, `autoSubtitle(p: Pitch, semis: number): string` (`''` when semis === 0), `resolveCardText(card: Pick<CardItem,'pitch'|'text'>, meta: BoardMeta): CardText`, `resolveStyle(card: Pick<CardItem,'style'>, meta: BoardMeta): DiagramStyle`.

- [ ] **Step 1: Failing tests** (`resolve.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createBoard, newCardDraft, DEFAULT_STYLE } from './defaults';
import { autoHeading, autoSubtitle, resolveCardText, resolveStyle } from './resolve';
import { parsePitch } from '@/music/pitch';

const alto = () => ({ ...createBoard('saxophone'), meta: { ...createBoard('saxophone').meta, horn: 'alto' } });

describe('resolve', () => {
  it('auto labels', () => {
    expect(autoHeading(parsePitch('F#4'))).toBe('F♯4');
    expect(autoSubtitle(parsePitch('C5'), -9)).toBe('sounds E♭4');
    expect(autoSubtitle(parsePitch('C5'), 0)).toBe('');
  });
  it('card text falls back to board defaults then auto labels', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5') }, b.meta);
    expect(t.heading.text).toBe('C5');
    expect(t.subtitle.text).toBe('sounds E♭4');
    expect(t.subtitle.show).toBe(true);
    expect(t.footer.show).toBe(false);
  });
  it('card override wins field by field', () => {
    const b = alto();
    const t = resolveCardText({ pitch: parsePitch('C5'), text: { heading: { text: 'Middle C', size: 'L' } } }, b.meta);
    expect(t.heading).toMatchObject({ text: 'Middle C', size: 'L', align: 'center', show: true });
  });
  it('subtitle hides itself on non-transposing instruments when empty', () => {
    const b = createBoard('flute');
    expect(resolveCardText({ pitch: parsePitch('C5') }, b.meta).subtitle.show).toBe(false);
  });
  it('style merges', () => {
    const b = alto();
    expect(resolveStyle({}, b.meta)).toEqual(DEFAULT_STYLE);
    expect(resolveStyle({ style: { primary: '#ff0000' } }, b.meta).primary).toBe('#ff0000');
  });
  it('new card draft defaults', () => {
    expect(newCardDraft(parsePitch('D4'))).toMatchObject({ fingeringIndex: 0, display: 'both', orientation: 'vertical', scale: 1 });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`types.ts` — the interfaces listed above, verbatim, with `import type { Pitch } from '@/music/pitch';`.

`defaults.ts`:

```ts
import type { BoardState, CardDraft, DiagramStyle, TextField } from './types';
import type { Pitch } from '@/music/pitch';
import { getInstrument } from '@/music/instruments';

export const textField = (p: Partial<TextField> = {}): TextField => ({ text: '', show: true, size: 'M', align: 'center', ...p });

export const COLOR_PRESETS = ['#1c2233', '#6d5dfc', '#2f80ed', '#12a594', '#e5484d', '#f76b15', '#d6409f', '#8e4ec6'];

export const DEFAULT_STYLE: DiagramStyle = {
  variants: [], look: 'solid', twoTone: false, hints: false, primary: '#1c2233', secondary: '#2f80ed',
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
      cardText: { heading: textField(), subtitle: textField({ size: 'S' }), footer: textField({ size: 'S', show: false }) },
      style: DEFAULT_STYLE,
      diagramOrient: 'vertical',
    },
    items: [],
  };
}

export const newCardDraft = (pitch: Pitch): CardDraft => ({
  pitch, fingeringIndex: 0, display: 'both', orientation: 'vertical', scale: 1,
});
```

`resolve.ts`:

```ts
import type { BoardMeta, CardItem, CardText, DiagramStyle, TextKey } from './types';
import { type Pitch, formatPitch, toMidi, fromMidi, prefersFlats } from '@/music/pitch';
import { semitones } from '@/music/instruments';

export const autoHeading = (p: Pitch) => formatPitch(p);
export const autoSubtitle = (p: Pitch, semis: number) =>
  semis === 0 ? '' : `sounds ${formatPitch(fromMidi(toMidi(p) + semis, p.alter === -1 || prefersFlats(semis)))}`;

const KEYS: TextKey[] = ['heading', 'subtitle', 'footer'];

export function resolveCardText(card: Pick<CardItem, 'pitch' | 'text'>, meta: BoardMeta): CardText {
  const semis = semitones(meta.instrument, meta.horn);
  const auto: Record<TextKey, string> = { heading: autoHeading(card.pitch), subtitle: autoSubtitle(card.pitch, semis), footer: '' };
  const out = {} as CardText;
  for (const k of KEYS) {
    const merged = { ...meta.cardText[k], ...card.text?.[k] };
    const text = merged.text || auto[k];
    out[k] = { ...merged, text, show: merged.show && text !== '' };
  }
  return out;
}

export const resolveStyle = (card: Pick<CardItem, 'style'>, meta: BoardMeta): DiagramStyle => ({ ...meta.style, ...card.style });
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `"Board model, defaults, text/style resolution"`.

### Task 7: Reducer, storage, JSON io, hook

**Files:**
- Create: `src/state/boardReducer.ts`, `src/state/storage.ts`, `src/state/io.ts`, `src/state/useWindBoard.ts`
- Test: `src/state/boardReducer.test.ts`, `src/state/storage.test.ts`, `src/state/io.test.ts`

**Interfaces:**
- Consumes: types + `createBoard` (Task 6).
- Produces:
  ```ts
  // boardReducer.ts
  type BoardAction =
    | { type: 'setMeta'; patch: Partial<BoardMeta> }
    | { type: 'setInstrument'; instrument: string; horn?: string }   // clears items
    | { type: 'add'; card: CardItem }
    | { type: 'update'; id: string; patch: Partial<CardDraft> }
    | { type: 'remove'; id: string }
    | { type: 'duplicate'; id: string; newId: string }
    | { type: 'reorder'; fromId: string; toId: string }
    | { type: 'clear' }
    | { type: 'replace'; state: BoardState };
  boardReducer(s: BoardState, a: BoardAction): BoardState
  // storage.ts
  interface StorageAdapter { load(): BoardState | null; save(s: BoardState): void }
  localStorageAdapter(key?: string, opts?: { onError?: (e: unknown) => void }): StorageAdapter
  memoryStorageAdapter(initial?: BoardState): StorageAdapter
  // io.ts
  exportBoardJson(s: BoardState): string
  importBoardJson(text: string): { ok: true; state: BoardState } | { ok: false; error: string }
  // useWindBoard.ts
  useWindBoard(opts?: { storage?: StorageAdapter }): {
    state: BoardState; dispatch: (a: BoardAction) => void;
    addCard(d: CardDraft): string; updateCard(id: string, p: Partial<CardDraft>): void;
    removeCard(id: string): void; duplicateCard(id: string): void; reorder(fromId: string, toId: string): void;
    setMeta(p: Partial<BoardMeta>): void; setInstrument(instrument: string, horn?: string): void;
    clear(): void; replaceState(s: BoardState): void;
  }
  ```

- [ ] **Step 1: Failing tests**

`boardReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { boardReducer } from './boardReducer';
import { createBoard, newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';

const card = (id: string, n = 'C5') => ({ id, ...newCardDraft(parsePitch(n)) });
const withCards = (...ids: string[]) => ids.reduce((s, id) => boardReducer(s, { type: 'add', card: card(id) }), createBoard());

describe('boardReducer', () => {
  it('adds, updates, removes', () => {
    let s = withCards('a');
    s = boardReducer(s, { type: 'update', id: 'a', patch: { scale: 1.5 } });
    expect(s.items[0].scale).toBe(1.5);
    s = boardReducer(s, { type: 'remove', id: 'a' });
    expect(s.items).toEqual([]);
  });
  it('duplicates after the source', () => {
    const s = boardReducer(withCards('a', 'b'), { type: 'duplicate', id: 'a', newId: 'a2' });
    expect(s.items.map((i) => i.id)).toEqual(['a', 'a2', 'b']);
  });
  it('reorders to the target slot', () => {
    const s = boardReducer(withCards('a', 'b', 'c'), { type: 'reorder', fromId: 'c', toId: 'a' });
    expect(s.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
  it('setInstrument clears cards and resets style variants', () => {
    let s = withCards('a');
    s = boardReducer(s, { type: 'setMeta', patch: { style: { ...s.meta.style, variants: ['palm-bean'] } } });
    s = boardReducer(s, { type: 'setInstrument', instrument: 'clarinet' });
    expect(s.items).toEqual([]);
    expect(s.meta.instrument).toBe('clarinet');
    expect(s.meta.horn).toBeUndefined();
    expect(s.meta.style.variants).toEqual([]);
  });
});
```

`storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localStorageAdapter, memoryStorageAdapter } from './storage';
import { createBoard } from './defaults';

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  it('round trips through localStorage', () => {
    const a = localStorageAdapter('t');
    expect(a.load()).toBeNull();
    a.save(createBoard('flute'));
    expect(a.load()?.meta.instrument).toBe('flute');
  });
  it('ignores corrupt data', () => {
    localStorage.setItem('t', '{nope');
    expect(localStorageAdapter('t').load()).toBeNull();
  });
  it('reports quota errors without throwing', () => {
    const onError = vi.fn();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => localStorageAdapter('t', { onError }).save(createBoard())).not.toThrow();
    expect(onError).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('memory adapter', () => {
    const m = memoryStorageAdapter();
    m.save(createBoard('recorder'));
    expect(m.load()?.meta.instrument).toBe('recorder');
  });
});
```

`io.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { exportBoardJson, importBoardJson } from './io';
import { createBoard, newCardDraft } from './defaults';
import { parsePitch } from '@/music/pitch';

describe('io', () => {
  it('round trips', () => {
    const s = createBoard('trumpet');
    s.items.push({ id: 'x', ...newCardDraft(parsePitch('G4')) });
    const r = importBoardJson(exportBoardJson(s));
    expect(r.ok && r.state).toEqual(s);
  });
  it('rejects bad json, wrong version, unknown instrument, bad card', () => {
    expect(importBoardJson('nope').ok).toBe(false);
    expect(importBoardJson(JSON.stringify({ ...createBoard(), version: 2 })).ok).toBe(false);
    const bad = createBoard(); (bad.meta as any).instrument = 'kazoo';
    expect(importBoardJson(JSON.stringify(bad)).ok).toBe(false);
    const bad2 = createBoard(); (bad2.items as any).push({ id: 'y', pitch: { step: 'H', alter: 0, octave: 4 } });
    const r = importBoardJson(JSON.stringify(bad2));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/card 1/);
  });
  it('fills missing optional meta from defaults', () => {
    const s = createBoard('flute') as any; delete s.meta.style; delete s.meta.diagramOrient;
    const r = importBoardJson(JSON.stringify(s));
    expect(r.ok && r.state.meta.style.look).toBe('solid');
    expect(r.ok && r.state.meta.diagramOrient).toBe('vertical');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`boardReducer.ts`:

```ts
import type { BoardMeta, BoardState, CardDraft, CardItem } from './types';
import { getInstrument } from '@/music/instruments';
import { DEFAULT_STYLE } from './defaults';

export type BoardAction =
  | { type: 'setMeta'; patch: Partial<BoardMeta> }
  | { type: 'setInstrument'; instrument: string; horn?: string }
  | { type: 'add'; card: CardItem }
  | { type: 'update'; id: string; patch: Partial<CardDraft> }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'reorder'; fromId: string; toId: string }
  | { type: 'clear' }
  | { type: 'replace'; state: BoardState };

export function boardReducer(s: BoardState, a: BoardAction): BoardState {
  switch (a.type) {
    case 'setMeta': return { ...s, meta: { ...s.meta, ...a.patch } };
    case 'setInstrument': {
      const info = getInstrument(a.instrument);
      return { ...s, items: [], meta: { ...s.meta, instrument: a.instrument, horn: a.horn ?? info.defaultHorn, style: { ...s.meta.style, variants: DEFAULT_STYLE.variants } } };
    }
    case 'add': return { ...s, items: [...s.items, a.card] };
    case 'update': return { ...s, items: s.items.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
    case 'remove': return { ...s, items: s.items.filter((c) => c.id !== a.id) };
    case 'duplicate': {
      const i = s.items.findIndex((c) => c.id === a.id);
      if (i < 0) return s;
      const items = [...s.items];
      items.splice(i + 1, 0, { ...structuredClone(s.items[i]), id: a.newId });
      return { ...s, items };
    }
    case 'reorder': {
      const from = s.items.findIndex((c) => c.id === a.fromId);
      const to = s.items.findIndex((c) => c.id === a.toId);
      if (from < 0 || to < 0 || from === to) return s;
      const items = [...s.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...s, items };
    }
    case 'clear': return { ...s, items: [] };
    case 'replace': return a.state;
  }
}
```

`storage.ts`:

```ts
import type { BoardState } from './types';
import { parseBoard } from './io';

export interface StorageAdapter { load(): BoardState | null; save(s: BoardState): void }

export function localStorageAdapter(key = 'ph-winds-board', opts: { onError?: (e: unknown) => void } = {}): StorageAdapter {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const r = parseBoard(JSON.parse(raw));
        return r.ok ? r.state : null;
      } catch { return null; }
    },
    save(s) {
      try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { opts.onError?.(e); }
    },
  };
}

export function memoryStorageAdapter(initial: BoardState | null = null): StorageAdapter {
  let v = initial;
  return { load: () => v, save: (s) => { v = s; } };
}
```

`io.ts`:

```ts
import type { BoardState, CardItem } from './types';
import { createBoard, textField, DEFAULT_STYLE } from './defaults';
import { listInstruments } from '@/music/instruments';

type Result = { ok: true; state: BoardState } | { ok: false; error: string };
const STEPS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkCard(c: any, i: number): string | null {
  const at = `card ${i + 1}`;
  if (!isObj(c) || typeof c.id !== 'string') return `${at}: missing id`;
  const p = c.pitch;
  if (!isObj(p) || !STEPS.has(p.step) || ![-1, 0, 1].includes(p.alter) || !Number.isInteger(p.octave)) return `${at}: bad pitch`;
  if (!Number.isInteger(c.fingeringIndex) || c.fingeringIndex < 0) return `${at}: bad fingeringIndex`;
  if (!['fingering', 'both', 'notation'].includes(c.display)) return `${at}: bad display`;
  if (!['vertical', 'horizontal'].includes(c.orientation)) return `${at}: bad orientation`;
  if (typeof c.scale !== 'number' || c.scale < 0.5 || c.scale > 2) return `${at}: bad scale`;
  return null;
}

export function parseBoard(data: unknown): Result {
  if (!isObj(data)) return { ok: false, error: 'Not a board file' };
  if (data.version !== 1) return { ok: false, error: `Unsupported board version ${data.version}` };
  const m = data.meta;
  if (!isObj(m) || !listInstruments().some((i) => i.id === m.instrument)) return { ok: false, error: 'Unknown instrument' };
  if (!Array.isArray(data.items)) return { ok: false, error: 'Missing items' };
  for (let i = 0; i < data.items.length; i++) {
    const err = checkCard(data.items[i], i);
    if (err) return { ok: false, error: err };
  }
  const d = createBoard(m.instrument).meta;
  const tf = (v: unknown, fallback = textField()) => (isObj(v) ? { ...fallback, ...v } : fallback);
  const meta = {
    ...d, ...m,
    title: tf(m.title, d.title), subtitle: tf(m.subtitle, d.subtitle), footer: tf(m.footer, d.footer),
    cardText: {
      heading: tf(m.cardText?.heading, d.cardText.heading),
      subtitle: tf(m.cardText?.subtitle, d.cardText.subtitle),
      footer: tf(m.cardText?.footer, d.cardText.footer),
    },
    style: { ...DEFAULT_STYLE, ...(isObj(m.style) ? m.style : {}) },
  };
  return { ok: true, state: { version: 1, meta, items: data.items as CardItem[] } };
}

export const exportBoardJson = (s: BoardState) => JSON.stringify(s, null, 2);

export function importBoardJson(text: string): Result {
  try { return parseBoard(JSON.parse(text)); } catch { return { ok: false, error: 'File is not valid JSON' }; }
}
```

`useWindBoard.ts`:

```ts
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { boardReducer, type BoardAction } from './boardReducer';
import { createBoard } from './defaults';
import { localStorageAdapter, type StorageAdapter } from './storage';
import type { BoardMeta, BoardState, CardDraft } from './types';

const uid = () => crypto.randomUUID();

export function useWindBoard({ storage }: { storage?: StorageAdapter } = {}) {
  const store = useMemo(() => storage ?? localStorageAdapter(), [storage]);
  const [state, dispatch] = useReducer(boardReducer, undefined, () => store.load() ?? createBoard());
  useEffect(() => { store.save(state); }, [store, state]);

  const addCard = useCallback((d: CardDraft) => { const id = uid(); dispatch({ type: 'add', card: { ...d, id } }); return id; }, []);
  return {
    state,
    dispatch: dispatch as (a: BoardAction) => void,
    addCard,
    updateCard: useCallback((id: string, patch: Partial<CardDraft>) => dispatch({ type: 'update', id, patch }), []),
    removeCard: useCallback((id: string) => dispatch({ type: 'remove', id }), []),
    duplicateCard: useCallback((id: string) => dispatch({ type: 'duplicate', id, newId: uid() }), []),
    reorder: useCallback((fromId: string, toId: string) => dispatch({ type: 'reorder', fromId, toId }), []),
    setMeta: useCallback((patch: Partial<BoardMeta>) => dispatch({ type: 'setMeta', patch }), []),
    setInstrument: useCallback((instrument: string, horn?: string) => dispatch({ type: 'setInstrument', instrument, horn }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), []),
    replaceState: useCallback((s: BoardState) => dispatch({ type: 'replace', state: s }), []),
  };
}
```

Note: `setInstrument` in the test above expects `horn` undefined for clarinet — `info.defaultHorn` is undefined for clarinet, so this holds.

- [ ] **Step 4: Run** `pnpm test` → PASS. **Step 5: Commit** — `"Board reducer, storage adapters, JSON import/export"`.

### Task 8: Notation — Verovio loader, MEI, StaffNote

**Files:**
- Create: `src/notation/mei.ts`, `src/notation/verovio.ts`, `src/notation/StaffNote.tsx`
- Copy: `~/chordl/packages/chordl-react/src/verovio-fonts.generated.ts` → `src/notation/verovio-fonts.generated.ts`; `~/chordl/packages/chordl-react/src/verovio-modules.d.ts` → `src/notation/verovio-modules.d.ts`; `~/chordl/packages/chordl-react/fonts/verovio/` → `fonts/verovio/`; `~/chordl/packages/chordl-react/scripts/build-verovio-fonts.mjs` and `embed-verovio-fonts.mjs` → `scripts/` (fix their output paths to `src/notation/verovio-fonts.generated.ts` and `fonts/verovio`).
- Test: `src/notation/mei.test.ts`

**Interfaces:**
- Consumes: `Pitch` (Task 4); `MusicFont` (Task 6).
- Produces:
  ```ts
  buildMei(p: Pitch, clef: 'G' | 'F'): string
  getVerovioToolkit(): Promise<Toolkit>; isVerovioReady(): boolean; prefetchVerovio(): Promise<void>; shouldPrefetch(): boolean
  renderStaffSvg(p: Pitch, clef: 'G'|'F', font: MusicFont): Promise<string>   // memoised
  pendingRenders(): Promise<void>                                           // resolves when the render queue is idle
  <StaffNote pitch clef font width /> // className "wc-staff"
  ```

- [ ] **Step 1: Failing MEI test**

```ts
import { describe, it, expect } from 'vitest';
import { buildMei } from './mei';
import { parsePitch } from '@/music/pitch';

describe('buildMei', () => {
  it('treble clef sharp', () => {
    const x = buildMei(parsePitch('F#4'), 'G');
    expect(x).toContain('clef.shape="G" clef.line="2"');
    expect(x).toContain('<note pname="f" oct="4" dur="1" accid="s"/>');
  });
  it('bass clef flat', () => {
    const x = buildMei(parsePitch('Bb2'), 'F');
    expect(x).toContain('clef.shape="F" clef.line="4"');
    expect(x).toContain('accid="f"');
  });
  it('natural has no accid', () => {
    expect(buildMei(parsePitch('C5'), 'G')).toContain('<note pname="c" oct="5" dur="1"/>');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `mei.ts`**

```ts
import type { Pitch } from '@/music/pitch';

export function buildMei(p: Pitch, clef: 'G' | 'F'): string {
  const [shape, line] = clef === 'G' ? ['G', 2] : ['F', 4];
  const accid = p.alter === 1 ? ' accid="s"' : p.alter === -1 ? ' accid="f"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><music><body><mdiv><score>
<scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="${shape}" clef.line="${line}"/></staffGrp></scoreDef>
<section><measure n="1" right="invis"><staff n="1"><layer n="1">
<note pname="${p.step.toLowerCase()}" oct="${p.octave}" dur="1"${accid}/>
</layer></staff></measure></section></score></mdiv></body></music></mei>`;
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: `verovio.ts`** — copy chordl's `src/verovio.ts` (loader singleton, `isVerovioReady`, `prefetchVerovio`, the NetworkInformation gate exported as `shouldPrefetch()`), change the fonts import to `./verovio-fonts.generated`, then append:

```ts
import type { Pitch } from '@/music/pitch';
import type { MusicFont } from '@/state/types';
import { pitchKey } from '@/music/pitch';
import { buildMei } from './mei';

const svgCache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** Engrave one note. Serialised through the single toolkit; memoised per pitch/clef/font. */
export function renderStaffSvg(p: Pitch, clef: 'G' | 'F', font: MusicFont): Promise<string> {
  const key = `${pitchKey(p)}|${clef}|${font}`;
  let hit = svgCache.get(key);
  if (!hit) {
    hit = queue.then(async () => {
      const tk = await getVerovioToolkit();
      tk.setOptions({
        font: font === 'petaluma' ? 'Petaluma' : 'Bravura',
        svgViewBox: true, adjustPageHeight: true, adjustPageWidth: true,
        header: 'none', footer: 'none', breaks: 'none',
        pageMarginTop: 0, pageMarginBottom: 0, pageMarginLeft: 0, pageMarginRight: 0,
        scale: 60,
      });
      tk.loadData(buildMei(p, clef));
      return tk.renderToSVG(1);
    });
    hit.catch(() => svgCache.delete(key));
    svgCache.set(key, hit);
    queue = hit.catch(() => undefined);
  }
  return hit;
}

export const pendingRenders = () => queue.then(() => undefined);
```

- [ ] **Step 6: `StaffNote.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Pitch } from '@/music/pitch';
import type { MusicFont } from '@/state/types';
import { renderStaffSvg } from './verovio';

export function StaffNote({ pitch, clef, font, width }: { pitch: Pitch; clef: 'G' | 'F'; font: MusicFont; width: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    renderStaffSvg(pitch, clef, font).then((s) => live && setSvg(s), () => live && setFailed(true));
    return () => { live = false; };
  }, [pitch.step, pitch.alter, pitch.octave, clef, font]);

  if (failed) return <div className="wc-staff wc-staff--error text-xs text-muted" style={{ width }}>Notation unavailable</div>;
  if (!svg) return <div className="wc-staff wc-staff--loading animate-pulse rounded-lg bg-hairline" style={{ width, height: width * 0.6 }} />;
  return <div className="wc-staff [&_svg]:h-auto [&_svg]:w-full" style={{ width }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

- [ ] **Step 7: Manual check** — temporarily render `<StaffNote pitch={parsePitch('F#4')} clef="G" font="petaluma" width={160} />` in `WindCardsApp`, `pnpm dev`, confirm in the browser (use the webapp-testing / Playwright screenshot) that a treble staff with F♯4 appears in Petaluma. Revert the stub.

- [ ] **Step 8: Commit** — `"Verovio notation with Bravura/Petaluma"`.

### Task 9: Playback voices

**Files:**
- Create: `src/audio/voices.ts`, `src/audio/playback.ts`
- Test: `src/audio/voices.test.ts`

**Interfaces:**
- Consumes: `semitones` (Task 5), `toMidi` (Task 4).
- Produces:
  ```ts
  type VoiceSpec =
    | { source: 'soundfont'; name: string }
    | { source: 'versilian'; name: string; range: [number, number]; fallback: string };
  PIANO_VOICE: VoiceSpec
  instrumentVoice(id: string, horn?: string): VoiceSpec
  soundingMidi(written: Pitch, id: string, horn?: string): number
  resolveVoice(v: VoiceSpec, midi: number): VoiceSpec     // versilian → soundfont fallback when out of range
  playNote(v: VoiceSpec, midi: number): Promise<void>      // playback.ts
  isVoiceLoaded(v: VoiceSpec): boolean                     // playback.ts
  releaseVoicesExcept(keep: VoiceSpec[]): void             // playback.ts
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { instrumentVoice, PIANO_VOICE, soundingMidi, resolveVoice } from './voices';
import { parsePitch } from '@/music/pitch';

const RECORDER = 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain';

describe('voices', () => {
  it('maps every instrument', () => {
    expect(instrumentVoice('saxophone', 'soprano')).toEqual({ source: 'soundfont', name: 'soprano_sax' });
    expect(instrumentVoice('saxophone', 'alto')).toEqual({ source: 'soundfont', name: 'alto_sax' });
    expect(instrumentVoice('saxophone', 'tenor')).toEqual({ source: 'soundfont', name: 'tenor_sax' });
    expect(instrumentVoice('saxophone', 'baritone')).toEqual({ source: 'soundfont', name: 'baritone_sax' });
    expect(instrumentVoice('saxophone')).toEqual({ source: 'soundfont', name: 'alto_sax' });
    expect(instrumentVoice('clarinet')).toEqual({ source: 'soundfont', name: 'clarinet' });
    expect(instrumentVoice('flute')).toEqual({ source: 'soundfont', name: 'flute' });
    expect(instrumentVoice('trumpet')).toEqual({ source: 'soundfont', name: 'trumpet' });
    expect(instrumentVoice('trombone')).toEqual({ source: 'soundfont', name: 'trombone' });
    expect(instrumentVoice('nuvo-dood')).toEqual({ source: 'soundfont', name: 'clarinet' });
    expect(instrumentVoice('nuvo-toot')).toEqual({ source: 'soundfont', name: 'flute' });
    for (const id of ['recorder', 'tin-whistle'])
      expect(instrumentVoice(id)).toEqual({ source: 'versilian', name: RECORDER, range: [72, 98], fallback: 'recorder' });
    expect(PIANO_VOICE).toEqual({ source: 'soundfont', name: 'acoustic_grand_piano' });
  });
  it('sounds concert pitch', () => {
    expect(soundingMidi(parsePitch('C5'), 'saxophone', 'alto')).toBe(63);
    expect(soundingMidi(parsePitch('C4'), 'recorder')).toBe(72);
    expect(soundingMidi(parsePitch('C5'), 'flute')).toBe(72);
  });
  it('falls back outside the VCSL sample range', () => {
    const v = instrumentVoice('tin-whistle', 'Bb');
    expect(resolveVoice(v, 70)).toEqual({ source: 'soundfont', name: 'recorder' });
    expect(resolveVoice(v, 74)).toBe(v);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `voices.ts`**

```ts
import { type Pitch, toMidi } from '@/music/pitch';
import { getInstrument, semitones } from '@/music/instruments';

export type VoiceSpec =
  | { source: 'soundfont'; name: string }
  | { source: 'versilian'; name: string; range: [number, number]; fallback: string };

const sf = (name: string): VoiceSpec => ({ source: 'soundfont', name });
const RECORDER: VoiceSpec = {
  source: 'versilian', name: 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain', range: [72, 98], fallback: 'recorder',
};
export const PIANO_VOICE = sf('acoustic_grand_piano');

const SAX: Record<string, string> = { soprano: 'soprano_sax', alto: 'alto_sax', tenor: 'tenor_sax', baritone: 'baritone_sax' };

export function instrumentVoice(id: string, horn?: string): VoiceSpec {
  switch (id) {
    case 'saxophone': return sf(SAX[horn ?? getInstrument(id).defaultHorn ?? 'alto']);
    case 'clarinet': case 'nuvo-dood': return sf('clarinet');
    case 'flute': case 'nuvo-toot': return sf('flute');
    case 'trumpet': return sf('trumpet');
    case 'trombone': return sf('trombone');
    case 'recorder': case 'tin-whistle': return RECORDER;
    default: throw new Error(`No voice for ${id}`);
  }
}

export const soundingMidi = (p: Pitch, id: string, horn?: string) => toMidi(p) + semitones(id, horn);

export const resolveVoice = (v: VoiceSpec, midi: number): VoiceSpec =>
  v.source === 'versilian' && (midi < v.range[0] || midi > v.range[1]) ? sf(v.fallback) : v;
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Implement `playback.ts`** (no unit test — browser audio; covered by e2e stub and manual check)

```ts
import type { VoiceSpec } from './voices';
import { resolveVoice } from './voices';

type Player = { start(o: { note: number; duration?: number; velocity?: number }): unknown; stop(): void; ready: Promise<unknown> };

let ctx: AudioContext | null = null;
const players = new Map<string, Promise<Player>>();
const loaded = new Set<string>();
let last: Player | null = null;

const keyOf = (v: VoiceSpec) => `${v.source}:${v.name}`;
const context = () => (ctx ??= new AudioContext());

function load(v: VoiceSpec): Promise<Player> {
  const key = keyOf(v);
  let p = players.get(key);
  if (!p) {
    p = import('smplr').then(async (m) => {
      const player = (v.source === 'soundfont'
        ? m.Soundfont(context(), { instrument: v.name, kit: 'FluidR3_GM' })
        : m.Versilian(context(), { instrument: v.name })) as unknown as Player;
      await player.ready;
      loaded.add(key);
      return player;
    });
    p.catch(() => players.delete(key));
    players.set(key, p);
  }
  return p;
}

export const isVoiceLoaded = (v: VoiceSpec) => loaded.has(keyOf(v));

export async function playNote(voice: VoiceSpec, midi: number): Promise<void> {
  await context().resume();
  let v = resolveVoice(voice, midi);
  let player: Player;
  try { player = await load(v); }
  catch (e) {
    if (v.source !== 'versilian') throw e;
    v = { source: 'soundfont', name: v.fallback };
    player = await load(v);
  }
  last?.stop();
  player.start({ note: midi, duration: 1.5, velocity: 90 });
  last = player;
}

/** Drop players for voices the board no longer uses (e.g. after an instrument change). */
export function releaseVoicesExcept(keep: VoiceSpec[]) {
  const want = new Set(keep.map(keyOf));
  for (const k of [...players.keys()]) if (!want.has(k) && !k.startsWith('soundfont:recorder')) { players.delete(k); loaded.delete(k); }
}
```

Check the smplr 1.x type names while implementing (`node_modules/smplr/dist/index.d.ts`): `Soundfont`, `Versilian` are factory functions returning an object with `ready`, `start`, `stop`. Adjust the `Player` cast only if names differ.

- [ ] **Step 6: Commit** — `"smplr playback voices (FluidR3_GM + VCSL recorder)"`.

### Task 10: FingeringView and WindCard

**Files:**
- Create: `src/components/FingeringView.tsx`, `src/components/WindCard.tsx`
- Test: `src/components/WindCard.test.tsx`

**Interfaces:**
- Consumes: `renderFingering` (library), `resolveCardText`, `resolveStyle` (Task 6), `StaffNote` (Task 8), `fingeringsFor`, `getInstrument` (Task 5), `toMidi` (Task 4).
- Produces:
  ```tsx
  <FingeringView layout fingering style orient width />   // className "wc-fingering"
  interface WindCardProps {
    card: Pick<CardItem, 'pitch'|'fingeringIndex'|'display'|'orientation'|'scale'|'text'|'style'>;
    meta: BoardMeta;
    onPlay?: (which: 'voice' | 'piano') => void;
    showPlay?: 'hover' | 'always';
    className?: string;
  }
  <WindCard {...props} />   // root className "wc-card", data-orientation, data-display
  BASE_DIAGRAM_WIDTH = 120; BASE_STAFF_WIDTH = 150
  ```

- [ ] **Step 1: Failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindCard } from './WindCard';
import { createBoard, newCardDraft } from '@/state/defaults';
import { parsePitch } from '@/music/pitch';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));

const meta = { ...createBoard('saxophone').meta, horn: 'alto' };

describe('WindCard', () => {
  it('shows heading, subtitle, diagram and staff by default', () => {
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} />);
    expect(screen.getByText('C5')).toBeInTheDocument();
    expect(screen.getByText('sounds E♭4')).toBeInTheDocument();
    expect(container.querySelector('.wc-fingering svg')).not.toBeNull();
    expect(screen.getByTestId('staff')).toBeInTheDocument();
  });
  it('display=fingering hides the staff; notation hides the diagram', () => {
    const { rerender, container } = render(<WindCard card={{ ...newCardDraft(parsePitch('C5')), display: 'fingering' }} meta={meta} />);
    expect(screen.queryByTestId('staff')).toBeNull();
    rerender(<WindCard card={{ ...newCardDraft(parsePitch('C5')), display: 'notation' }} meta={meta} />);
    expect(container.querySelector('.wc-fingering')).toBeNull();
  });
  it('scale sizes the diagram', () => {
    const { container } = render(<WindCard card={{ ...newCardDraft(parsePitch('C5')), scale: 2 }} meta={meta} />);
    expect((container.querySelector('.wc-fingering') as HTMLElement).style.width).toBe('240px');
  });
  it('fires play callbacks', async () => {
    const onPlay = vi.fn();
    render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} onPlay={onPlay} showPlay="always" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play voice' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play piano' }));
    expect(onPlay.mock.calls).toEqual([['voice'], ['piano']]);
  });
  it('shows a placeholder when the note has no fingering', () => {
    render(<WindCard card={newCardDraft(parsePitch('C2'))} meta={meta} />);
    expect(screen.getByText('No fingering')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `FingeringView.tsx`**

```tsx
import { useMemo, type CSSProperties } from 'react';
import { renderFingering, type Fingering, type Layout } from '@pepperhorn/fingering-components';
import type { DiagramStyle } from '@/state/types';

export function FingeringView({ layout, fingering, style, orient, width }:
  { layout: Layout; fingering: Fingering; style: DiagramStyle; orient: 'vertical' | 'horizontal'; width: number }) {
  const svg = useMemo(() => renderFingering(layout, fingering, {
    title: false, width,
    variant: style.variants,
    look: style.look === 'solid' ? undefined : style.look,
    twoTone: style.twoTone ? 'hand' : undefined,
    hints: style.hints,
    orient,
  }), [layout, fingering, style, orient, width]);
  const vars = { '--fc-ink': style.primary, '--fc-ink-2': style.secondary, '--fc-font': 'Poppins, sans-serif' } as CSSProperties;
  return <div className="wc-fingering [&_svg]:h-auto [&_svg]:w-full" style={{ ...vars, width }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

- [ ] **Step 4: Implement `WindCard.tsx`**

```tsx
import type { BoardMeta, CardItem, TextField } from '@/state/types';
import { resolveCardText, resolveStyle } from '@/state/resolve';
import { fingeringsFor, getInstrument } from '@/music/instruments';
import { toMidi } from '@/music/pitch';
import { StaffNote } from '@/notation/StaffNote';
import { FingeringView } from './FingeringView';

export const BASE_DIAGRAM_WIDTH = 120;
export const BASE_STAFF_WIDTH = 150;

const SIZE = { heading: { S: 'text-xs', M: 'text-sm', L: 'text-lg' }, other: { S: 'text-[11px]', M: 'text-xs', L: 'text-sm' } } as const;
const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function Line({ f, kind, cls }: { f: TextField; kind: 'heading' | 'other'; cls: string }) {
  if (!f.show) return null;
  return <div className={`${cls} w-full ${SIZE[kind][f.size]} ${ALIGN[f.align]} ${kind === 'heading' ? 'font-semibold text-ink' : 'text-muted'}`}>{f.text}</div>;
}

export interface WindCardProps {
  card: Pick<CardItem, 'pitch' | 'fingeringIndex' | 'display' | 'orientation' | 'scale' | 'text' | 'style'>;
  meta: BoardMeta;
  onPlay?: (which: 'voice' | 'piano') => void;
  showPlay?: 'hover' | 'always';
  className?: string;
}

export function WindCard({ card, meta, onPlay, showPlay = 'hover', className = '' }: WindCardProps) {
  const info = getInstrument(meta.instrument);
  const text = resolveCardText(card, meta);
  const style = resolveStyle(card, meta);
  const options = fingeringsFor(meta.instrument, meta.horn, toMidi(card.pitch));
  const fingering = options[Math.min(card.fingeringIndex, options.length - 1)];
  const dW = Math.round(BASE_DIAGRAM_WIDTH * card.scale);
  const sW = Math.round(BASE_STAFF_WIDTH * card.scale);
  const showDiagram = card.display !== 'notation';
  const showStaff = card.display !== 'fingering';
  const horizontal = card.orientation === 'horizontal';

  return (
    <div data-orientation={card.orientation} data-display={card.display}
      className={`wc-card group relative flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-surface p-4 shadow-glow transition-shadow hover:shadow-glow-strong ${className}`}>
      <Line f={text.heading} kind="heading" cls="wc-card-heading" />
      <Line f={text.subtitle} kind="other" cls="wc-card-subtitle" />
      <div className={`wc-card-body flex items-center justify-center gap-4 ${horizontal ? 'flex-row' : 'flex-col'}`}>
        {showDiagram && (fingering
          ? <FingeringView layout={info.layout} fingering={fingering} style={style} orient={meta.diagramOrient} width={dW} />
          : <div className="wc-fingering-missing text-xs text-muted" style={{ width: dW }}>No fingering</div>)}
        {showStaff && <StaffNote pitch={card.pitch} clef={info.clef} font={meta.musicFont} width={sW} />}
      </div>
      <Line f={text.footer} kind="other" cls="wc-card-footer" />
      {onPlay && (
        <div data-export-hide className={`wc-card-play absolute right-2 top-2 flex gap-1 ${showPlay === 'hover' ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : ''}`}>
          <button type="button" aria-label="Play voice" onClick={() => onPlay('voice')}
            className="btn-play-voice grid size-7 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white">♪</button>
          <button type="button" aria-label="Play piano" onClick={() => onPlay('piano')}
            className="btn-play-piano grid size-7 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white">🎹</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** — `"WindCard and FingeringView"`.

### Task 11: Piano keyboard + drawer

**Files:**
- Create: `src/components/pianoLayout.ts`, `src/components/PianoKeyboard.tsx`, `src/components/PianoDrawer.tsx`
- Test: `src/components/pianoLayout.test.ts`

**Interfaces:**
- Consumes: `RangeBands` (Task 5), `isBlackKey`, `fromMidi`, `formatPitch`, `prefersFlats` (Task 4).
- Produces:
  ```ts
  interface KeyGeom { midi: number; black: boolean; x: number; w: number }
  keyboardSpan(pro: Band, margin?: number): { low: number; high: number }  // snapped to C..B
  layoutKeys(low: number, high: number, whiteW?: number): { keys: KeyGeom[]; width: number }
  bandOf(midi: number, bands: RangeBands): 'beginner'|'intermediate'|'pro'|null
  ```
  ```tsx
  interface PianoKeyboardProps {
    bands: RangeBands;            // written midi
    offset: number;               // semitones added for display: 0 in written mode, semitones() in concert mode
    playable: Set<number>;        // written midi
    selected?: number;            // written midi
    preferFlats: boolean;
    onSelect(writtenMidi: number): void;
  }
  <PianoDrawer open onToggle soundOnClick onSoundOnClick soundVoice onSoundVoice>{keyboard}</PianoDrawer>
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { keyboardSpan, layoutKeys, bandOf } from './pianoLayout';

const bands = { beginner: { low: 62, high: 84 }, intermediate: { low: 58, high: 89 }, pro: { low: 58, high: 101 } };

describe('pianoLayout', () => {
  it('snaps span to whole octaves with margin', () => {
    expect(keyboardSpan(bands.pro)).toEqual({ low: 48, high: 107 });   // C3..B7
  });
  it('lays out white and black keys', () => {
    const { keys, width } = layoutKeys(60, 71, 20);
    expect(keys.filter((k) => !k.black)).toHaveLength(7);
    expect(width).toBe(140);
    const cs = keys.find((k) => k.midi === 61)!;
    expect(cs.black).toBe(true);
    expect(cs.x).toBeGreaterThan(0);
    expect(cs.w).toBeLessThan(20);
  });
  it('classifies bands innermost first', () => {
    expect(bandOf(70, bands)).toBe('beginner');
    expect(bandOf(59, bands)).toBe('intermediate');
    expect(bandOf(95, bands)).toBe('pro');
    expect(bandOf(40, bands)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `pianoLayout.ts`**

```ts
import type { Band, RangeBands } from '@/music/instruments';
import { isBlackKey } from '@/music/pitch';

export interface KeyGeom { midi: number; black: boolean; x: number; w: number }

export function keyboardSpan(pro: Band, margin = 2) {
  const low = Math.floor((pro.low - margin) / 12) * 12;
  const high = Math.ceil((pro.high + margin + 1) / 12) * 12 - 1;
  return { low, high };
}

export function layoutKeys(low: number, high: number, whiteW = 22) {
  const keys: KeyGeom[] = [];
  let x = 0;
  for (let m = low; m <= high; m++) {
    if (isBlackKey(m)) keys.push({ midi: m, black: true, x: x - whiteW * 0.3, w: whiteW * 0.6 });
    else { keys.push({ midi: m, black: false, x, w: whiteW }); x += whiteW; }
  }
  return { keys, width: x };
}

export function bandOf(midi: number, b: RangeBands): 'beginner' | 'intermediate' | 'pro' | null {
  for (const k of ['beginner', 'intermediate', 'pro'] as const) if (midi >= b[k].low && midi <= b[k].high) return k;
  return null;
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Implement `PianoKeyboard.tsx`** — SVG, horizontally scrollable, auto-scrolls the selected key into view.

```tsx
import { useEffect, useRef } from 'react';
import type { RangeBands } from '@/music/instruments';
import { formatPitch, fromMidi } from '@/music/pitch';
import { bandOf, keyboardSpan, layoutKeys } from './pianoLayout';

const BAND_FILL = { beginner: 'var(--color-band-beginner)', intermediate: 'var(--color-band-intermediate)', pro: 'var(--color-band-pro)' };
const WHITE_H = 120, BLACK_H = 76, STRIP = 10;

export interface PianoKeyboardProps {
  bands: RangeBands; offset: number; playable: Set<number>; selected?: number; preferFlats: boolean;
  onSelect(writtenMidi: number): void;
}

export function PianoKeyboard({ bands, offset, playable, selected, preferFlats, onSelect }: PianoKeyboardProps) {
  // everything is laid out in *display* midi (written + offset)
  const shifted = {
    beginner: { low: bands.beginner.low + offset, high: bands.beginner.high + offset },
    intermediate: { low: bands.intermediate.low + offset, high: bands.intermediate.high + offset },
    pro: { low: bands.pro.low + offset, high: bands.pro.high + offset },
  };
  const span = keyboardSpan(shifted.pro);
  const { keys, width } = layoutKeys(span.low, span.high);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = keys.find((x) => x.midi === (selected ?? shifted.beginner.low) + (selected == null ? 0 : offset));
    if (k && scroller.current) scroller.current.scrollTo({ left: k.x - scroller.current.clientWidth / 2, behavior: 'smooth' });
  }, [selected, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderKey = (k: (typeof keys)[number]) => {
    const written = k.midi - offset;
    const band = bandOf(k.midi, shifted);
    const enabled = band !== null && playable.has(written);
    const isSel = selected === written;
    const label = formatPitch(fromMidi(k.midi, preferFlats));
    const fill = isSel ? 'var(--color-accent)' : k.black ? (enabled ? '#2a3040' : '#9aa1b2') : enabled ? '#fff' : '#eef0f5';
    return (
      <g key={k.midi} className={`wc-piano-key ${k.black ? 'wc-piano-key--black' : 'wc-piano-key--white'}${isSel ? ' is-selected' : ''}`}
        role="button" aria-label={label} aria-pressed={isSel} aria-disabled={!enabled} tabIndex={enabled ? 0 : -1}
        style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
        onClick={() => enabled && onSelect(written)}
        onKeyDown={(e) => { if (enabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(written); } }}>
        <rect x={k.x} y={STRIP} width={k.w} height={k.black ? BLACK_H : WHITE_H} rx={k.black ? 3 : 5}
          fill={fill} stroke="#cfd4e0" strokeWidth={k.black ? 0 : 1}
          style={isSel ? { filter: 'drop-shadow(0 0 6px rgb(109 93 252 / .8))' } : undefined} />
        {!k.black && k.midi % 12 === 0 && (
          <text x={k.x + k.w / 2} y={STRIP + WHITE_H - 8} textAnchor="middle" fontSize={9} fontWeight={500} fill="#667085">{label}</text>
        )}
        {band && <rect x={k.x} y={0} width={k.w} height={STRIP - 2} rx={2} fill={BAND_FILL[band]} className={`wc-piano-band wc-piano-band--${band}`} />}
      </g>
    );
  };

  return (
    <div ref={scroller} className="wc-piano overflow-x-auto">
      <svg className="wc-piano-svg block" width={width} height={WHITE_H + STRIP + 2} viewBox={`0 0 ${width} ${WHITE_H + STRIP + 2}`}>
        {keys.filter((k) => !k.black).map(renderKey)}
        {keys.filter((k) => k.black).map(renderKey)}
      </svg>
    </div>
  );
}
```

- [ ] **Step 6: Implement `PianoDrawer.tsx`** — fixed bottom, handle tab toggles, legend, sound controls. Remembers `open` via the parent (Task 14 stores it in localStorage under `ph-winds-piano-open`).

```tsx
import type { ReactNode } from 'react';

export function PianoDrawer({ open, onToggle, soundOnClick, onSoundOnClick, soundVoice, onSoundVoice, children }: {
  open: boolean; onToggle(): void;
  soundOnClick: boolean; onSoundOnClick(v: boolean): void;
  soundVoice: 'voice' | 'piano'; onSoundVoice(v: 'voice' | 'piano'): void;
  children: ReactNode;
}) {
  return (
    <div className={`wc-piano-drawer fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-[calc(100%-2.25rem)]'}`}>
      <div className="wc-piano-handle-row flex justify-center">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="btn-piano-toggle h-9 rounded-t-xl border border-b-0 border-hairline bg-surface px-5 text-sm font-medium text-ink shadow-glow">
          {open ? 'Hide keyboard ▾' : 'Show keyboard ▴'}
        </button>
      </div>
      <div className="wc-piano-panel border-t border-hairline bg-surface/95 px-4 pb-4 pt-3 shadow-[0_-8px_30px_-12px_rgb(109_93_252/.35)] backdrop-blur">
        <div className="wc-piano-toolbar mb-2 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="wc-piano-legend flex items-center gap-3">
            <i className="wc-legend-swatch inline-block size-3 rounded bg-band-beginner" /> Beginner
            <i className="wc-legend-swatch inline-block size-3 rounded bg-band-intermediate" /> Intermediate
            <i className="wc-legend-swatch inline-block size-3 rounded bg-band-pro" /> Pro
          </span>
          <label className="wc-sound-toggle ml-auto flex items-center gap-2">
            <input type="checkbox" checked={soundOnClick} onChange={(e) => onSoundOnClick(e.target.checked)} /> Sound on click
          </label>
          <select className="wc-sound-voice rounded-md border border-hairline bg-surface px-2 py-1" value={soundVoice}
            onChange={(e) => onSoundVoice(e.target.value as 'voice' | 'piano')} disabled={!soundOnClick}>
            <option value="voice">Instrument</option>
            <option value="piano">Piano</option>
          </select>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit** — `"Range-banded piano keyboard and bottom drawer"`.

### Task 12: UI primitives, text controls, Builder

**Files:**
- Create: `src/components/ui.tsx`, `src/components/TextFieldControls.tsx`, `src/components/Builder.tsx`
- Test: `src/components/Builder.test.tsx`

**Interfaces:**
- Consumes: `WindCard` (Task 10), `FingeringView` (Task 10), `fingeringsFor`, `getInstrument` (Task 5), types (Task 6).
- Produces:
  ```tsx
  // ui.tsx
  <Segmented<T extends string> value options={{value:T,label:string}[]} onChange className? />   // "wc-segmented"
  <Chip selected onClick>{label}</Chip>                                                          // "wc-chip"
  <Slider value min max step onChange label format? />                                           // "wc-slider"
  <Swatches value presets onChange />                                                            // "wc-swatches" + <input type=color>
  <Button variant="filled"|"tonal"|"text" .../>                                                  // "btn"
  <Section title defaultOpen?>{children}</Section>                                               // collapsible "wc-section"
  // TextFieldControls.tsx
  <TextFieldControls label value: Partial<TextField> base: TextField onChange(patch: Partial<TextField>) placeholder? />
  // Builder.tsx
  interface BuilderDraft extends CardDraft { editingId?: string }
  <Builder draft: BuilderDraft | null  meta  onChange(d: BuilderDraft)  onCommit()  onCancelEdit()  onPlay(which) />
  ```

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Builder } from './Builder';
import { createBoard, newCardDraft } from '@/state/defaults';
import { parsePitch } from '@/music/pitch';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));
const meta = createBoard('clarinet').meta;

describe('Builder', () => {
  it('prompts when no note is picked', () => {
    render(<Builder draft={null} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} />);
    expect(screen.getByText(/Pick a note on the keyboard below/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to board' })).toBeDisabled();
  });
  it('lists alternates and switches display', async () => {
    const onChange = vi.fn();
    const draft = newCardDraft(parsePitch('E3'));
    render(<Builder draft={draft} meta={meta} onChange={onChange} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} />);
    const alts = screen.getAllByRole('radio', { name: /Fingering \d/ });
    expect(alts).toHaveLength(2);
    await userEvent.click(alts[1]);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fingeringIndex: 1 }));
    await userEvent.click(screen.getByRole('radio', { name: 'Notation' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ display: 'notation' }));
  });
  it('commits and shows Update when editing', async () => {
    const onCommit = vi.fn();
    render(<Builder draft={{ ...newCardDraft(parsePitch('E3')), editingId: 'x' }} meta={meta} onChange={vi.fn()} onCommit={onCommit} onCancelEdit={vi.fn()} onPlay={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Update card' }));
    expect(onCommit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `ui.tsx`**

```tsx
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Segmented<T extends string>({ value, options, onChange, className = '', label }:
  { value: T; options: { value: T; label: string }[]; onChange(v: T): void; className?: string; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={`wc-segmented inline-flex rounded-full border border-hairline bg-canvas p-0.5 ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`wc-segmented-option rounded-full px-3 py-1 text-xs font-medium transition ${value === o.value ? 'bg-surface text-accent shadow-glow' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`wc-chip rounded-full border px-3 py-1 text-xs font-medium transition ${selected ? 'border-accent bg-accent-soft text-accent' : 'border-hairline bg-surface text-muted hover:text-ink'}`}>
      {children}
    </button>
  );
}

export function Slider({ value, min, max, step, onChange, label, format = String }:
  { value: number; min: number; max: number; step: number; onChange(v: number): void; label: string; format?: (v: number) => string }) {
  return (
    <label className="wc-slider flex items-center gap-3 text-xs text-muted">
      <span className="wc-slider-label w-12">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="wc-slider-input flex-1 accent-[var(--color-accent)]" />
      <span className="wc-slider-value w-10 text-right font-medium text-ink">{format(value)}</span>
    </label>
  );
}

export function Swatches({ value, presets, onChange, label }: { value: string; presets: string[]; onChange(v: string): void; label: string }) {
  return (
    <div className="wc-swatches flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {presets.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)}
          className={`wc-swatch size-6 rounded-full border-2 ${value === c ? 'border-accent ring-2 ring-accent/30' : 'border-white shadow'}`} style={{ background: c }} />
      ))}
      <input type="color" aria-label={`${label} custom`} value={value} onChange={(e) => onChange(e.target.value)} className="wc-swatch-custom size-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
    </div>
  );
}

export function Button({ variant = 'tonal', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'filled' | 'tonal' | 'text' }) {
  const v = {
    filled: 'bg-accent text-white shadow-glow hover:shadow-glow-strong disabled:opacity-40 disabled:shadow-none',
    tonal: 'bg-accent-soft text-accent hover:bg-accent/15 disabled:opacity-40',
    text: 'text-accent hover:bg-accent-soft disabled:opacity-40',
  }[variant];
  return <button type="button" className={`btn btn-${variant} rounded-full px-4 py-2 text-sm font-medium transition ${v} ${className}`} {...rest} />;
}

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="wc-section rounded-xl border border-hairline bg-surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="wc-section-toggle flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-ink">
        {title}<span aria-hidden="true" className="wc-section-caret text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="wc-section-body space-y-3 border-t border-hairline px-4 py-3">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Implement `TextFieldControls.tsx`**

```tsx
import type { TextField } from '@/state/types';
import { Segmented } from './ui';

export function TextFieldControls({ label, value, base, onChange, placeholder }:
  { label: string; value: Partial<TextField>; base: TextField; onChange(p: Partial<TextField>): void; placeholder?: string }) {
  const v = { ...base, ...value };
  return (
    <div className="wc-text-field grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <label className="wc-text-field-label flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={v.show} onChange={(e) => onChange({ show: e.target.checked })} aria-label={`Show ${label}`} />{label}
      </label>
      <div className="wc-text-field-controls flex flex-wrap items-center gap-2">
        <input value={value.text ?? ''} placeholder={placeholder ?? base.text} onChange={(e) => onChange({ text: e.target.value })}
          aria-label={`${label} text`} className="wc-text-input min-w-0 flex-1 rounded-lg border border-hairline px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
        <Segmented label={`${label} size`} value={v.size} onChange={(size) => onChange({ size })}
          options={[{ value: 'S', label: 'S' }, { value: 'M', label: 'M' }, { value: 'L', label: 'L' }]} />
        <Segmented label={`${label} align`} value={v.align} onChange={(align) => onChange({ align })}
          options={[{ value: 'left', label: '⟸' }, { value: 'center', label: '≡' }, { value: 'right', label: '⟹' }]} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `Builder.tsx`**

```tsx
import type { BoardMeta, CardDraft, TextKey } from '@/state/types';
import { autoHeading, autoSubtitle } from '@/state/resolve';
import { fingeringsFor, getInstrument, semitones } from '@/music/instruments';
import { toMidi } from '@/music/pitch';
import { resolveStyle } from '@/state/resolve';
import { WindCard } from './WindCard';
import { FingeringView } from './FingeringView';
import { TextFieldControls } from './TextFieldControls';
import { Button, Segmented, Slider } from './ui';

export interface BuilderDraft extends CardDraft { editingId?: string }

export function Builder({ draft, meta, onChange, onCommit, onCancelEdit, onPlay }: {
  draft: BuilderDraft | null; meta: BoardMeta;
  onChange(d: BuilderDraft): void; onCommit(): void; onCancelEdit(): void; onPlay(which: 'voice' | 'piano'): void;
}) {
  const set = (p: Partial<BuilderDraft>) => draft && onChange({ ...draft, ...p });
  const options = draft ? fingeringsFor(meta.instrument, meta.horn, toMidi(draft.pitch)) : [];
  const layout = getInstrument(meta.instrument).layout;
  const semis = semitones(meta.instrument, meta.horn);
  const setText = (k: TextKey, p: object) => draft && set({ text: { ...draft.text, [k]: { ...draft.text?.[k], ...p } } });

  return (
    <section className="wc-builder grid gap-6 rounded-3xl border border-hairline bg-surface/80 p-6 shadow-glow backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="wc-builder-preview grid min-h-64 place-items-center rounded-2xl bg-canvas p-4">
        {draft
          ? <WindCard card={draft} meta={meta} onPlay={onPlay} showPlay="always" />
          : <p className="wc-builder-empty text-sm text-muted">Pick a note on the keyboard below</p>}
      </div>
      <div className="wc-builder-controls space-y-4">
        <div className="wc-builder-row flex flex-wrap gap-3">
          <Segmented label="Display" value={draft?.display ?? 'both'} onChange={(display) => set({ display })}
            options={[{ value: 'fingering', label: 'Fingering' }, { value: 'both', label: 'Both' }, { value: 'notation', label: 'Notation' }]} />
          <Segmented label="Card layout" value={draft?.orientation ?? 'vertical'} onChange={(orientation) => set({ orientation })}
            options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]} />
        </div>
        <Slider label="Scale" value={draft?.scale ?? 1} min={0.5} max={2} step={0.1} onChange={(scale) => set({ scale })}
          format={(v) => `${Math.round(v * 100)}%`} />
        {options.length > 1 && (
          <div role="radiogroup" aria-label="Fingerings" className="wc-alternates flex flex-wrap gap-2">
            {options.map((f, i) => (
              <button key={i} type="button" role="radio" aria-checked={draft?.fingeringIndex === i} aria-label={`Fingering ${i + 1}`}
                onClick={() => set({ fingeringIndex: i })}
                className={`wc-alternate rounded-xl border p-1.5 transition ${draft?.fingeringIndex === i ? 'border-accent shadow-glow-strong' : 'border-hairline hover:shadow-glow'}`}>
                <FingeringView layout={layout} fingering={f} style={resolveStyle(draft ?? {}, meta)} orient={meta.diagramOrient} width={44} />
              </button>
            ))}
          </div>
        )}
        <div className="wc-builder-text space-y-2">
          <TextFieldControls label="Heading" value={draft?.text?.heading ?? {}} base={meta.cardText.heading}
            placeholder={draft ? autoHeading(draft.pitch) : ''} onChange={(p) => setText('heading', p)} />
          <TextFieldControls label="Subtitle" value={draft?.text?.subtitle ?? {}} base={meta.cardText.subtitle}
            placeholder={draft ? autoSubtitle(draft.pitch, semis) : ''} onChange={(p) => setText('subtitle', p)} />
          <TextFieldControls label="Footer" value={draft?.text?.footer ?? {}} base={meta.cardText.footer} onChange={(p) => setText('footer', p)} />
        </div>
        <div className="wc-builder-actions flex items-center gap-3">
          <Button variant="filled" disabled={!draft} onClick={onCommit} className="btn-add-card">
            {draft?.editingId ? 'Update card' : 'Add to board'}
          </Button>
          {draft?.editingId && <Button variant="text" onClick={onCancelEdit} className="btn-cancel-edit">Cancel</Button>}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run** → PASS. **Step 7: Commit** — `"Builder with alternates, display, scale and text controls"`.

### Task 13: Board settings + diagram style

**Files:**
- Create: `src/components/DiagramStyleControls.tsx`, `src/components/BoardSettings.tsx`
- Test: `src/components/BoardSettings.test.tsx`

**Interfaces:**
- Consumes: `ui.tsx`, `TextFieldControls` (Task 12), `listInstruments`, `getInstrument` (Task 5), `COLOR_PRESETS` (Task 6).
- Produces:
  ```tsx
  <DiagramStyleControls value: DiagramStyle variants: string[] onChange(p: Partial<DiagramStyle>) />
  <BoardSettings meta hasCards onMeta(p: Partial<BoardMeta>) onInstrument(id: string, horn?: string) />
  // BoardSettings calls onInstrument only after window.confirm when hasCards is true.
  ```

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardSettings } from './BoardSettings';
import { createBoard } from '@/state/defaults';

describe('BoardSettings', () => {
  it('asks before changing instrument when the board has cards', async () => {
    const onInstrument = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<BoardSettings meta={createBoard('saxophone').meta} hasCards onMeta={vi.fn()} onInstrument={onInstrument} />);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    expect(confirm).toHaveBeenCalled();
    expect(onInstrument).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    expect(onInstrument).toHaveBeenCalledWith('flute', undefined);
  });
  it('toggles pitch mode and variant chips', async () => {
    const onMeta = vi.fn();
    render(<BoardSettings meta={createBoard('saxophone').meta} hasCards={false} onMeta={onMeta} onInstrument={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Concert' }));
    expect(onMeta).toHaveBeenCalledWith({ pitchMode: 'concert' });
    await userEvent.click(screen.getByRole('button', { name: 'Diagram style' }));
    await userEvent.click(screen.getByRole('button', { name: 'palm-bean' }));
    expect(onMeta).toHaveBeenLastCalledWith({ style: expect.objectContaining({ variants: ['palm-bean'] }) });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `DiagramStyleControls.tsx`**

```tsx
import type { DiagramStyle } from '@/state/types';
import { COLOR_PRESETS } from '@/state/defaults';
import { Chip, Segmented, Swatches } from './ui';

export function DiagramStyleControls({ value, variants, onChange }: { value: DiagramStyle; variants: string[]; onChange(p: Partial<DiagramStyle>): void }) {
  const toggle = (v: string) => onChange({ variants: value.variants.includes(v) ? value.variants.filter((x) => x !== v) : [...value.variants, v] });
  return (
    <div className="wc-diagram-style space-y-3">
      {variants.length > 0 && (
        <div className="wc-variant-chips flex flex-wrap gap-1.5">
          {variants.map((v) => <Chip key={v} selected={value.variants.includes(v)} onClick={() => toggle(v)}>{v}</Chip>)}
        </div>
      )}
      <div className="wc-style-row flex flex-wrap items-center gap-3 text-xs text-muted">
        <Segmented label="Look" value={value.look} onChange={(look) => onChange({ look })}
          options={[{ value: 'solid', label: 'Solid' }, { value: 'dotted', label: 'Dotted' }, { value: 'ghost', label: 'Ghost' }]} />
        <label className="wc-style-twotone flex items-center gap-1.5"><input type="checkbox" checked={value.twoTone} onChange={(e) => onChange({ twoTone: e.target.checked })} />Two-tone hands</label>
        <label className="wc-style-hints flex items-center gap-1.5"><input type="checkbox" checked={value.hints} onChange={(e) => onChange({ hints: e.target.checked })} />Hints</label>
      </div>
      <div className="wc-style-colors grid gap-2 text-xs text-muted">
        <div className="flex items-center gap-3"><span className="w-20">Pressed</span><Swatches label="Pressed colour" value={value.primary} presets={COLOR_PRESETS} onChange={(primary) => onChange({ primary })} /></div>
        {value.twoTone && <div className="flex items-center gap-3"><span className="w-20">Right hand</span><Swatches label="Right hand colour" value={value.secondary} presets={COLOR_PRESETS} onChange={(secondary) => onChange({ secondary })} /></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `BoardSettings.tsx`**

```tsx
import type { BoardMeta, TextKey } from '@/state/types';
import { getInstrument, listInstruments } from '@/music/instruments';
import { DiagramStyleControls } from './DiagramStyleControls';
import { TextFieldControls } from './TextFieldControls';
import { Section, Segmented } from './ui';

const CONFIRM = 'Changing instrument clears the board. Continue?';

export function BoardSettings({ meta, hasCards, onMeta, onInstrument }:
  { meta: BoardMeta; hasCards: boolean; onMeta(p: Partial<BoardMeta>): void; onInstrument(id: string, horn?: string): void }) {
  const info = getInstrument(meta.instrument);
  const change = (id: string, horn?: string) => { if (!hasCards || window.confirm(CONFIRM)) onInstrument(id, horn); };
  const setCardText = (k: TextKey, p: object) => onMeta({ cardText: { ...meta.cardText, [k]: { ...meta.cardText[k], ...p } } });

  return (
    <section className="wc-board-settings space-y-3">
      <div className="wc-board-settings-main flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-glow">
        <label className="wc-instrument-select flex items-center gap-2 text-sm">
          <span className="text-muted">Instrument</span>
          <select aria-label="Instrument" value={meta.instrument} onChange={(e) => change(e.target.value)}
            className="rounded-lg border border-hairline bg-surface px-2 py-1.5 font-medium">
            {listInstruments().map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        {info.horns.length > 0 && (
          <select aria-label="Horn" value={meta.horn} onChange={(e) => change(meta.instrument, e.target.value)}
            className="wc-horn-select rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm">
            {info.horns.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
        <Segmented label="Pitch" value={meta.pitchMode} onChange={(pitchMode) => onMeta({ pitchMode })}
          options={[{ value: 'written', label: 'Written' }, { value: 'concert', label: 'Concert' }]} />
        <Segmented label="Music font" value={meta.musicFont} onChange={(musicFont) => onMeta({ musicFont })}
          options={[{ value: 'bravura', label: 'Bravura' }, { value: 'petaluma', label: 'Petaluma' }]} />
        <Segmented label="Diagram" value={meta.diagramOrient} onChange={(diagramOrient) => onMeta({ diagramOrient })}
          options={[{ value: 'vertical', label: 'Upright' }, { value: 'horizontal', label: 'Sideways' }]} />
        <Segmented label="Columns" value={String(meta.columns)} onChange={(c) => onMeta({ columns: c === 'auto' ? 'auto' : Number(c) })}
          options={[{ value: 'auto', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
      </div>
      <div className="wc-board-settings-sections grid gap-3 md:grid-cols-2">
        <Section title="Diagram style">
          <DiagramStyleControls value={meta.style} variants={Object.keys(info.layout.variants ?? {})}
            onChange={(p) => onMeta({ style: { ...meta.style, ...p } })} />
        </Section>
        <Section title="Text">
          <p className="text-xs font-medium text-ink">Board</p>
          <TextFieldControls label="Title" value={meta.title} base={meta.title} onChange={(p) => onMeta({ title: { ...meta.title, ...p } })} placeholder="Board title" />
          <TextFieldControls label="Subtitle" value={meta.subtitle} base={meta.subtitle} onChange={(p) => onMeta({ subtitle: { ...meta.subtitle, ...p } })} placeholder="Subtitle" />
          <TextFieldControls label="Footer" value={meta.footer} base={meta.footer} onChange={(p) => onMeta({ footer: { ...meta.footer, ...p } })} placeholder="Footer" />
          <p className="pt-2 text-xs font-medium text-ink">Card defaults</p>
          <TextFieldControls label="Heading" value={meta.cardText.heading} base={meta.cardText.heading} onChange={(p) => setCardText('heading', p)} placeholder="Note name" />
          <TextFieldControls label="Subtitle" value={meta.cardText.subtitle} base={meta.cardText.subtitle} onChange={(p) => setCardText('subtitle', p)} placeholder="Sounding pitch" />
          <TextFieldControls label="Footer" value={meta.cardText.footer} base={meta.cardText.footer} onChange={(p) => setCardText('footer', p)} />
        </Section>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** — `"Board settings and diagram style controls"`.

### Task 14: Board grid, app shell, wiring

**Files:**
- Create: `src/components/Board.tsx`, `src/components/AppBar.tsx`, `src/components/AboutDialog.tsx`, `src/components/Toast.tsx`
- Modify: `src/app/WindCardsApp.tsx` (replace stub)
- Test: `src/app/WindCardsApp.test.tsx`

**Interfaces:**
- Consumes: everything above; `playNote`, `releaseVoicesExcept` (Task 9); `prefetchVerovio`, `shouldPrefetch` (Task 8).
- Produces:
  ```tsx
  <Board state onReorder(fromId,toId) onEdit(id) onDuplicate(id) onRemove(id) onMeta(p) onPlay(card, which) selectedId? />
  // root: <div id="wc-board-export" className="wc-board ..."> — the export target for Task 15
  <AppBar onNew onImport(file: File) onExportJson onExportPng onExportPdf onAbout />
  <AboutDialog open onClose />
  useToast(): { toast(msg: string): void; node: ReactNode }
  ```

- [ ] **Step 1: Failing integration test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WindCardsApp from './WindCardsApp';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));
vi.mock('@/notation/verovio', () => ({ prefetchVerovio: vi.fn(), shouldPrefetch: () => false, pendingRenders: () => Promise.resolve() }));
vi.mock('@/audio/playback', () => ({ playNote: vi.fn(() => Promise.resolve()), releaseVoicesExcept: vi.fn(), isVoiceLoaded: () => true }));

describe('WindCardsApp', () => {
  beforeEach(() => localStorage.clear());
  it('picks a note on the piano, adds a card, persists it', async () => {
    const { unmount } = render(<WindCardsApp />);
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    const board = document.getElementById('wc-board-export')!;
    expect(within(board).getByText('C5')).toBeInTheDocument();
    unmount();
    render(<WindCardsApp />);
    expect(within(document.getElementById('wc-board-export')!).getByText('C5')).toBeInTheDocument();
  });
  it('concert mode maps key clicks to written pitch', async () => {
    render(<WindCardsApp />);   // default: alto sax
    await userEvent.click(screen.getByRole('radio', { name: 'Concert' }));
    await userEvent.click(screen.getByRole('button', { name: 'E♭4' }));
    expect(within(document.querySelector('.wc-builder-preview')!).getByText('C5')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `Toast.tsx`**

```tsx
import { useCallback, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); }, []);
  const node = msg && (
    <div role="status" className="wc-toast fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-glow-strong">{msg}</div>
  );
  return { toast, node };
}
```

- [ ] **Step 4: Implement `AboutDialog.tsx`** — native `<dialog>` opened with `showModal()` in an effect when `open` flips true; content:
  - "ph-winds — fingering and notation cards for wind instruments."
  - Credits list: Fingering diagrams — @pepperhorn/fingering-components (MIT); Notation — Verovio (LGPL-3.0), Bravura and Petaluma fonts by Steinberg (SIL OFL 1.1); Sounds — FluidR3_GM by Frank Wen (MIT) via gleitz/midi-js-soundfonts (CC BY 3.0); Recorder samples — Versilian Community Sample Library by Sam Gossner (CC0); Playback — smplr by danigb (MIT).
  - Close button `btn-about-close`. Root class `wc-about`.

```tsx
import { useEffect, useRef } from 'react';
import { Button } from './ui';

const CREDITS = [
  ['Fingering diagrams', '@pepperhorn/fingering-components (MIT)'],
  ['Notation', 'Verovio (LGPL-3.0); Bravura and Petaluma by Steinberg (SIL OFL 1.1)'],
  ['Sounds', 'FluidR3_GM by Frank Wen (MIT), via gleitz/midi-js-soundfonts (CC BY 3.0)'],
  ['Recorder samples', 'Versilian Community Sample Library by Sam Gossner (CC0)'],
  ['Playback', 'smplr by danigb (MIT)'],
];

export function AboutDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal?.(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="wc-about m-auto max-w-md rounded-3xl border border-hairline p-6 shadow-glow-strong backdrop:bg-ink/30">
      <h2 className="text-lg font-semibold">ph-winds</h2>
      <p className="mt-1 text-sm text-muted">Fingering and notation cards for wind instruments.</p>
      <dl className="wc-credits mt-4 space-y-2 text-sm">
        {CREDITS.map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="text-muted">{v}</dd></div>)}
      </dl>
      <div className="mt-6 flex justify-end"><Button variant="tonal" onClick={onClose} className="btn-about-close">Close</Button></div>
    </dialog>
  );
}
```

- [ ] **Step 5: Implement `AppBar.tsx`**

```tsx
import { useRef } from 'react';
import { Button } from './ui';

export function AppBar({ onNew, onImport, onExportJson, onExportPng, onExportPdf, onAbout }: {
  onNew(): void; onImport(f: File): void; onExportJson(): void; onExportPng(): void; onExportPdf(): void; onAbout(): void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <header className="wc-appbar sticky top-0 z-30 mb-6 flex flex-wrap items-center gap-2 border-b border-hairline bg-canvas/80 px-6 py-3 backdrop-blur">
      <h1 className="wc-wordmark mr-auto text-xl font-semibold tracking-tight">ph<span className="text-accent">·</span>winds</h1>
      <Button variant="text" onClick={onNew} className="btn-new">New</Button>
      <Button variant="text" onClick={() => file.current?.click()} className="btn-import">Import</Button>
      <input ref={file} type="file" accept="application/json,.json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
      <Button variant="text" onClick={onExportJson} className="btn-export-json">JSON</Button>
      <Button variant="tonal" onClick={onExportPng} className="btn-export-png">PNG</Button>
      <Button variant="tonal" onClick={onExportPdf} className="btn-export-pdf">PDF</Button>
      <Button variant="text" onClick={onAbout} aria-label="About" className="btn-about">ⓘ</Button>
    </header>
  );
}
```

- [ ] **Step 6: Implement `Board.tsx`** — board chrome (title/subtitle/footer rendered from `meta`, editable in place with `contentEditable`-free inputs styled as text), grid honouring `columns`, drag handle reorder, hover toolbar.

```tsx
import { useState } from 'react';
import type { BoardMeta, BoardState, CardItem, TextField } from '@/state/types';
import { WindCard } from './WindCard';

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const TITLE = { S: 'text-xl', M: 'text-2xl', L: 'text-3xl' } as const;
const SMALL = { S: 'text-sm', M: 'text-base', L: 'text-lg' } as const;

function ChromeInput({ f, onChange, cls, sizes, placeholder, weight }:
  { f: TextField; onChange(p: Partial<TextField>): void; cls: string; sizes: Record<'S' | 'M' | 'L', string>; placeholder: string; weight: string }) {
  if (!f.show) return null;
  return (
    <input value={f.text} placeholder={placeholder} onChange={(e) => onChange({ text: e.target.value })} aria-label={placeholder}
      className={`${cls} w-full bg-transparent ${sizes[f.size]} ${ALIGN[f.align]} ${weight} placeholder:text-muted/50 focus:outline-none`} />
  );
}

export function Board({ state, onReorder, onEdit, onDuplicate, onRemove, onMeta, onPlay, selectedId }: {
  state: BoardState; selectedId?: string;
  onReorder(fromId: string, toId: string): void; onEdit(id: string): void; onDuplicate(id: string): void; onRemove(id: string): void;
  onMeta(p: Partial<BoardMeta>): void; onPlay(card: CardItem, which: 'voice' | 'piano'): void;
}) {
  const { meta, items } = state;
  const [drag, setDrag] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const grid = meta.columns === 'auto'
    ? 'flex flex-wrap justify-center items-start'
    : `grid items-start justify-items-center ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][meta.columns]}`;

  return (
    <section id="wc-board-export" className="wc-board rounded-3xl border border-hairline bg-surface p-8 shadow-glow">
      <ChromeInput f={meta.title} cls="wc-board-title" sizes={TITLE} weight="font-semibold" placeholder="Board title" onChange={(p) => onMeta({ title: { ...meta.title, ...p } })} />
      <ChromeInput f={meta.subtitle} cls="wc-board-subtitle mt-1 text-muted" sizes={SMALL} weight="font-normal" placeholder="Subtitle" onChange={(p) => onMeta({ subtitle: { ...meta.subtitle, ...p } })} />
      {items.length === 0
        ? <p className="wc-board-empty py-16 text-center text-sm text-muted">Pick a note on the keyboard, then “Add to board”.</p>
        : (
          <div className={`wc-board-grid mt-6 gap-5 ${grid}`}>
            {items.map((c) => (
              <div key={c.id} draggable={armed === c.id}
                onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setArmed(null); }}
                onDragOver={(e) => { if (drag) e.preventDefault(); }}
                onDrop={() => { if (drag && drag !== c.id) onReorder(drag, c.id); setDrag(null); }}
                className={`wc-board-item group/item relative ${drag === c.id ? 'opacity-40' : ''} ${selectedId === c.id ? 'rounded-2xl ring-2 ring-accent' : ''}`}>
                <WindCard card={c} meta={meta} onPlay={(w) => onPlay(c, w)} />
                <div data-export-hide className="wc-card-toolbar absolute -top-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-hairline bg-surface px-1.5 py-1 opacity-0 shadow-glow transition group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                  <button type="button" aria-label="Drag to reorder" onPointerDown={() => setArmed(c.id)} onPointerUp={() => setArmed(null)}
                    className="btn-drag cursor-grab px-1.5 text-muted">⠿</button>
                  <button type="button" aria-label="Edit card" onClick={() => onEdit(c.id)} className="btn-edit px-1.5 text-xs">Edit</button>
                  <button type="button" aria-label="Duplicate card" onClick={() => onDuplicate(c.id)} className="btn-duplicate px-1.5 text-xs">Copy</button>
                  <button type="button" aria-label="Delete card" onClick={() => onRemove(c.id)} className="btn-delete px-1.5 text-xs text-red-500">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      <div className="mt-6"><ChromeInput f={meta.footer} cls="wc-board-footer text-muted" sizes={SMALL} weight="font-normal" placeholder="Footer" onChange={(p) => onMeta({ footer: { ...meta.footer, ...p } })} /></div>
    </section>
  );
}
```

- [ ] **Step 7: Implement `WindCardsApp.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindBoard } from '@/state/useWindBoard';
import { newCardDraft, createBoard } from '@/state/defaults';
import { exportBoardJson, importBoardJson } from '@/state/io';
import type { CardItem } from '@/state/types';
import { playableMidis, rangeBands, semitones, spellWritten } from '@/music/instruments';
import { prefersFlats, toMidi, type Pitch } from '@/music/pitch';
import { instrumentVoice, PIANO_VOICE, soundingMidi } from '@/audio/voices';
import { playNote, releaseVoicesExcept } from '@/audio/playback';
import { prefetchVerovio, shouldPrefetch } from '@/notation/verovio';
import { exportBoardImage, downloadText } from '@/export/image';
import { AppBar } from '@/components/AppBar';
import { AboutDialog } from '@/components/AboutDialog';
import { Board } from '@/components/Board';
import { BoardSettings } from '@/components/BoardSettings';
import { Builder, type BuilderDraft } from '@/components/Builder';
import { PianoDrawer } from '@/components/PianoDrawer';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { useToast } from '@/components/Toast';

const readPref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writePref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export default function WindCardsApp() {
  const { toast, node: toastNode } = useToast();
  const board = useWindBoard();
  const { state } = board;
  const { meta } = state;
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [pianoOpen, setPianoOpen] = useState(() => readPref('ph-winds-piano-open', true));
  const [soundOnClick, setSoundOnClick] = useState(() => readPref('ph-winds-sound-on-click', true));
  const [soundVoice, setSoundVoice] = useState<'voice' | 'piano'>(() => readPref('ph-winds-sound-voice', 'voice'));
  const [about, setAbout] = useState(false);

  useEffect(() => writePref('ph-winds-piano-open', pianoOpen), [pianoOpen]);
  useEffect(() => writePref('ph-winds-sound-on-click', soundOnClick), [soundOnClick]);
  useEffect(() => writePref('ph-winds-sound-voice', soundVoice), [soundVoice]);
  useEffect(() => { if (shouldPrefetch()) requestIdleCallback?.(() => prefetchVerovio()); }, []);
  useEffect(() => { releaseVoicesExcept([instrumentVoice(meta.instrument, meta.horn), PIANO_VOICE]); }, [meta.instrument, meta.horn]);

  const semis = semitones(meta.instrument, meta.horn);
  const bands = useMemo(() => rangeBands(meta.instrument, meta.horn), [meta.instrument, meta.horn]);
  const playable = useMemo(() => playableMidis(meta.instrument, meta.horn), [meta.instrument, meta.horn]);

  const play = useCallback((pitch: Pitch, which: 'voice' | 'piano') => {
    const voice = which === 'piano' ? PIANO_VOICE : instrumentVoice(meta.instrument, meta.horn);
    playNote(voice, soundingMidi(pitch, meta.instrument, meta.horn)).catch(() => toast('Could not load that sound'));
  }, [meta.instrument, meta.horn, toast]);

  const selectNote = (writtenMidi: number) => {
    const pitch = spellWritten(meta.instrument, meta.horn, writtenMidi);
    setDraft((d) => (d ? { ...d, pitch, fingeringIndex: 0 } : newCardDraft(pitch)));
    if (soundOnClick) play(pitch, soundVoice);
  };

  const commit = () => {
    if (!draft) return;
    const { editingId, ...card } = draft;
    if (editingId) board.updateCard(editingId, card); else board.addCard(card);
    setDraft(editingId ? null : { ...card, text: undefined });
  };

  const edit = (id: string) => {
    const c = state.items.find((x) => x.id === id);
    if (c) { const { id: _id, ...rest } = c; setDraft({ ...rest, editingId: id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const onImport = async (f: File) => {
    const r = importBoardJson(await f.text());
    if (r.ok) { board.replaceState(r.state); setDraft(null); } else toast(r.error);
  };

  const onNew = () => {
    if (state.items.length && !window.confirm('Start a new board? This clears the current one.')) return;
    board.replaceState(createBoard(meta.instrument)); setDraft(null);
  };

  const exportImage = (kind: 'png' | 'pdf') =>
    exportBoardImage(document.getElementById('wc-board-export')!, kind, meta.title.text || 'ph-winds-board').catch(() => toast('Export failed'));

  return (
    <div className={`wc-app min-h-screen ${pianoOpen ? 'pb-72' : 'pb-16'}`}>
      <AppBar onNew={onNew} onImport={onImport} onAbout={() => setAbout(true)}
        onExportJson={() => downloadText(exportBoardJson(state), `${meta.title.text || 'ph-winds-board'}.json`, 'application/json')}
        onExportPng={() => exportImage('png')} onExportPdf={() => exportImage('pdf')} />
      <main className="wc-main mx-auto max-w-[1200px] space-y-6 px-6">
        <Builder draft={draft} meta={meta} onChange={setDraft} onCommit={commit} onCancelEdit={() => setDraft(null)}
          onPlay={(w) => draft && play(draft.pitch, w)} />
        <BoardSettings meta={meta} hasCards={state.items.length > 0} onMeta={board.setMeta}
          onInstrument={(id, horn) => { board.setInstrument(id, horn); setDraft(null); }} />
        <Board state={state} selectedId={draft?.editingId} onReorder={board.reorder} onEdit={edit}
          onDuplicate={board.duplicateCard} onRemove={board.removeCard} onMeta={board.setMeta}
          onPlay={(c: CardItem, w) => play(c.pitch, w)} />
      </main>
      <PianoDrawer open={pianoOpen} onToggle={() => setPianoOpen(!pianoOpen)}
        soundOnClick={soundOnClick} onSoundOnClick={setSoundOnClick} soundVoice={soundVoice} onSoundVoice={setSoundVoice}>
        <PianoKeyboard bands={bands} offset={meta.pitchMode === 'concert' ? semis : 0} playable={playable}
          selected={draft ? toMidi(draft.pitch) : undefined} preferFlats={meta.pitchMode === 'concert' && prefersFlats(semis)}
          onSelect={selectNote} />
      </PianoDrawer>
      <AboutDialog open={about} onClose={() => setAbout(false)} />
      {toastNode}
    </div>
  );
}
```

Piano labels: sharps in written mode; in concert mode flats for E♭/B♭/F horns (`prefersFlats`). Card headings always use the fingering sheet's own spelling via `spellWritten`.

`requestIdleCallback` is missing in Safari/jsdom: guard with `typeof requestIdleCallback === 'function' ? requestIdleCallback(cb) : setTimeout(cb, 1500)`.

- [ ] **Step 8: Run** `pnpm test` → PASS (Task 15 creates `@/export/image`; until then add a stub module exporting `exportBoardImage = async () => {}` and `downloadText = () => {}` so this task's tests run, and replace it in Task 15).

- [ ] **Step 9: Manual pass** — `pnpm dev` (binds 0.0.0.0). Take Playwright screenshots at 1280×900 and 390×844 of: empty state, a board with 4 mixed cards (vertical + horizontal, 50% and 150% scale), the piano drawer open and closed, Petaluma. Fix layout issues seen. Check that no element lacks a `wc-`/`btn-` class.

- [ ] **Step 10: Commit** — `"App shell: builder, settings, board, piano drawer wired to state"`.

### Task 15: Export, e2e smoke, deploy config, PR

**Files:**
- Create/replace: `src/export/image.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `pendingRenders` (Task 8); `#wc-board-export` (Task 14); `[data-export-hide]` elements.
- Produces: `exportBoardImage(el: HTMLElement, kind: 'png'|'pdf', name: string): Promise<void>`, `downloadText(text: string, filename: string, mime: string): void`.

- [ ] **Step 1: Implement `image.ts`**

```ts
import { toPng } from 'html-to-image';
import { pendingRenders } from '@/notation/verovio';

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href; a.download = filename; a.click();
}

export function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';

export async function exportBoardImage(el: HTMLElement, kind: 'png' | 'pdf', name: string) {
  await pendingRenders();
  await document.fonts.ready;
  const png = await toPng(el, {
    pixelRatio: 2, backgroundColor: '#ffffff',
    filter: (n) => !(n instanceof HTMLElement && n.hasAttribute('data-export-hide')),
  });
  if (kind === 'png') return download(png, `${slug(name)}.png`);
  const { jsPDF } = await import('jspdf');
  const img = new Image(); img.src = png; await img.decode();
  const landscape = img.width > img.height;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 24;
  const s = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
  pdf.addImage(png, 'PNG', (pw - img.width * s) / 2, m, img.width * s, img.height * s);
  pdf.save(`${slug(name)}.pdf`);
}
```

- [ ] **Step 2: Playwright config + smoke**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'pnpm build && pnpm preview --port 4329', port: 4329, reuseExistingServer: false, timeout: 180_000 },
  use: { baseURL: 'http://localhost:4329' },
});
```

`e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('build a card, persist it, render Petaluma, play without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // stub audio: no network soundfonts in CI
  await page.addInitScript(() => {
    class FakeCtx { state = 'running'; resume() { return Promise.resolve(); } }
    (window as any).AudioContext = FakeCtx;
  });
  await page.route(/gleitz|smpldsnds/, (r) => r.abort());

  await page.goto('/');
  await page.getByRole('button', { name: 'C5', exact: true }).click();
  const alts = page.getByRole('radio', { name: /Fingering \d/ });
  if (await alts.count() > 1) await alts.nth(1).click();
  await page.getByRole('button', { name: 'Add to board' }).click();
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(1);

  await page.getByRole('radio', { name: 'Petaluma' }).click();
  await expect(page.locator('#wc-board-export .wc-staff svg')).toBeVisible({ timeout: 30_000 });

  await page.locator('#wc-board-export .wc-card').hover();
  await page.getByRole('button', { name: 'Play voice' }).first().click();
  await expect(page.getByRole('status')).toHaveText(/Could not load that sound/);   // network blocked → graceful toast
  expect(errors).toEqual([]);
});
```

Run: `pnpm exec playwright install chromium && pnpm e2e` → PASS.

- [ ] **Step 3: Manual export check** — `pnpm dev`, add 3 cards, click PNG and PDF, open both files: play buttons and card toolbars absent, staff and diagrams present, Poppins text.

- [ ] **Step 4: Manual audio check** — with network: alto sax written C5 → voice and piano both sound concert E♭4; tin whistle D board plays the VCSL recorder; B♭ whistle low B♭4 falls back to the FluidR3 recorder without error; DevTools Network shows only the soundfonts actually used.

- [ ] **Step 5: README** — replace with: what ph-winds is, stack, `pnpm install`, `pnpm dev` (0.0.0.0), `pnpm verify`, `pnpm e2e`, deployment (Coolify + nixpacks, `/healthz`), credits (same list as AboutDialog), license MIT.

- [ ] **Step 6: Final verification** — `pnpm verify && pnpm e2e && pnpm build` all green. Ensure `package.json` depends on `@pepperhorn/fingering-components@^0.2.0` (not a `link:`).

- [ ] **Step 7: Commit, push, PR**

```bash
git add -A && git commit -m "Export PNG/PDF, e2e smoke, deploy config, README"
git push -u origin feat/wind-cards
gh pr create --title "Wind cards v1" --body "…summary + test evidence…

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01FDhLyH6CXkkuUdAtjhvzmY"
```

Coolify deployment is set up with the user after merge (not in this plan).

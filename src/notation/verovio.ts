// Verovio toolkit loader + font registration.
//
// Verovio ships as a ~7 MB WASM module, so it is dynamically imported and the
// toolkit instance is cached behind a single promise. The bundled Bravura /
// Petaluma zips (see fonts/verovio + verovio-font-{bravura,petaluma}.generated.ts)
// are registered via `fontAddCustom` lazily, the first time each font is
// actually requested, rather than both being fetched and registered
// unconditionally at toolkit init — most sessions only ever render one font.
//
// Verified empirically (see PR description / commit message): calling
// `tk.setOptions({ fontAddCustom: [...] })` a second time, after the toolkit
// has already rendered at least once, is genuinely consumed by the next
// `renderToSVG` call — no toolkit re-init is needed to pick up a font
// registered after the fact.

export type VerovioFont = "Bravura" | "Petaluma";

// Minimal shape of the bits of the Verovio toolkit we use.
interface Toolkit {
  setOptions(opts: Record<string, unknown>): void;
  loadData(data: string): boolean;
  renderToSVG(page: number): string;
  getPageCount(): number;
}

/** Per-font generated module shape (see scripts/embed-verovio-fonts.mjs). */
const FONT_LOADERS: Record<VerovioFont, () => Promise<{ default?: never } & Record<string, string>>> = {
  Bravura: () => import("./verovio-font-bravura.generated"),
  Petaluma: () => import("./verovio-font-petaluma.generated"),
};
const FONT_CONST_NAME: Record<VerovioFont, string> = {
  Bravura: "BRAVURA_ZIP_B64",
  Petaluma: "PETALUMA_ZIP_B64",
};

let toolkitPromise: Promise<Toolkit> | null = null;
// Set once the cached attempt has actually resolved, and never cleared: the
// toolkit is a module-level singleton, so "has Verovio finished loading?" is
// answerable synchronously from here. `isVerovioReady` below is the only
// reader; it exists so a caller can tell a genuine download from a queue.
//
// This tracks *toolkit* readiness only, not *font* readiness — a toolkit can
// be ready while a given font's zip is still being fetched/registered on its
// first use. Font registration is a separate, per-font axis (`registeredFonts`
// below); nothing today needs to ask "is font X ready" independently of
// actually awaiting a render, so there is no analogous `isFontReady` export.
let toolkitReady = false;

// Fonts whose zip has already been registered via `fontAddCustom` on the
// current toolkit instance. Switching to a previously-used font is then free.
const registeredFonts = new Set<VerovioFont>();
// In-flight registration attempts, keyed by font, so two callers requesting
// the same not-yet-registered font concurrently share one dynamic import +
// `setOptions` call rather than racing duplicate ones.
const registeringFonts = new Map<VerovioFont, Promise<void>>();

/** Register `font`'s bundled zip on `tk` via `fontAddCustom`, unless already done. */
function ensureFontRegistered(tk: Toolkit, font: VerovioFont): Promise<void> {
  if (registeredFonts.has(font)) return Promise.resolve();
  let pending = registeringFonts.get(font);
  if (!pending) {
    pending = FONT_LOADERS[font]().then((mod) => {
      tk.setOptions({ fontAddCustom: [mod[FONT_CONST_NAME[font]]] });
      registeredFonts.add(font);
    });
    pending.catch(() => {
      // Allow a later call to retry after a transient import failure.
      registeringFonts.delete(font);
    });
    registeringFonts.set(font, pending);
  }
  return pending;
}

async function initToolkit(): Promise<Toolkit> {
  // `verovio/wasm` is the WASM module factory; `verovio/esm` the JS toolkit.
  // Font zips are no longer imported here — each is dynamically imported (and
  // registered via `fontAddCustom`) the first time that specific font is
  // actually requested, via `ensureFontRegistered` above.
  const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([
    import("verovio/wasm"),
    import("verovio/esm"),
  ]);
  const mod = await createVerovioModule();
  return new VerovioToolkit(mod) as unknown as Toolkit;
}

/** Lazily load (and cache) the Verovio toolkit with the bundled fonts registered. */
export function getVerovioToolkit(): Promise<Toolkit> {
  if (!toolkitPromise) {
    toolkitPromise = initToolkit().then(
      (tk) => {
        toolkitReady = true;
        return tk;
      },
      (err) => {
        // Reset so a later call can retry after a transient import/WASM failure.
        toolkitPromise = null;
        throw err;
      },
    );
  }
  return toolkitPromise;
}

/**
 * Whether the toolkit is loaded *right now* — synchronous, side-effect free,
 * and false while an attempt is still in flight.
 *
 * Engraving is serialized through this one toolkit on the main thread, so a
 * board of twenty staff cards queues twenty ~100 ms engravings: the last cards
 * wait seconds with nothing whatsoever left to download. Anything that wants to
 * say "still downloading" has to ask this rather than time the wait.
 */
export function isVerovioReady(): boolean {
  return toolkitReady;
}

/**
 * Start loading the toolkit without waiting for it.
 *
 * Nothing pulls in the ~7 MB Verovio chunk until a staff first mounts, so a
 * cold visitor who switches to notation view pays the whole download inside the
 * first engraving — 13 s on a deployed cold cache, which reads as a hung
 * loading animation. Calling this once after first paint moves that download
 * off the critical path, so the first staff paints from an already-warm
 * toolkit.
 *
 * Idempotent: it shares `getVerovioToolkit`'s cached promise, so it never
 * starts a second initialisation and never changes what a later real render
 * gets. Its rejection is swallowed — a background warm-up has no caller to
 * catch it, and `getVerovioToolkit` already drops its cached promise on
 * failure, so a later render still retries from scratch.
 *
 * Also registers `font`'s zip (default Bravura, the board's default) so the
 * font the board will actually render with first is warm too, not just the
 * toolkit/WASM — the caller can pass the board's current default so the real
 * first render skips that fetch as well. Sharing `ensureFontRegistered`'s
 * in-flight map means this never duplicates a registration a real render
 * already started (or vice versa).
 */
export function prefetchVerovio(font: VerovioFont = "Bravura"): Promise<void> {
  return getVerovioToolkit()
    .then((tk) => ensureFontRegistered(tk, font))
    .then(
      () => undefined,
      () => undefined,
    );
}

/** The slice of the Network Information API we consult. Absent in Safari and
 *  Firefox, so every field here is optional and absence means "no objection". */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Whether an *unrequested* background download is appropriate on this
 * connection.
 *
 * Verovio is ~2.6 MB gzipped plus 765 KB of font zips, and most visitors never
 * open a notation view — so a blanket warm-up spends a metered visitor's data
 * on something they will not use. Absence of the API means go ahead: it ships
 * only in Chromium, and treating "unknown" as "don't" would disable the
 * warm-up for most of the web.
 *
 * This gates the background arm only. An explicit signal — a pointer on the
 * Display toggle, or a view that already needs a staff — still loads Verovio;
 * there the download is on the critical path either way.
 */
function shouldPrefetchInBackground(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return true;
  if (conn.saveData === true) return false;
  return conn.effectiveType !== "slow-2g" && conn.effectiveType !== "2g";
}

/** Public alias of the connection-quality gate above, for callers that decide
 *  themselves whether to arm a warm-up rather than using `prefetchVerovioWhenIdle`. */
export const shouldPrefetch = shouldPrefetchInBackground;

/**
 * Arm a background warm-up for when the browser next goes idle, unless the
 * connection says not to. Returns a cancel function, so an effect can drop it
 * on unmount.
 *
 * Idle-callback rather than an immediate call so the fetch and the WASM
 * instantiation never compete with first paint; Safari only shipped
 * `requestIdleCallback` recently, hence the timeout fallback.
 *
 * `font` is the board's current default music font (see `prefetchVerovio`);
 * pass it along so the idle warm-up pre-registers the font the board will
 * actually render with first, not just the toolkit.
 */
export function prefetchVerovioWhenIdle(font: VerovioFont = "Bravura"): () => void {
  if (typeof window === "undefined") return () => {};
  if (!shouldPrefetchInBackground()) return () => {};
  const warm = () => { void prefetchVerovio(font); };
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(warm, { timeout: 3000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(warm, 1200);
  return () => window.clearTimeout(id);
}

export interface RenderMeiOptions {
  font?: VerovioFont;
  /** Verovio `scale` (percent). Larger = bigger engraving. */
  scale?: number;
}

// The render-options object below is constant except for `font`/`scale`, and
// nearly every call in a session repeats the same pair (one clef/scale, and
// most boards never touch the font toggle) — so re-`setOptions`ing it every
// single render is pure overhead. Track what's currently applied and skip the
// call when nothing changed. Verovio's `setOptions` merges rather than
// replaces (the existing `fontAddCustom`-only calls from `ensureFontRegistered`
// already relied on that), so skipping this call never drops a previously
// applied option.
let appliedRenderOptions: { font: VerovioFont; scale: number } | null = null;

/** Render an MEI document to a single-system SVG string. */
export async function renderMeiToSvg(
  mei: string,
  { font = "Bravura", scale = 40 }: RenderMeiOptions = {},
): Promise<string> {
  // One retry, and only around the toolkit: a background prefetch now starts
  // the shared attempt ~1 s into every page load, so a staff that mounts inside
  // that window can inherit a rejection it had no part in and — its effect deps
  // never changing again — sit on "notation unavailable" for the life of the
  // page. `getVerovioToolkit` has already dropped the failed promise by the
  // time this catch runs, so the second call genuinely starts fresh.
  //
  // Deliberately not wrapped around the engraving below: a rejection from
  // `loadData`/`renderToSVG` is bad MEI, not a transient download, and retrying
  // it would just fail twice. Bounded to a single extra attempt, so a hard
  // failure still surfaces instead of looping.
  let tk: Toolkit;
  try {
    tk = await getVerovioToolkit();
  } catch {
    tk = await getVerovioToolkit();
  }
  // Register this font's zip on first use of it (no-op if already done).
  await ensureFontRegistered(tk, font);
  if (appliedRenderOptions?.font !== font || appliedRenderOptions?.scale !== scale) {
    tk.setOptions({
      font,
      scale,
      adjustPageWidth: true,
      adjustPageHeight: true,
      breaks: "none",
      header: "none",
      footer: "none",
      pageMarginTop: 2,
      pageMarginBottom: 8,
      pageMarginLeft: 4,
      pageMarginRight: 4,
      svgViewBox: true,
      svgRemoveXlink: true,
    });
    appliedRenderOptions = { font, scale };
  }
  if (!tk.loadData(mei)) {
    throw new Error("Verovio failed to load notation data");
  }
  return tk.renderToSVG(1);
}

// --- Single-note staff cards (ph-winds) --------------------------------
//
// Wind cards engrave one note at a time on a tiny (~150px) staff. Built on
// top of `renderMeiToSvg` above rather than talking to the toolkit directly,
// so the `setOptions` block stays in one place. Adds only what that shared
// path doesn't do: memoising identical (pitch, clef, font) engravings, and
// serialising renders through the queue so concurrent staff cards don't
// stack concurrent `loadData`/`renderToSVG` calls on the one toolkit
// instance (Verovio is not reentrant).

import type { Pitch } from "@/music/pitch";
import type { MusicFont } from "@/state/types";
import { pitchKey } from "@/music/pitch";
import { buildMei } from "./mei";

/** Verovio `scale` (percent) tuned for a one-note staff at ~150px wide. */
const STAFF_SCALE = 40;

/** Board-facing `MusicFont` ('bravura' | 'petaluma') -> Verovio's font name. */
export const musicFontToVerovioFont = (font: MusicFont): VerovioFont =>
  font === "petaluma" ? "Petaluma" : "Bravura";

const svgCache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** Engrave one note. Serialised through the single toolkit; memoised per pitch/clef/font. */
export function renderStaffSvg(p: Pitch, clef: "G" | "F", font: MusicFont): Promise<string> {
  const key = `${pitchKey(p)}|${clef}|${font}`;
  let hit = svgCache.get(key);
  if (!hit) {
    hit = queue.then(() =>
      renderMeiToSvg(buildMei(p, clef), {
        font: musicFontToVerovioFont(font),
        scale: STAFF_SCALE,
      }),
    );
    hit.catch(() => svgCache.delete(key));
    svgCache.set(key, hit);
    queue = hit.catch(() => undefined);
  }
  return hit;
}

/** Resolves once the render queue is idle — lets callers (and tests) wait for pending engravings. */
export const pendingRenders = (): Promise<void> => queue.then(() => undefined);

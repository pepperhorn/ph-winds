import type { InstrumentId } from '@/music/instruments';
import saxIcon from '@/icons/sax.webp';
import clarinetIcon from '@/icons/clarinet.webp';
import fluteIcon from '@/icons/flute.webp';
import recorderIcon from '@/icons/recorder.webp';
import tinWhistleIcon from '@/icons/tinWhistle.webp';
import trumpetIcon from '@/icons/trumpet.webp';
import tromboneIcon from '@/icons/trombone.webp';
import nuvoDoodIcon from '@/icons/nuvoDood.webp';
import nuvoTootIcon from '@/icons/nuvoToot.webp';

/** Astro's asset pipeline (dev/build) resolves `*.webp` imports to an
 * `ImageMetadata` object with `.src`/`.width`/`.height` fields; plain Vite
 * (as used by Vitest, which doesn't load Astro's vite plugin) resolves them
 * to a plain URL string. Normalize both so callers always get consistent
 * `src`/`width`/`height`. The icons are all square 192x192 source files
 * (3x the 64px tile they render at), so the fallback dimensions match. */
type IconImport = string | { src: string; width?: number; height?: number };
const ICON_SIZE = 192;
const iconMeta = (icon: IconImport): { src: string; width: number; height: number } =>
  typeof icon === 'string'
    ? { src: icon, width: ICON_SIZE, height: ICON_SIZE }
    : { src: icon.src, width: icon.width ?? ICON_SIZE, height: icon.height ?? ICON_SIZE };

export const INSTRUMENT_ICONS: Record<InstrumentId, { src: string; width: number; height: number }> = {
  saxophone: iconMeta(saxIcon),
  clarinet: iconMeta(clarinetIcon),
  flute: iconMeta(fluteIcon),
  recorder: iconMeta(recorderIcon),
  'tin-whistle': iconMeta(tinWhistleIcon),
  trumpet: iconMeta(trumpetIcon),
  trombone: iconMeta(tromboneIcon),
  'nuvo-dood': iconMeta(nuvoDoodIcon),
  'nuvo-toot': iconMeta(nuvoTootIcon),
};

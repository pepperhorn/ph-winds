import type { InstrumentId } from '@/music/instruments';
import saxIcon from '@/icons/sax.png';
import clarinetIcon from '@/icons/clarinet.png';
import fluteIcon from '@/icons/flute.png';
import recorderIcon from '@/icons/recorder.png';
import tinWhistleIcon from '@/icons/tinWhistle.png';
import trumpetIcon from '@/icons/trumpet.png';
import tromboneIcon from '@/icons/trombone.png';
import nuvoDoodIcon from '@/icons/nuvoDood.png';
import nuvoTootIcon from '@/icons/nuvoToot.png';

/** Astro's asset pipeline (dev/build) resolves `*.png` imports to an
 * `ImageMetadata` object with a `.src` field; plain Vite (as used by
 * Vitest, which doesn't load Astro's vite plugin) resolves them to a plain
 * URL string. Normalize both so callers always get a string. */
type IconImport = string | { src: string };
const iconSrc = (icon: IconImport): string => (typeof icon === 'string' ? icon : icon.src);

export const INSTRUMENT_ICONS: Record<InstrumentId, string> = {
  saxophone: iconSrc(saxIcon),
  clarinet: iconSrc(clarinetIcon),
  flute: iconSrc(fluteIcon),
  recorder: iconSrc(recorderIcon),
  'tin-whistle': iconSrc(tinWhistleIcon),
  trumpet: iconSrc(trumpetIcon),
  trombone: iconSrc(tromboneIcon),
  'nuvo-dood': iconSrc(nuvoDoodIcon),
  'nuvo-toot': iconSrc(nuvoTootIcon),
};

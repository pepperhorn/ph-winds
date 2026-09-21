/**
 * Fixture register bands for tests.
 *
 * The bands ship as instrument JSON in `@pepperhorn/fingering-components`,
 * and the library re-anchors boundaries and adds band names over time. A test
 * that pins "alto sax G5 is High G" is really pinning today's data, and goes
 * red on a dependency bump that broke nothing.
 *
 * So: tests about *how bands are read* define their own bands here and assert
 * literal, stable answers, and tests about the installed data assert
 * properties of whatever is installed (see `registers.test.ts`).
 */
import { afterEach, beforeEach } from 'vitest';
import { getInstrument } from '@/music/instruments';

/**
 * Two fixture bands, as flat as they can be while still having a boundary:
 * everything from C4 up is "Mid", everything from D5 up is "Top", and
 * anything below C4 has no band at all. Shared so the register-aware labels
 * read the same across test files.
 */
export const FIXTURE_BANDS = [{ from: 'C4', name: 'Mid' }, { from: 'D5', name: 'Top' }];

/** Run `fn` with an instrument's declared bands swapped for `bands`, then put
 * the real ones back — including when `fn` throws. `bands` is deliberately
 * `unknown`: several cases feed it malformed data on purpose. */
export function withRegisters(id: string, bands: unknown, fn: () => void) {
  const layout: { registers?: unknown } = getInstrument(id).layout;
  const saved = layout.registers;
  layout.registers = bands;
  try {
    fn();
  } finally {
    layout.registers = saved;
  }
}

/**
 * The same swap for a whole `describe`/file, via `beforeEach`/`afterEach`.
 * Call it at suite scope; the real bands come back after every case, so a
 * failure cannot leak fixture data into another file.
 */
export function useRegisters(id: string, bands: unknown = FIXTURE_BANDS) {
  let saved: unknown;
  const layout = () => getInstrument(id).layout as { registers?: unknown };
  beforeEach(() => {
    saved = layout().registers;
    layout().registers = bands;
  });
  afterEach(() => {
    layout().registers = saved;
  });
}

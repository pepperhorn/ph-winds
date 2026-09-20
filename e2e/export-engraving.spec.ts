import { test, expect } from '@playwright/test';

// Regression guard for a race between Verovio's render queue settling
// (`pendingRenders()`, a promise-microtask chain) and React actually
// committing the resulting SVG into the DOM (scheduled on React's own
// macrotask scheduler): `exportBoardImage` must not hand `toPng` a DOM that
// still has `.wc-staff-loading` / `.wc-staff--loading` skeleton placeholders
// where engraved notation should be. A board whose cards show fingering +
// staff notation should export to a materially bigger PNG than the same
// board with every card set to fingering-only (no staff at all) — if the
// staves were exporting as blank/grey skeleton boxes instead of real
// engraving, the two exports would be much closer in size.
test('exported PNG with notation is materially larger than the same board with fingering only', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeCtx { state = 'running'; resume() { return Promise.resolve(); } }
    (window as any).AudioContext = FakeCtx;
  });
  await page.route(/gleitz|smpldsnds/, (r) => r.abort());

  await page.goto('/');

  const notes = ['C5', 'D5', 'E5'];

  const exportAndSize = async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNG', exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();
    const { statSync } = await import('node:fs');
    return statSync(path!).size;
  };

  // Board 1: default display ("Both") — fingering diagram + staff notation.
  for (const note of notes) {
    await page.getByRole('button', { name: note, exact: true }).click();
    await page.getByRole('button', { name: 'Add to board' }).click();
  }
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(notes.length);
  const bothSize = await exportAndSize();

  // Reset, then board 2: fingering-only (no staff) for every card.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(0);
  for (const note of notes) {
    await page.getByRole('button', { name: note, exact: true }).click();
    await page.getByRole('radio', { name: 'Fingering', exact: true }).click();
    await page.getByRole('button', { name: 'Add to board' }).click();
  }
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(notes.length);
  await expect(page.locator('#wc-board-export .wc-staff')).toHaveCount(0);
  const fingeringOnlySize = await exportAndSize();

  console.log(`both: ${bothSize} bytes, fingering-only: ${fingeringOnlySize} bytes`);
  expect(bothSize).toBeGreaterThan(fingeringOnlySize * 1.1);
});

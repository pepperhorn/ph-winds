import { test, expect } from '@playwright/test';

// Regression guard for the jsPDF `addImage` compression fix in
// src/export/image.ts: a 3-card board PDF export used to embed the PNG
// uncompressed and weigh in around 9.4 MB. Passing `compression: 'FAST'`
// brings that down substantially. This test drives the real UI (piano key
// -> Add to board, x3) and the real "PDF" button in the app bar, captures
// the download Playwright intercepts, and asserts its size stays small.
test('3-card board PDF export stays well under the old 9.4 MB size', async ({ page }) => {
  // stub audio: no network soundfonts in this sandbox
  await page.addInitScript(() => {
    class FakeCtx { state = 'running'; resume() { return Promise.resolve(); } }
    (window as any).AudioContext = FakeCtx;
  });
  await page.route(/gleitz|smpldsnds/, (r) => r.abort());

  await page.goto('/');

  const notes = ['C5', 'D5', 'E5'];
  for (const note of notes) {
    await page.getByRole('button', { name: note, exact: true }).click();
    await page.getByRole('button', { name: 'Add to board' }).click();
  }
  await expect(page.locator('#wc-board-export .wc-card')).toHaveCount(notes.length);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const download = await downloadPromise;

  const path = await download.path();
  expect(path).toBeTruthy();
  const { statSync } = await import('node:fs');
  const bytes = statSync(path!).size;
  const mb = bytes / (1024 * 1024);
  console.log(`Exported PDF size: ${bytes} bytes (${mb.toFixed(2)} MB)`);

  expect(bytes).toBeLessThan(3 * 1024 * 1024);
});

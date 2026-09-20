import { test, expect } from '@playwright/test';

test('build a card, persist it, render Handwritten font, play without errors', async ({ page }) => {
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

  await page.getByRole('radio', { name: 'Handwritten' }).click();
  // Verovio's SVG output nests an inner <svg class="definition-scale"> inside
  // the outer page <svg>, so `.wc-staff svg` matches two elements; .first()
  // disambiguates without weakening the assertion (both resolve together).
  await expect(page.locator('#wc-board-export .wc-staff svg').first()).toBeVisible({ timeout: 30_000 });

  await page.locator('#wc-board-export .wc-card').hover();
  await page.getByRole('button', { name: 'Play voice' }).first().click();
  await expect(page.getByRole('status')).toHaveText(/Could not load that sound/);   // network blocked → graceful toast
  expect(errors).toEqual([]);
});

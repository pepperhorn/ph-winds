import { test, expect } from '@playwright/test';

test('a piano note clears the text-card selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    class FakeCtx { state = 'running'; resume() { return Promise.resolve(); } }
    (window as any).AudioContext = FakeCtx;
  });
  await page.route(/gleitz|smpldsnds/, (r) => r.abort());

  await page.goto('/');
  await page.getByRole('button', { name: '+ Add text card' }).click();

  // The text card is on the board, its panel is open and it wears the ring.
  await expect(page.locator('#wc-board-export .wc-text-card')).toHaveCount(1);
  await expect(page.locator('.btn-text-card-done')).toBeVisible();
  await expect(page.locator('.wc-board-item.ring-2')).toHaveCount(1);

  // Now pick a piano note. The Builder takes over.
  await page.getByRole('button', { name: 'C5', exact: true }).click();

  await expect(page.locator('.btn-text-card-done')).toHaveCount(0);
  await expect(page.locator('.wc-board-item.ring-2')).toHaveCount(0);
  // The Builder is always mounted; its commit button is enabled only with a draft.
  await expect(page.locator('.btn-add-card')).toBeEnabled();

  // And back the other way: editing the text card closes the Builder's draft.
  await page.locator('#wc-board-export .wc-text-card').hover();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.locator('.btn-text-card-done')).toBeVisible();
  await expect(page.locator('.wc-board-item.ring-2')).toHaveCount(1);
  await expect(page.locator('.btn-add-card')).toBeDisabled();

  expect(errors).toEqual([]);
});

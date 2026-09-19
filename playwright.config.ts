import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'pnpm build && pnpm preview --port 4329',
    port: 4329, reuseExistingServer: false, timeout: 180_000,
    // Astro 7 auto-backgrounds `astro preview` when it detects it's being run by
    // an agent/sandbox (isRunByAgent()), which makes the command process exit
    // immediately and breaks Playwright's webServer exit detection. Force
    // foreground mode; any non-empty value disables the auto-detection.
    env: { ASTRO_PREVIEW_BACKGROUND: 'false' },
  },
  use: { baseURL: 'http://localhost:4329' },
});

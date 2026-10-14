// Playwright smoke tests. Run: npx playwright test (or npm run test:e2e)
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    // The app is served under a subfolder, like on GitHub Pages.
    baseURL: `http://localhost:${PORT}/xmas-calendar/`,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `node tests/e2e/serve.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/xmas-calendar/`,
    reuseExistingServer: !process.env.CI,
  },
});

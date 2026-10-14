// Takes screenshots of the app at 360 px width for reviews and PR descriptions.
// Run: npm run screenshots   (needs the dev dependency @playwright/test)
// Output: docs/screenshots/*.png
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = `${ROOT}docs/screenshots/`;
const PORT = 4174;
const BASE = `http://localhost:${PORT}/xmas-calendar/`;

// Opening animations take about a second; wait a little longer before the shot.
const SETTLE_MS = 1600;

const server = spawn(process.execPath, ['tests/e2e/serve.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve) => server.stdout.once('data', resolve));

const content = JSON.parse(await readFile(`${ROOT}content/days.json`, 'utf8'));

const browser = await chromium.launch();

async function newPage(date, { opened = [], days = content } = {}) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+01:00`));
  await page.route('**/content/days.json', (route) => route.fulfill({ json: days }));
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.opened', JSON.stringify(ids));
    localStorage.setItem('advent.iosHintDismissed', '1');
  }, opened);
  await page.goto(BASE);
  await page.locator('#grid .door').first().waitFor();
  await page.waitForTimeout(300);
  return page;
}

// Grows the viewport to the whole page instead of using fullPage, so the background
// (fixed sky, ground at the bottom) is laid out like on a phone scrolled to that spot.
async function shot(page, name, fullPage = true) {
  if (fullPage) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 360, height });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`docs/screenshots/${name}.png`);
}

await mkdir(OUT, { recursive: true });
try {
  const ids = (dates) => content.days.filter((d) => dates.includes(d.date)).map((d) => d.id);

  let page = await newPage('2026-11-20');
  await shot(page, 'locked');
  await page.context().close();

  page = await newPage('2026-12-05', { opened: ids(['2026-11-29', '2026-12-01', '2026-12-02', '2026-12-03']) });
  await shot(page, 'simulated-2026-12-05');
  await page.context().close();

  page = await newPage('2026-12-24');
  await shot(page, 'simulated-2026-12-24');
  await page.context().close();

  // One opened door per type. No door has type "litet" yet, so borrow a placeholder day.
  const perType = [
    { type: 'ledtrad', date: '2026-12-01' },
    { type: 'litet', date: '2026-12-02' },
    { type: 'uppdrag', date: '2026-12-06' },
    { type: 'rim', date: '2026-12-24' },
  ];
  const days = structuredClone(content);
  const borrowed = days.days.find((d) => d.date === '2026-12-02');
  Object.assign(borrowed, { type: 'litet', title: 'Ett litet paket', body: 'Exempeltext för skärmdumpen.' });
  for (const { type, date } of perType) {
    page = await newPage('2026-12-24', { days });
    await page.locator(`.door[data-date="${date}"]`).click();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, `opened-${type}`, false);
    await page.context().close();
  }
} finally {
  await browser.close();
  server.kill();
}

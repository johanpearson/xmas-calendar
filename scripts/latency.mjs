// Measures sound latency when doors are opened (milestone 14), with the dev panel's
// latency log (js/latency.js), in headless Chromium as a Pixel 7 with the CPU slowed
// down 4x, a bit like a mid-range Android phone. Real phones add their own output
// latency on top: read the dev panel's "Ljudlatens" on the phone for those numbers.
//
// Run: npm run latency   (needs the dev dependency @playwright/test)
// Prints a Markdown table, one row per press. Open-Meteo is mocked with a slow answer
// (3 s) so the plan B door on 2026-12-20 shows whether the forecast holds anything up.
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = 4175;
const BASE = `http://localhost:${PORT}/xmas-calendar/`;
const CPU_SLOWDOWN = Number(process.env.CPU_SLOWDOWN ?? 4);
const HOLD_MS = 90; // a finger stays down about this long on a tap
const FORECAST_DELAY_MS = 3000;

// In order. The first press of each run is the first one after the app started.
const RUNS = {
  'kall start': ['2026-12-05', '2026-12-04', '2026-12-12', '2026-12-08', '2026-12-07', '2026-12-16', '2026-12-15', '2026-12-19', '2026-12-11', '2026-12-09', '2026-12-01', '2026-12-13', '2026-12-03', '2026-11-29', '2026-12-20'],
  '20 dec först': ['2026-12-20', '2026-12-06'],
};

const server = spawn(process.execPath, ['tests/e2e/serve.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve) => server.stdout.once('data', resolve));

const tomte = JSON.parse(await readFile(`${ROOT}content/tomte.json`, 'utf8'));
const browser = await chromium.launch();
const rows = [];

for (const [run, dates] of Object.entries(RUNS)) {
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'sv-SE', timezoneId: 'Europe/Stockholm', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.dev', 'on');
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
    localStorage.setItem('advent.iosHintDismissed', '1');
  }, tomte.scenes.map((s) => s.id));
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, FORECAST_DELAY_MS));
    await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }).catch(() => {});
  });
  await page.clock.setFixedTime(new Date('2026-12-20T10:00:00+01:00'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.goto(BASE);
  await page.locator('.dev-toggle').waitFor();
  await page.waitForTimeout(1500); // the app settles, as after a real start

  for (const date of dates) {
    const door = page.locator(`.door[data-date="${date}"]`);
    await door.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await door.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(HOLD_MS);
    await page.mouse.up();
    await page.locator('#card[open]').waitFor({ timeout: 8000 }).catch(async (err) => {
      await page.screenshot({ path: process.env.DEBUG_SHOT ?? 'latency-debug.png' });
      console.error(await page.evaluate(async () => (await import('./js/latency.js')).latencyEntries()));
      throw err;
    });
    await page.waitForTimeout(1200);
    const entry = await page.evaluate(async () => {
      const { latencyEntries, summarize } = await import('./js/latency.js');
      const e = latencyEntries()[0];
      return { ...e, ...summarize(e), raw: e };
    });
    rows.push({ run, date, ...entry });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  await context.close();
}

await browser.close();
server.kill();

const ms = (v) => (v === null || v === undefined ? '–' : String(v));
const lat = (v) => (typeof v === 'number' ? String(Math.round(v * 1000)) : '–');
console.log(`CPU ${CPU_SLOWDOWN}x, tap held ${HOLD_MS} ms, Open-Meteo answers after ${FORECAST_DELAY_MS} ms. All times in ms from pointerdown.\n`);
console.log('| Körning | Lucka | Effekt | Kontext vid tryck | sfx.play | Bygga | Start | Hörs | Första bild | Ljud − bild | Kort | base / output |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.run} | ${r.date} | ${r.effect ?? '–'} (${r.source ?? '–'}) | ${r.raw.audio}${r.raw.firstPress ? ', första' : ''} | ${ms(r.sfx)} | ${ms(r.build)} | ${ms(r.start)} | ${ms(r.heard)} | ${ms(r.frame)} | ${ms(r.soundMinusFrame)} | ${ms(r.card)} | ${lat(r.raw.baseLatency)} / ${lat(r.raw.outputLatency)} |`,
  );
}

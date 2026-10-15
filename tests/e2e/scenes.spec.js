// Day scenes (milestone 12): drawing, cleanup, the card, the main screen, dev mode and
// screenshots at 360 px.
//
// Screenshots go to the test output folder. With SCENE_SCREENSHOTS=1 they are also
// written to docs/screenshots/scenes/ (for the README and PR descriptions):
//   SCENE_SCREENSHOTS=1 npx playwright test tests/e2e/scenes.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { skipTomte } from './helpers.js';

const { days } = JSON.parse(readFileSync(new URL('../../content/days.json', import.meta.url), 'utf8'));
const DOCS = new URL('../../docs/screenshots/scenes/', import.meta.url);
const ENTRANCE_MS = 3400; // every entrance is over within about 3 s
const SCENE_KEYS = [...new Set(days.filter((d) => d.scene).map((d) => d.scene))];

test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });

const door = (page, date) => page.locator(`.door[data-date="${date}"]`);

async function gotoApp(page, date, path = './') {
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+01:00`));
  await skipTomte(page);
  await page.addInitScript(() => localStorage.setItem('advent.iosHintDismissed', '1'));
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

// target: the page or a locator (both have screenshot()).
async function screenshot(target, testInfo, name, options) {
  const path = testInfo.outputPath(`${name}.png`);
  await target.screenshot({ path, ...options });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  if (process.env.SCENE_SCREENSHOTS) {
    mkdirSync(DOCS, { recursive: true });
    await target.screenshot({ path: new URL(`${name}.png`, DOCS).pathname, ...options });
  }
}

test('every scene draws, and cleanup removes every node, listener and timer', async ({ page }) => {
  await gotoApp(page, '2026-12-05');
  const result = await page.evaluate(async () => {
    // Timers and document listeners created while a scene renders or cleans up, and still
    // live afterwards. Scenes are synchronous, so nothing else runs in between.
    let tracking = false;
    const live = new Set();
    const wrap = (set, clear) => {
      const origSet = window[set].bind(window);
      const origClear = window[clear].bind(window);
      window[set] = (fn, ...args) => {
        let id;
        const tracked = tracking;
        const cb = typeof fn === 'function' ? (...a) => {
          if (set !== 'setInterval') live.delete(`${set}:${id}`);
          return fn(...a);
        } : fn;
        id = origSet(cb, ...args);
        if (tracked) live.add(`${set}:${id}`);
        return id;
      };
      window[clear] = (id) => {
        live.delete(`${set}:${id}`);
        origClear(id);
      };
    };
    wrap('setTimeout', 'clearTimeout');
    wrap('setInterval', 'clearInterval');
    wrap('requestAnimationFrame', 'cancelAnimationFrame');
    let listeners = 0;
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    document.addEventListener = (...args) => {
      if (tracking) listeners++;
      add(...args);
    };
    document.removeEventListener = (...args) => {
      if (tracking) listeners--;
      remove(...args);
    };

    const { SCENES, SCENE_KEYS } = await import('./js/scenes.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:150px';
    document.body.append(host);
    const report = [];
    for (const key of SCENE_KEYS) {
      for (const small of [false, true]) {
        tracking = true;
        const cleanup = SCENES[key].render(host, { date: '2026-12-05', reducedMotion: false, small });
        tracking = false;
        const nodes = host.querySelectorAll('*').length;
        const particles = host.querySelectorAll('.sc-fall, .sc-up, .sc-drift').length;
        const hidden = host.querySelector('.sc')?.getAttribute('aria-hidden');
        await new Promise((r) => setTimeout(r, 30));
        tracking = true;
        cleanup();
        tracking = false;
        report.push({ key, small, nodes, particles, hidden, left: host.childNodes.length, timers: live.size, listeners });
      }
    }
    host.remove();
    return report;
  });
  expect(result).toHaveLength(SCENE_KEYS.length * 2);
  for (const r of result) {
    const name = `${r.key}${r.small ? ' (small)' : ''}`;
    expect(r.nodes, name).toBeGreaterThan(2);
    expect(r.particles, `${name}: particles`).toBeLessThanOrEqual(40);
    expect(r.hidden, `${name}: aria-hidden`).toBe('true');
    expect(r.left, `${name}: nodes left after cleanup`).toBe(0);
    expect(r.timers, `${name}: timers left after cleanup`).toBe(0);
    expect(r.listeners, `${name}: listeners left after cleanup`).toBe(0);
  }
});

test('the scene is in the card behind the text and goes away with the card', async ({ page }) => {
  await gotoApp(page, '2026-12-13');
  await door(page, '2026-12-13').click();
  const card = page.locator('#card');
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/has-scene/);
  const scene = card.locator('.card-scene .sc-lucia');
  await expect(scene).toHaveCount(1);
  await expect(card.locator('.card-scene')).toHaveAttribute('aria-hidden', 'true');
  await expect(card.locator('.card-scene')).toHaveCSS('pointer-events', 'none');
  // The text starts where the scene has faded into plain paper (the fade ends at 94 %).
  const box = await card.evaluate((c) => {
    const layer = c.querySelector('.card-scene').getBoundingClientRect();
    return { paperFrom: layer.top + layer.height * 0.94, text: c.querySelector('.card-meta').getBoundingClientRect().top };
  });
  expect(box.text).toBeGreaterThanOrEqual(box.paperFrom - 1);
  // Text colour is unchanged by the scene.
  await expect(card.locator('#card-title')).toHaveCSS('color', 'rgb(20, 36, 67)');
  await card.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.locator('.card-scene, #card .sc')).toHaveCount(0);
  await expect(card).not.toHaveClass(/has-scene/);
});

test('the loop pauses while the tab is hidden', async ({ page }) => {
  await gotoApp(page, '2026-12-13');
  await door(page, '2026-12-13').click();
  const scene = page.locator('#card .sc');
  await expect(scene).not.toHaveClass(/is-paused/);
  const setHidden = (hidden) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect(scene).toHaveClass(/is-paused/);
  const states = await scene.evaluate((el) => [...new Set(el.getAnimations({ subtree: true }).map((a) => a.playState))]);
  expect(states).toEqual(['paused']);
  await setHidden(false);
  await expect(scene).not.toHaveClass(/is-paused/);
});

test('reduced motion: a still picture, no animations at all', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoApp(page, '2026-12-13');
  await expect(page.locator('#home-scene .sc-lucia')).toHaveClass(/is-still/);
  await door(page, '2026-12-13').click();
  const scene = page.locator('#card .sc');
  await expect(scene).toHaveClass(/is-still/);
  expect(await scene.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.locator('#home-scene').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('main screen: the scene shows only on its date, behind the doors, without changing the layout', async ({ page }) => {
  await gotoApp(page, '2026-12-05');
  await expect(page.locator('#home-scene .sc')).toHaveCount(0);
  const heightWithout = await page.evaluate(() => document.documentElement.scrollHeight);

  await gotoApp(page, '2026-12-04');
  const home = page.locator('#home-scene');
  await expect(home.locator('.sc-cat.sc-small')).toHaveCount(1);
  await expect(home).toHaveAttribute('aria-hidden', 'true');
  await expect(home).toHaveCSS('pointer-events', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(heightWithout);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // Doors over the scene still get the tap.
  for (const date of ['2026-12-21', '2026-12-24']) {
    const hit = await door(page, date).evaluate((el) => {
      el.scrollIntoView({ block: 'end' });
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.bottom - 6)?.closest('.door')?.dataset.date;
    });
    expect(hit).toBe(date);
  }
});

test('dev: "Spela upp" previews a scene without opening doors, and the main screen for any date', async ({ page }) => {
  await gotoApp(page, '2026-12-05', './?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');
  await panel.getByText(/^Scener \(/).click();
  await panel.getByRole('button', { name: 'Spela upp scenen Bingokulor' }).click();
  const card = page.locator('#card');
  await expect(card).toBeVisible();
  await expect(card.locator('.sc-bingo')).toHaveCount(1);
  await expect(card.locator('#card-date')).toContainText('23 december');
  await card.getByRole('button', { name: 'Stäng' }).click();
  await expect(door(page, '2026-12-23')).toHaveClass(/is-locked/);
  expect(await page.evaluate(() => localStorage.getItem('advent.opened'))).toBeNull();

  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await panel.getByLabel('Datum för huvudskärmen').fill('2026-12-24');
  await panel.getByRole('button', { name: 'Visa dagens huvudskärmsdekor' }).click();
  await expect(page.locator('#home-scene .sc-christmas')).toHaveCount(1);
  await expect(door(page, '2026-12-24')).toHaveClass(/is-locked/); // the date itself is unchanged

  // A new simulated date takes over again.
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await panel.getByLabel('Simulerat datum').fill('2026-12-13');
  await expect(page.locator('#home-scene .sc-lucia')).toHaveCount(1);
});

// --- Screenshots at 360 px ---

for (const key of SCENE_KEYS) {
  test(`screenshot: the scene ${key} after its entrance`, async ({ page }, testInfo) => {
    const day = days.find((d) => d.scene === key);
    await gotoApp(page, '2026-12-24');
    await door(page, day.date).click();
    await expect(page.locator(`#card .sc-${key}`)).toHaveCount(1);
    await page.waitForTimeout(ENTRANCE_MS);
    await screenshot(page.locator('#card'), testInfo, `scene-${key}`);
  });
}

for (const [date, key] of [['2026-12-13', 'lucia'], ['2026-12-04', 'cat'], ['2026-12-24', 'christmas']]) {
  test(`screenshot: the main screen on ${date} (${key})`, async ({ page }, testInfo) => {
    await gotoApp(page, date);
    await expect(page.locator(`#home-scene .sc-${key}`)).toHaveCount(1);
    await page.waitForTimeout(ENTRANCE_MS);
    await screenshot(page, testInfo, `home-${date}-${key}`, { fullPage: true });
  });
}

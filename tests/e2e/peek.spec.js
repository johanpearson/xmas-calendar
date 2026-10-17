// Tomten peeking up from the bottom edge (milestone 16): the peeking Santa, random lines,
// the history sheet and the dev panel.
//
// Screenshots at 360 px go to the test output folder. With PEEK_SCREENSHOTS=1 they are also
// written to docs/screenshots/peek/ (for the README and PR descriptions):
//   PEEK_SCREENSHOTS=1 npx playwright test tests/e2e/peek.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { skipTomte, noForecast } from './helpers.js';

const random = JSON.parse(readFileSync(new URL('../../content/tomte-random.json', import.meta.url), 'utf8')).lines;
const content = JSON.parse(readFileSync(new URL('../../content/tomte.json', import.meta.url), 'utf8'));
const DOCS = new URL('../../docs/screenshots/peek/', import.meta.url);

const at = (date) => new Date(`${date}T10:00:00+01:00`);
const peek = (page) => page.getByRole('button', { name: 'Tomten, tryck för att prata' });
const dialog = (page) => page.locator('dialog.tomte');
const bubble = (page) => page.locator('#tomte-text');
const sheet = (page) => page.locator('dialog.sheet');

async function gotoApp(page, path = './') {
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

// Intro and welcome seen; `scenes` are the scene ids already seen.
async function markSeen(page, scenes = []) {
  await noForecast(page);
  await page.addInitScript((ids) => {
    // Only on the very first load, so a reload keeps what the test did.
    if (localStorage.getItem('advent.test.init')) return;
    localStorage.setItem('advent.test.init', '1');
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    if (ids.length) localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
  }, scenes);
}

async function screenshot(page, name) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
  if (process.env.PEEK_SCREENSHOTS) {
    mkdirSync(DOCS, { recursive: true });
    await page.screenshot({ path: new URL(`${name}.png`, DOCS).pathname });
  }
}

// Plays the open conversation to its end: "Nästa", the first answer to each question, "Hej då!".
async function finishConversation(page) {
  const actions = dialog(page).locator('.tomte-actions');
  for (let i = 0; i < 30; i++) {
    const done = actions.getByRole('button', { name: 'Hej då!' });
    if (await done.isVisible()) {
      await done.click();
      await expect(dialog(page)).toBeHidden();
      return;
    }
    const next = actions.getByRole('button', { name: 'Nästa' });
    if (await next.isVisible()) await next.click();
    else await actions.getByRole('button').first().click();
  }
  throw new Error('the conversation did not end');
}

const boxes = (page, selector) =>
  page.locator(selector).evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const viewport of [{ width: 360, height: 640 }, { width: 360, height: 800 }]) {
  const size = `${viewport.width}x${viewport.height}`;

  test(`${size}: Tomten peeks up without covering a door, and has a 48 px tap area`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await skipTomte(page);
    await page.clock.setFixedTime(at('2026-12-10'));
    await gotoApp(page);
    await expect(peek(page)).toBeVisible();
    expect(await peek(page).evaluate((n) => n.tagName)).toBe('BUTTON');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600); // his entrance
    const [santa] = await boxes(page, '.peek');
    expect(santa.right - santa.left).toBeGreaterThanOrEqual(48);
    expect(santa.bottom - santa.top).toBeGreaterThanOrEqual(48);
    expect(santa.bottom - santa.top).toBeLessThanOrEqual(60); // about 56 px shows
    expect(santa.bottom).toBeCloseTo(viewport.height, 0); // at the bottom edge (no safe area here)
    expect(santa.left < 20 || santa.right > viewport.width - 20).toBe(true); // in a corner

    // At the bottom of the page no door, including the last row, is under him.
    for (const door of await boxes(page, '.door')) expect(overlaps(santa, door)).toBe(false);
    // The page keeps bottom padding at least as big as his visible part.
    const padding = await page.locator('.app').evaluate((n) => parseFloat(getComputedStyle(n).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(56);
    // Nothing covers him either: a tap in his middle reaches the button.
    const middle = await peek(page).evaluate((n) => {
      const r = n.getBoundingClientRect();
      return n.contains(document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2));
    });
    expect(middle).toBe(true);
    // No sideways scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.height === 640) await screenshot(page, 'main-with-tomte');
  });
}

test('he picks a side at random: both occur over many starts', async ({ page }) => {
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  const sides = new Set();
  for (let i = 0; i < 14 && sides.size < 2; i++) {
    await gotoApp(page);
    await expect(peek(page)).toBeVisible();
    sides.add(await peek(page).getAttribute('data-side'));
  }
  expect([...sides].sort()).toEqual(['left', 'right']);
});

test('he waits for the intro, and shows after "Nu kör vi"', async ({ page }) => {
  await noForecast(page);
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(dialog(page)).toBeVisible();
  await expect(peek(page)).toBeHidden();
  for (let i = 0; i < 4; i++) await dialog(page).getByRole('button', { name: 'Nästa' }).click();
  await dialog(page).getByRole('button', { name: 'Nu kör vi' }).click();
  await expect(peek(page)).toBeVisible();
});

test('he waits for a scene too, and hides while a door card is open', async ({ page }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-11-30'));
  await gotoApp(page);
  await expect(dialog(page)).toBeVisible();
  await expect(peek(page)).toBeHidden();
  await finishConversation(page);
  await expect(peek(page)).toBeVisible();

  await page.locator('.door:not(.is-locked)').first().click();
  await expect(page.locator('#card')).toBeVisible();
  await expect(peek(page)).toBeHidden();
});

test('tapping him opens a random line with "En till", "Tidigare repliker" and "Hejdå"', async ({ page }) => {
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page);
  await peek(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(peek(page)).toBeHidden();
  const first = await bubble(page).textContent();
  expect(random).toContain(first);
  for (const name of ['En till', 'Tidigare repliker', 'Hejdå']) {
    await expect(dialog(page).getByRole('button', { name })).toBeVisible();
  }

  // "En till" never repeats within a round.
  const seen = [first];
  for (let i = 0; i < 6; i++) {
    await dialog(page).getByRole('button', { name: 'En till' }).click();
    const line = await bubble(page).textContent();
    expect(random).toContain(line);
    seen.push(line);
  }
  expect(new Set(seen).size).toBe(seen.length);
  await screenshot(page, 'tomte-bubble');

  await dialog(page).getByRole('button', { name: 'Hejdå' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(peek(page)).toBeVisible();
});

test('the lottery lasts across a restart: a whole round has no repeat', async ({ page }) => {
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page);
  const seen = [];
  const take = async () => {
    await peek(page).click();
    seen.push(await bubble(page).textContent());
    for (let i = 0; i < 4; i++) {
      await dialog(page).getByRole('button', { name: 'En till' }).click();
      seen.push(await bubble(page).textContent());
    }
    await dialog(page).getByRole('button', { name: 'Hejdå' }).click();
  };
  await take();
  await page.reload();
  await expect(page.locator('#grid .door').first()).toBeVisible();
  await take();
  expect(new Set(seen).size).toBe(seen.length);
});

test('tapping him never starts a scheduled scene early or reveals coming ones', async ({ page }) => {
  await markSeen(page); // no scene seen, and none is due on this date
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(peek(page)).toBeVisible();
  const sceneLines = content.scenes.flatMap((s) => [...s.lines, ...Object.values(s.weatherVariants ?? {}).flat()]);
  for (let i = 0; i < 5; i++) {
    await peek(page).click();
    expect(sceneLines).not.toContain(await bubble(page).textContent());
    await dialog(page).getByRole('button', { name: 'Hejdå' }).click();
  }
  const stored = await page.evaluate(() => [localStorage.getItem('advent.tomte.scenesSeen'), localStorage.getItem('advent.tomte.history')]);
  expect(stored).toEqual([null, null]);
});

test('history: shows only what has been seen, with dates and answers (2026-11-30 and 2026-12-03)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-11-30'));
  await gotoApp(page);
  await expect(bubble(page)).toHaveText(content.scenes[0].lines[0]);
  await finishConversation(page);

  // Empty history is not shown for a scene seen: first check the sheet has one card.
  await peek(page).click();
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('.sheet-card')).toHaveCount(1);
  await expect(sheet(page).locator('.sheet-date')).toHaveText('mån 30 nov');
  await sheet(page).getByRole('button', { name: 'Stäng' }).click();
  await dialog(page).getByRole('button', { name: 'Hejdå' }).click();

  await page.clock.setFixedTime(at('2026-12-03'));
  await page.reload();
  await expect(bubble(page)).toHaveText(content.scenes[1].lines[0]);
  await finishConversation(page);

  await peek(page).click();
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  const cards = sheet(page).locator('.sheet-card');
  await expect(cards).toHaveCount(2);
  await expect(sheet(page).locator('.sheet-date')).toHaveText(['tors 3 dec', 'mån 30 nov']); // newest first
  const first = content.scenes[1];
  await expect(cards.nth(0)).toContainText(first.lines[0]);
  await expect(cards.nth(0)).toContainText(`Du svarade: ${first.questions[0].options[0].label}`);
  await expect(cards.nth(0)).toContainText(first.questions[0].options[0].reply);
  await expect(cards.nth(1)).toContainText(content.scenes[0].lines[0]);

  // Nothing from the scenes that have not happened yet.
  const text = await sheet(page).innerText();
  for (const later of content.scenes.slice(2)) {
    for (const line of later.lines) expect(text).not.toContain(line);
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('advent.tomte.history')).map((e) => [e.id, e.date]))).toEqual([
    [content.scenes[0].id, '2026-11-30'],
    [content.scenes[1].id, '2026-12-03'],
  ]);
  await screenshot(page, 'history-two-scenes');
});

test('history: empty state', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page);
  await peek(page).click();
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  await expect(sheet(page)).toContainText('Vi har inte pratat än. Jag hör av mig snart.');
  await expect(sheet(page).locator('.sheet-card')).toHaveCount(0);
  await screenshot(page, 'history-empty');
});

test('history: the intro is not saved, the welcome and a replayed scene are saved once', async ({ page }) => {
  await noForecast(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await finishConversation(page); // the welcome, installed
  await peek(page).click();
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  await expect(sheet(page).locator('.sheet-card')).toHaveCount(1);
  await expect(sheet(page).locator('.sheet-tag')).toHaveText('Välkomst');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('advent.tomte.history')).map((e) => e.id))).toEqual(['welcome']);
});

test('history sheet: closes with the button, Esc and a swipe, keeps focus, scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page, './?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await page.locator('#dev-panel').getByRole('button', { name: 'Fyll historiken med exempel' }).click();
  await page.keyboard.press('Escape');

  const open = async () => {
    await peek(page).click();
    await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
    await expect(sheet(page)).toBeVisible();
  };
  await open();
  await expect(sheet(page).getByRole('button', { name: 'Stäng' })).toBeFocused();
  await expect(sheet(page).locator('.sheet-card')).toHaveCount(content.scenes.length + 1);

  // Its own scrollbar, and the page behind does not scroll.
  const metrics = await sheet(page).locator('.sheet-body').evaluate((n) => ({ scroll: n.scrollHeight, client: n.clientHeight }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  const before = await page.evaluate(() => window.scrollY);
  await sheet(page).locator('.sheet-body').hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => sheet(page).locator('.sheet-body').evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await screenshot(page, 'history-many');

  // The button, and focus goes back to the button that opened it.
  await sheet(page).getByRole('button', { name: 'Stäng' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(dialog(page).getByRole('button', { name: 'Tidigare repliker' })).toBeFocused();

  // Esc closes the sheet only, Tomten stays.
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(dialog(page)).toBeVisible();

  // A swipe down on the header closes it, a short drag does not.
  await dialog(page).getByRole('button', { name: 'Tidigare repliker' }).click();
  await page.waitForTimeout(450); // the sheet slides in first
  const head = await sheet(page).locator('.sheet-head').boundingBox();
  const x = head.x + head.width / 2;
  const y = head.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 3 });
  await page.mouse.up();
  await expect(sheet(page)).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 160, { steps: 6 });
  await page.mouse.up();
  await expect(sheet(page)).toBeHidden();
});

test('dev panel: show Tomten, fill and reset the history, play a random line', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page, './?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');

  await panel.getByRole('button', { name: 'Fyll historiken med exempel' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('advent.tomte.history')).length)).toBe(content.scenes.length + 1);

  await panel.getByRole('button', { name: 'Spela slumprad' }).click();
  await expect(dialog(page)).toBeVisible();
  expect(random).toContain(await bubble(page).textContent());
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('advent.tomte.randomBag')).used.length)).toBe(1);
  await dialog(page).getByRole('button', { name: 'Hejdå' }).click();

  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await panel.getByRole('button', { name: 'Nollställ historik och slumplott' }).click();
  expect(await page.evaluate(() => [localStorage.getItem('advent.tomte.history'), localStorage.getItem('advent.tomte.randomBag')])).toEqual([null, null]);

  await panel.getByRole('button', { name: 'Visa tomten nu' }).click();
  await expect(peek(page)).toBeVisible();
  // His button stays reachable: the dev toggle moves up out of his way.
  const [santa] = await boxes(page, '.peek');
  const [toggle] = await boxes(page, '.dev-toggle');
  expect(overlaps(santa, toggle)).toBe(false);
});

test('without tomte-random.json there is no peeking Santa, and the rest works', async ({ page }) => {
  await skipTomte(page);
  await page.route('**/content/tomte-random.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page);
  await page.waitForTimeout(900);
  await expect(peek(page)).toHaveCount(0);
});

test('offline: he is there and talks from the cached lines', async ({ page, context }) => {
  await skipTomte(page);
  await page.clock.setFixedTime(at('2026-12-10'));
  await gotoApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(peek(page)).toBeVisible();
  await peek(page).click();
  expect(random).toContain(await bubble(page).textContent());
});

test('animations: he blinks and wiggles now and then, never with reduced motion', async ({ page }) => {
  await skipTomte(page);
  await page.clock.install({ time: at('2026-12-10') });
  const watch = () =>
    page.addInitScript(() => {
      window.__peekClasses = new Set();
      new MutationObserver((records) => {
        for (const r of records) for (const c of r.target.classList) window.__peekClasses.add(c);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  await watch();
  await gotoApp(page);
  await expect(peek(page)).toBeVisible();
  // Blink: every 8-15 s, so within 16 s of calendar time there is at least one; the hat within 46 s.
  for (let i = 0; i < 46; i++) await page.clock.runFor(1000);
  const classes = await page.evaluate(() => [...window.__peekClasses]);
  expect(classes).toContain('is-blink');
  expect(classes).toContain('is-wiggle');
});

test('reduced motion: no blinking, wiggling or entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await skipTomte(page);
  await page.clock.install({ time: at('2026-12-10') });
  await page.addInitScript(() => {
    window.__peekClasses = new Set();
    new MutationObserver((records) => {
      for (const r of records) for (const c of r.target.classList) window.__peekClasses.add(c);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await gotoApp(page);
  await expect(peek(page)).toBeVisible();
  for (let i = 0; i < 50; i++) await page.clock.runFor(1000);
  const classes = await page.evaluate(() => [...window.__peekClasses]);
  expect(classes).not.toContain('is-blink');
  expect(classes).not.toContain('is-wiggle');
  expect(await peek(page).evaluate((n) => getComputedStyle(n).animationName)).toBe('none');
  // He is still usable.
  await peek(page).click();
  await expect(dialog(page)).toBeVisible();
  expect(await dialog(page).evaluate((n) => getComputedStyle(n).animationName)).toBe('none');
});

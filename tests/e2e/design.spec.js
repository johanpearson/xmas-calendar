// Christmas design and opening animations (milestone 7).
import { test, expect } from '@playwright/test';
import { skipTomte } from './helpers.js';

const NOW = new Date('2026-12-05T10:00:00+01:00');

const door = (page, date) => page.locator(`.door[data-date="${date}"]`);

// Serves days.json with some days changed, e.g. { '2026-12-02': { type: 'litet' } }.
async function patchContent(page, changes) {
  await page.route('**/content/days.json', async (route) => {
    const json = await (await route.fetch()).json();
    for (const day of json.days) Object.assign(day, changes[day.date]);
    await route.fulfill({ json });
  });
}

async function gotoApp(page, path = './') {
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await skipTomte(page);
});

test('each type plays its animation, then the card shows and the overlay is gone', async ({ page }) => {
  await patchContent(page, {
    '2026-12-01': { type: 'ledtrad' },
    '2026-12-02': { type: 'litet' },
    '2026-12-03': { type: 'uppdrag' },
    '2026-12-04': { type: 'rim' },
    '2026-12-05': { type: 'jakt' },
    '2026-11-29': { type: 'rim', animation: 'snowburst' },
  });
  await page.addInitScript(() => {
    window.__vibrations = 0;
    navigator.vibrate = () => {
      window.__vibrations++;
      return true;
    };
  });
  await gotoApp(page);
  const card = page.locator('#card');
  const expected = {
    '2026-12-01': 'letter',
    '2026-12-02': 'pop',
    '2026-12-03': 'rise',
    '2026-12-04': 'pop',
    '2026-12-05': 'glint',
    '2026-11-29': 'pop',
  };

  for (const [date, reveal] of Object.entries(expected)) {
    await door(page, date).click();
    await expect(page.locator('.fx')).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(page.locator('.fx, .fx-p')).toHaveCount(0); // particles are cleaned up
    await expect(card).toHaveAttribute('data-reveal', reveal);
    await card.getByRole('button', { name: 'Stäng' }).click();
    await expect(door(page, date)).toHaveClass(/is-opened/);
  }
  expect(await page.evaluate(() => window.__vibrations)).toBe(6);

  // Opening an already opened door (a double tap) shows the card at once, without an animation.
  await door(page, '2026-12-02').dblclick();
  await expect(card).toBeVisible();
  await expect(page.locator('.fx')).toHaveCount(0);
  await expect(card).not.toHaveAttribute('data-reveal');
});

test('every animation finishes within about 1.2 seconds', async ({ page }) => {
  await patchContent(page, { '2026-12-03': { type: 'rim' } }); // ribbon is the longest
  await gotoApp(page);
  // Measured in the page: from the click until the card dialog opens.
  const elapsed = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const card = document.getElementById('card');
        const target = document.querySelector('.door[data-date="2026-12-03"]');
        let start;
        new MutationObserver(() => card.open && resolve(performance.now() - start)).observe(card, { attributes: true });
        start = performance.now();
        target.click();
      }),
  );
  expect(elapsed).toBeGreaterThan(800);
  expect(elapsed).toBeLessThan(1250);
});

test('a tap skips the animation and the card stays open', async ({ page }) => {
  await gotoApp(page);
  await door(page, '2026-12-04').click();
  await expect(page.locator('.fx')).toHaveCount(1);
  await page.locator('.fx').click({ position: { x: 20, y: 20 } });
  const card = page.locator('#card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-reveal', 'fade');
  await expect(page.locator('.fx')).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
});

test('reduced motion: no overlay, no snow, the card just fades in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoApp(page);
  await expect(page.locator('.snow-canvas')).toHaveCount(0);
  await door(page, '2026-12-05').click();
  await expect(page.locator('#card')).toBeVisible();
  await expect(page.locator('.fx')).toHaveCount(0);
  await expect(page.locator('#card')).toHaveAttribute('data-reveal', 'fade');
});

test('decoration sits behind the content and takes no taps', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.snow-canvas')).toHaveCount(1);
  await expect(page.locator('.garland svg')).toHaveCount(1);
  for (const selector of ['.scene', '.garland', '.horizon']) {
    await expect(page.locator(selector)).toHaveCSS('pointer-events', 'none');
    await expect(page.locator(selector)).toHaveAttribute('aria-hidden', 'true');
  }
  // The bottom row sits over the trees but is still the element that gets the tap.
  const target = await door(page, '2026-12-21').evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.scrollIntoView({ block: 'end' });
    const r2 = el.getBoundingClientRect();
    return document.elementFromPoint(r2.left + r.width / 2, r2.top + r.height / 2)?.closest('.door')?.dataset.date;
  });
  expect(target).toBe('2026-12-21');
});

test('neighbouring doors never share a theme and specials have their own look', async ({ page }) => {
  await gotoApp(page);
  const doors = await page.locator('#grid .door').evaluateAll((els) =>
    els.map((el) => ({ date: el.dataset.date, theme: el.dataset.theme ?? null, cls: el.className })),
  );
  expect(doors).toHaveLength(24);
  for (const cols of [4, 6]) {
    doors.forEach((d, i) => {
      const right = doors[i + 1];
      const below = doors[i + cols];
      if (d.theme && right && (i + 1) % cols !== 0) expect(d.theme, `${d.date} right`).not.toBe(right.theme);
      if (d.theme && below) expect(d.theme, `${d.date} below`).not.toBe(below.theme);
    });
  }
  expect(doors.find((d) => d.date === '2026-12-24').cls).toContain('look-christmas');
  // Same layout on every visit.
  await page.reload();
  await expect(page.locator('#grid .door')).toHaveCount(24); // evaluateAll does not wait for the grid
  const again = await page.locator('#grid .door').evaluateAll((els) => els.map((el) => el.dataset.theme ?? null));
  expect(again).toEqual(doors.map((d) => d.theme));
});

test('dev: "Spela upp animation" previews without opening the door', async ({ page }) => {
  await gotoApp(page, './?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');
  await panel.getByLabel('Lucka', { exact: true }).selectOption({ label: '20 december · 4:e advent' });
  await panel.getByLabel('Animation').selectOption('confetti');
  await panel.getByRole('button', { name: 'Spela upp animation' }).click();
  await expect(page.locator('.fx')).toHaveCount(1);
  const card = page.locator('#card');
  await expect(card).toBeVisible();
  await expect(card.locator('#card-date')).toContainText('20 december');
  await expect(page.locator('.fx')).toHaveCount(0);
  await card.getByRole('button', { name: 'Stäng' }).click();
  await expect(door(page, '2026-12-20')).toHaveClass(/is-locked/);
  await expect(door(page, '2026-12-20')).not.toHaveClass(/is-opened/);
  expect(await page.evaluate(() => localStorage.getItem('advent.opened'))).toBeNull();
});

test('aria-labels describe advent doors and their state', async ({ page }) => {
  await gotoApp(page);
  await expect(door(page, '2026-12-13')).toHaveAttribute('aria-label', 'Lucka 13, 3:e advent, låst, öppnas 13 december');
  await expect(door(page, '2026-12-13')).toHaveClass(/look-advent/);
  await expect(door(page, '2026-12-06')).toHaveAttribute('aria-label', 'Lucka 6, 2:a advent, låst, öppnas 6 december');
  await expect(door(page, '2026-11-29')).toHaveAttribute('aria-label', '1:a advent, redo att öppnas');
  await expect(door(page, '2026-11-29')).toHaveClass(/look-advent/);
  await expect(door(page, '2026-12-05')).toHaveAttribute('aria-label', 'Lucka 5, idag, redo att öppnas');
  // Advent candles: 1 to 4 lit flames (each flame is two paths).
  for (const [date, lit] of [['2026-11-29', 1], ['2026-12-06', 2], ['2026-12-13', 3], ['2026-12-20', 4]]) {
    await expect(door(page, date).locator('.candle-flame')).toHaveCount(lit * 2);
  }
});

test('verse shows in italics under the title, one line per line break, as plain text', async ({ page }) => {
  await patchContent(page, {
    '2026-11-29': { verse: 'Första raden\nAndra <b>raden</b>' },
    '2026-12-01': { verse: undefined },
  });
  await gotoApp(page);
  const card = page.locator('#card');
  const verse = card.locator('#card-verse');

  // The special door for 1st advent.
  await door(page, '2026-11-29').click();
  await expect(card).toBeVisible();
  await expect(verse).toBeVisible();
  await expect(verse.locator('p')).toHaveText(['Första raden', 'Andra <b>raden</b>']);
  await expect(verse.locator('b')).toHaveCount(0);
  expect(await verse.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
  // Between the title and the body (with only Tomten's plan B line, hidden here, between them).
  expect(await verse.evaluate((el) => [el.previousElementSibling.id, el.nextElementSibling.id, el.nextElementSibling.nextElementSibling.id])).toEqual([
    'card-title',
    'card-note',
    'card-body',
  ]);
  await card.getByRole('button', { name: 'Stäng' }).click();

  // A day without a verse hides it.
  await door(page, '2026-12-01').click();
  await expect(card).toBeVisible();
  await expect(verse).toBeHidden();
});

test('plan B shows its own verse, or falls back to the day\'s verse', async ({ page }) => {
  await patchContent(page, {
    '2026-12-01': { verse: 'Dagens vers', alternative: { title: 'Plan B', body: 'Reserv', verse: 'Reservvers' } },
    '2026-12-02': { verse: 'Dagens vers', alternative: { title: 'Plan B', body: 'Reserv' } },
  });
  await gotoApp(page);
  const card = page.locator('#card');
  const verse = card.locator('#card-verse');
  const toggle = card.getByRole('button', { name: 'Dåligt väder? Visa plan B' });

  await door(page, '2026-12-01').click();
  await expect(verse).toHaveText('Dagens vers');
  await toggle.click();
  await expect(verse).toHaveText('Reservvers');
  await card.getByRole('button', { name: 'Visa plan A' }).click();
  await expect(verse).toHaveText('Dagens vers');
  await card.getByRole('button', { name: 'Stäng' }).click();

  await door(page, '2026-12-02').click();
  await toggle.click();
  await expect(card.locator('#card-body')).toHaveText('Reserv');
  await expect(verse).toHaveText('Dagens vers');
});

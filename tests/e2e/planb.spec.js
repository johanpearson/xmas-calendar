// Automatic plan B (milestone 13) with a mocked Open-Meteo, and the new content's cards:
// 2026-12-02 (a verse and an empty body) and 2026-12-08 (a blank line in the body).
// Nothing here reaches the real api.open-meteo.com.
//
// Screenshots at 360 px go to the test output folder. With PLANB_SCREENSHOTS=1 they are
// also written to docs/screenshots/planb/ (for the README and PR descriptions):
//   PLANB_SCREENSHOTS=1 npx playwright test tests/e2e/planb.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const { days } = read('../../content/days.json');
const tomte = read('../../content/tomte.json');
const DOCS = new URL('../../docs/screenshots/planb/', import.meta.url);

const DATE = '2026-12-20';
const advent4 = days.find((d) => d.date === DATE);
const NOTE = 'Tomten har tittat på vädret och det ser blött eller blåsigt ut, så det blir plan B.';
const lines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);

test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });

const door = (page, date) => page.locator(`.door[data-date="${date}"]`);
const card = (page) => page.locator('#card');
const title = (page) => page.locator('#card-title');
const verse = (page) => page.locator('#card-verse');
const note = (page) => page.locator('#card-note');
const body = (page) => page.locator('#card-body');
const toPlanB = (page) => card(page).getByRole('button', { name: 'Dåligt väder? Visa plan B' });
const toPlanA = (page) => card(page).getByRole('button', { name: 'Visa plan A' });

const forecastBody = (date, { precipitation, wind }) => ({
  latitude: 55.94,
  longitude: 13.54,
  timezone: 'Europe/Stockholm',
  daily: { time: [date], precipitation_sum: [precipitation], wind_speed_10m_max: [wind], temperature_2m_max: [1.4] },
});
const FINE = { precipitation: 0.3, wind: 4.2 };
const RAINY = { precipitation: 3.5, wind: 6 };

/**
 * Mocks Open-Meteo: values to answer with, or null for an error (an "unknown" forecast).
 * delayMs holds the answer back. Returns the requested dates.
 */
async function mockForecast(page, values, { delayMs = 0 } = {}) {
  const dates = [];
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const date = new URL(route.request().url()).searchParams.get('start_date');
    dates.push(date);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill(
      values
        ? { status: 200, headers: { 'access-control-allow-origin': '*' }, json: forecastBody(date, values) }
        : { status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' },
    );
  });
  return dates;
}

// Tomten already said everything, so his dialog never covers the calendar.
async function start(page, date = DATE, path = './') {
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
    localStorage.setItem('advent.iosHintDismissed', '1');
  }, tomte.scenes.map((s) => s.id));
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+01:00`));
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

async function expectPlanA(page) {
  await expect(body(page).locator('p')).toHaveText(lines(advent4.body));
  await expect(note(page)).toBeHidden();
  await expect(toPlanB(page)).toBeVisible();
}

async function expectPlanB(page, { withNote }) {
  await expect(body(page).locator('p')).toHaveText(lines(advent4.alternative.body));
  if (withNote) await expect(note(page)).toHaveText(NOTE);
  else await expect(note(page)).toBeHidden();
  await expect(toPlanA(page)).toBeVisible();
}

// Title and verse look the same in plan A and B: same text, same style.
async function titleAndVerse(page) {
  return {
    title: await title(page).textContent(),
    verse: await verse(page).locator('p').allTextContents(),
    style: await verse(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.fontStyle, s.fontFamily, s.fontSize];
    }),
  };
}

async function shot(page, name, testInfo) {
  await page.waitForTimeout(400); // the card's entrance
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  if (process.env.PLANB_SCREENSHOTS) {
    mkdirSync(DOCS, { recursive: true });
    await page.screenshot({ path: new URL(`${name}.png`, DOCS).pathname });
  }
}

test.describe('reduced motion', () => {
  // The card shows without the opening animation, so the tests are quick and the scene still.
  test.use({ reducedMotion: 'reduce' });

  test('bad forecast: plan B at once with Tomten\'s line, and the button switches both ways', async ({ page }, testInfo) => {
    const dates = await mockForecast(page, RAINY);
    await start(page);
    await door(page, DATE).click();
    await expect(card(page)).toBeVisible();
    await expectPlanB(page, { withNote: true });
    await expect(title(page)).toHaveText(advent4.alternative.title);
    await expect(verse(page).locator('p')).toHaveText(lines(advent4.alternative.verse));
    expect(dates).toEqual([DATE]); // the door's own date
    // Tomten's line sits above the text, below the verse.
    expect(await note(page).evaluate((el) => [el.previousElementSibling.id, el.nextElementSibling.id])).toEqual([
      'card-verse',
      'card-body',
    ]);
    const inB = await titleAndVerse(page);
    await shot(page, 'advent4-plan-b', testInfo);

    await toPlanA(page).click();
    await expectPlanA(page);
    expect(await titleAndVerse(page)).toEqual(inB);
    await shot(page, 'advent4-plan-a', testInfo);

    await toPlanB(page).click();
    await expectPlanB(page, { withNote: true });
  });

  test('good forecast: the main text, and plan B by hand without Tomten\'s line', async ({ page }) => {
    await mockForecast(page, FINE);
    await start(page);
    await door(page, DATE).click();
    await expectPlanA(page);
    await expect(title(page)).toHaveText(advent4.title);
    await expect(verse(page).locator('p')).toHaveText(lines(advent4.verse));
    const inA = await titleAndVerse(page);

    await toPlanB(page).click();
    await expectPlanB(page, { withNote: false });
    expect(await titleAndVerse(page)).toEqual(inA);
    await toPlanA(page).click();
    await expectPlanA(page);
  });

  test('unknown forecast (the source fails): the main text, the button still works', async ({ page }) => {
    const dates = await mockForecast(page, null);
    await start(page);
    await door(page, DATE).click();
    await expectPlanA(page);
    expect(dates).toEqual([DATE]);
    await toPlanB(page).click();
    await expectPlanB(page, { withNote: false });
    await toPlanA(page).click();
    await expectPlanA(page);
  });

  test('a door without a plan B never asks for the forecast', async ({ page }) => {
    const dates = await mockForecast(page, RAINY);
    await start(page);
    await door(page, '2026-12-19').click();
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator('#card-alt')).toBeHidden();
    await expect(note(page)).toBeHidden();
    expect(dates).toEqual([]);
  });

  test('2026-12-02: title and italic verse, no empty text and no extra space', async ({ page }, testInfo) => {
    await mockForecast(page, null);
    await start(page);
    const day = days.find((d) => d.date === '2026-12-02');
    await door(page, day.date).click();
    await expect(card(page)).toBeVisible();
    await expect(title(page)).toHaveText(day.title);
    await expect(verse(page).locator('p')).toHaveText(lines(day.verse));
    expect(await verse(page).evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
    await expect(body(page)).toBeHidden();
    await expect(body(page).locator('p')).toHaveCount(0);
    await expect(note(page)).toBeHidden();
    // The verse is the last text: no margin below it, so the buttons follow at their usual distance.
    expect(await verse(page).evaluate((el) => getComputedStyle(el).marginBottom)).toBe('0px');
    await shot(page, 'verse-only-2026-12-02', testInfo);
  });

  test('2026-12-08: the blank line gives extra space between paragraphs', async ({ page }, testInfo) => {
    await mockForecast(page, null);
    await start(page);
    const day = days.find((d) => d.date === '2026-12-08');
    await door(page, day.date).click();
    await expect(card(page)).toBeVisible();
    const paragraphs = body(page).locator('p');
    await expect(paragraphs).toHaveText(lines(day.body));
    // Only the paragraph after the blank line is spaced, and the gap is larger than the rest.
    const gaps = await paragraphs.evaluateAll((ps) =>
      ps.slice(1).map((p, i) => p.getBoundingClientRect().top - ps[i].getBoundingClientRect().bottom),
    );
    const spaced = await paragraphs.evaluateAll((ps) => ps.map((p) => p.classList.contains('is-spaced')));
    expect(spaced).toEqual([false, false, false, true]);
    expect(gaps[2]).toBeGreaterThan(gaps[0] + 8);
    expect(gaps[0]).toBeCloseTo(gaps[1], 0);
    await shot(page, 'blank-line-2026-12-08', testInfo);
  });

  test('dev "Prognos" decides plan B without a real forecast', async ({ page }) => {
    const dates = await mockForecast(page, FINE);
    await start(page, DATE, './?dev=on');
    const panel = page.locator('#dev-panel');
    const choose = async (label) => {
      if (await card(page).isVisible()) await card(page).getByRole('button', { name: 'Stäng' }).click();
      await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
      await panel.getByLabel('Prognos').selectOption({ label });
      await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
      await door(page, DATE).click();
      await expect(card(page)).toBeVisible();
    };
    await choose('Dålig');
    await expectPlanB(page, { withNote: true });
    await choose('Bra');
    await expectPlanA(page);
    await choose('Okänd');
    await expectPlanA(page);
    expect(dates).toEqual([]); // a forced variant never asks Open-Meteo
    await choose('Riktig');
    await expectPlanA(page); // the mocked real forecast is fine
    expect(dates).toEqual([DATE]);
  });
});

test.describe('a slow forecast', () => {
  test('the door opens on the main text and switches to plan B softly when "bad" comes', async ({ page }) => {
    await mockForecast(page, RAINY, { delayMs: 2200 });
    await start(page);
    await door(page, DATE).click();
    await expect(card(page)).toBeVisible();
    // The opening animation takes about 1.2 s and the card doesn't wait for the forecast after it.
    await expectPlanA(page);
    await expectPlanB(page, { withNote: true });
    await expect(card(page)).toHaveClass(/is-replanned/);
  });

  test('a late "bad" never moves a plan that was switched by hand', async ({ page }) => {
    await mockForecast(page, RAINY, { delayMs: 2500 });
    await start(page);
    await door(page, DATE).click();
    await expectPlanA(page);
    await toPlanB(page).click();
    await toPlanA(page).click();
    await page.waitForTimeout(2500); // the forecast has come by now
    await expectPlanA(page);
    await expect(card(page)).not.toHaveClass(/is-replanned/);
  });

  test('a late answer never reaches a card that was closed meanwhile', async ({ page }) => {
    await mockForecast(page, RAINY, { delayMs: 2200 });
    await start(page);
    await door(page, DATE).click();
    await expectPlanA(page);
    await card(page).getByRole('button', { name: 'Stäng' }).click();
    await door(page, '2026-12-19').click();
    await page.waitForTimeout(2200);
    await expect(card(page)).toBeVisible();
    await expect(note(page)).toBeHidden();
    await expect(card(page).locator('#card-alt')).toBeHidden();
  });
});

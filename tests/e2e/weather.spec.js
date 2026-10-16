// Weather (milestone 10): Tomten's weather scenes with a mocked Open-Meteo.
// Nothing here reaches the real api.open-meteo.com.
import { test, expect } from '@playwright/test';

const at = (date) => new Date(`${date}T10:00:00+01:00`);
const OPEN_METEO = 'https://api.open-meteo.com/**';

const tomte = (page) => page.locator('dialog.tomte');
const bubbleText = (page) => page.locator('#tomte-text');
const credit = (page) => tomte(page).locator('.tomte-credit');

// Intro and welcome already seen, so the start-up check goes straight to the scenes.
async function skipIntro(page) {
  await page.addInitScript(() => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
  });
}

const forecastBody = (date, { precipitation, wind }) => ({
  latitude: 55.94,
  longitude: 13.54,
  timezone: 'Europe/Stockholm',
  daily_units: { time: 'iso8601', precipitation_sum: 'mm', wind_speed_10m_max: 'm/s', temperature_2m_max: '°C' },
  daily: { time: [date], precipitation_sum: [precipitation], wind_speed_10m_max: [wind], temperature_2m_max: [1.4] },
});

/**
 * Answers Open-Meteo requests: `answer(url)` returns { status, body } or 'hang'.
 * Returns the list of requests seen (url and headers).
 */
async function mockOpenMeteo(page, answer) {
  const requests = [];
  await page.route(OPEN_METEO, async (route) => {
    const request = route.request();
    requests.push({ url: new URL(request.url()), headers: await request.allHeaders() });
    const result = answer(new URL(request.url()));
    if (result === 'hang') return; // never answered: the app's own timeout has to kick in
    await route.fulfill({
      status: result.status ?? 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(result.body),
    });
  });
  return requests;
}

const fine = (url) => ({ body: forecastBody(url.searchParams.get('start_date'), { precipitation: 0.3, wind: 4.2 }) });
const rainy = (url) => ({ body: forecastBody(url.searchParams.get('start_date'), { precipitation: 3.5, wind: 6 }) });

async function start(page, date, path = './') {
  await page.clock.setFixedTime(at(date));
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

test('2026-12-14: a fine forecast for the walk day gives the "good" lines, with attribution', async ({ page }) => {
  await skipIntro(page);
  const requests = await mockOpenMeteo(page, fine);
  await start(page, '2026-12-14');

  await expect(bubbleText(page)).toHaveText('God måndag, Elin! Jag har tittat på vädret inför helgen.');
  await expect(credit(page)).toBeVisible();
  await expect(credit(page)).toHaveText('Väderdata: Open-Meteo.com');
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Det ser ut att bli fint väder i helgen/);

  // One request: Höör's coordinates for the walk day (the scene's last forecast date) and
  // the agreed variables, nothing else. No cookies, no referrer.
  expect(requests).toHaveLength(1);
  const { url, headers } = requests[0];
  expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    latitude: '55.94',
    longitude: '13.54',
    daily: 'precipitation_sum,wind_speed_10m_max,temperature_2m_max',
    wind_speed_unit: 'ms',
    timezone: 'Europe/Stockholm',
    start_date: '2026-12-20',
    end_date: '2026-12-20',
  });
  expect(headers.referer).toBeUndefined();
  expect(headers.cookie).toBeUndefined();
});

test('2026-12-18: a rainy forecast gives the "bad" lines', async ({ page }) => {
  await skipIntro(page);
  await mockOpenMeteo(page, rainy);
  await start(page, '2026-12-18');

  await expect(bubbleText(page)).toHaveText('Fredag, Elin! Nu har jag koll på helgens väder.');
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Plan B gäller/);
  await expect(credit(page)).toBeVisible();
});

test('an error from Open-Meteo (date out of range) gives "unknown" without any error in the UI', async ({ page }) => {
  await skipIntro(page);
  await mockOpenMeteo(page, () => ({
    status: 400,
    body: { error: true, reason: "Parameter 'start_date' is out of allowed range" },
  }));
  await start(page, '2026-12-18');

  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Jag får inte tag i någon prognos/);
  await expect(page.getByText(/out of allowed range|error/i)).toHaveCount(0);
});

test('no answer within 4 seconds gives "unknown"', async ({ page }) => {
  await skipIntro(page);
  await mockOpenMeteo(page, () => 'hang');
  await start(page, '2026-12-18');

  await expect(bubbleText(page)).toHaveText('Fredag, Elin! Nu har jag koll på helgens väder.', { timeout: 8000 });
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Jag får inte tag i någon prognos/);
});

test('scenes without weather never ask for a forecast or show the attribution', async ({ page }) => {
  await skipIntro(page);
  const requests = await mockOpenMeteo(page, fine);
  await start(page, '2026-12-08');

  await expect(bubbleText(page)).toHaveText(/Ny vecka/);
  await expect(credit(page)).toBeHidden();
  expect(requests).toHaveLength(0);
});

test('the forecast is cached in localStorage, not by the service worker', async ({ page }) => {
  await skipIntro(page);
  const requests = await mockOpenMeteo(page, rainy);
  await start(page, '2026-11-29');
  // Wait until the service worker controls the page, so it would see the request.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });

  await page.clock.setFixedTime(at('2026-12-18'));
  await page.reload();
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Plan B gäller/);
  expect(requests).toHaveLength(1);

  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('advent.weather.cache')));
  expect(cache['2026-12-20']).toMatchObject({ source: 'open-meteo', precipitation: 3.5, wind: 6 });
  const cachedUrls = await page.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cachedUrls.some((u) => u.includes('open-meteo'))).toBe(false);

  // Within 3 hours the cached forecast is used, even with Open-Meteo unreachable.
  await page.unroute(OPEN_METEO);
  await mockOpenMeteo(page, () => 'hang');
  await page.evaluate(() => localStorage.removeItem('advent.tomte.scenesSeen'));
  await page.reload();
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Plan B gäller/);
});

test('dev: the panel shows the last fetched values and when', async ({ page }) => {
  await skipIntro(page);
  await mockOpenMeteo(page, rainy);
  await start(page, '2026-12-18', './?dev=on');
  await expect(bubbleText(page)).toHaveText('Fredag, Elin! Nu har jag koll på helgens väder.');
  await tomte(page).getByRole('button', { name: 'Stäng' }).click();

  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');
  await expect(panel.getByLabel('Prognos')).toHaveValue('real');
  await expect(panel.locator('.dev-forecast-last')).toHaveText(
    'Senast hämtat 18 dec. 10:00, för 20 december: nederbörd 3,5 mm, vind 6 m/s.',
  );
});

test('dev: "Testa hämtning (imorgon)" fetches tomorrow by the real date and shows the result', async ({ page }) => {
  await skipIntro(page);
  let answer = rainy;
  const requests = await mockOpenMeteo(page, (url) => answer(url));
  await page.clock.setFixedTime(at('2026-10-14'));
  await page.addInitScript(() => localStorage.setItem('advent.dateOverride', '2026-12-18'));
  await page.goto('./?dev=on');
  await expect(page.locator('#grid .door').first()).toBeVisible();
  await tomte(page).getByRole('button', { name: 'Stäng' }).click(); // the 18 Dec scene
  requests.length = 0;

  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');
  await panel.getByRole('button', { name: 'Testa hämtning (imorgon)' }).click();
  await expect(page.locator('#toast')).toHaveText('Prognos för 15 oktober: dålig');
  expect(requests).toHaveLength(1);
  expect(requests[0].url.searchParams.get('start_date')).toBe('2026-10-15'); // real date, not the simulated one
  await expect(panel.locator('.dev-forecast-last')).toHaveText(
    'Senast hämtat 14 okt. 11:00, för 15 oktober: nederbörd 3,5 mm, vind 6 m/s.',
  );

  answer = () => ({ status: 400, body: { error: true, reason: 'out of range' } });
  await panel.getByRole('button', { name: 'Testa hämtning (imorgon)' }).click();
  await expect(page.locator('#toast')).toHaveText('Hämtningen misslyckades: Open-Meteo: HTTP 400');
});

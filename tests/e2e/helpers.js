// Shared helpers for the e2e tests.
import { readFileSync } from 'node:fs';

const tomte = JSON.parse(readFileSync(new URL('../../content/tomte.json', import.meta.url), 'utf8'));

// Marks Tomten's intro, welcome and every scene as already seen, so his dialog doesn't
// cover the calendar in tests about something else. Also keeps the forecast away (see
// noForecast), which only Tomten's weather scenes and plan B ask for.
export async function skipTomte(page) {
  await noForecast(page);
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
  }, tomte.scenes.map((s) => s.id));
}

// Answers every forecast request with an error (so the forecast is "unknown"), so no test
// reaches the real api.open-meteo.com and a door with a plan B opens on its main text.
// Tests about the weather mock it themselves (weather.spec.js, planb.spec.js).
export async function noForecast(page) {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }),
  );
}

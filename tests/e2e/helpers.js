// Shared helpers for the e2e tests.
import { readFileSync } from 'node:fs';

const tomte = JSON.parse(readFileSync(new URL('../../content/tomte.json', import.meta.url), 'utf8'));

// Marks Tomten's intro, welcome and every scene as already seen, so his dialog doesn't
// cover the calendar in tests about something else.
export async function skipTomte(page) {
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
  }, tomte.scenes.map((s) => s.id));
}

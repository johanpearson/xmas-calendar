// Tomten (milestone 8): intro, welcome, scenes, questions and the dev panel.
import { test, expect } from '@playwright/test';

const at = (date) => new Date(`${date}T10:00:00+01:00`);

async function gotoApp(page, path = './') {
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

const tomte = (page) => page.locator('dialog.tomte');
const bubbleText = (page) => page.locator('#tomte-text');

// Pretends the app runs installed (iOS sets navigator.standalone).
async function runAsInstalled(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
}

async function markSeen(page, { intro = true, welcome = true, scenes = [] } = {}) {
  await page.addInitScript(
    ({ intro, welcome, scenes }) => {
      if (intro) localStorage.setItem('advent.tomte.introSeen', '1');
      if (welcome) localStorage.setItem('advent.tomte.welcomeSeen', '1');
      if (scenes.length) localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(scenes));
    },
    { intro, welcome, scenes },
  );
}

test('intro: shown once in a browser tab, then the install help and "Nu kör vi"', async ({ page }) => {
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(tomte(page)).toBeVisible();
  await expect(tomte(page).locator('#tomte-name')).toHaveText('Tomten');
  await expect(bubbleText(page)).toHaveText('Ho ho ho! Hej Elin, det är jag, tomten.');
  await expect(tomte(page).locator('.tomte-svg .hat-ball')).toHaveCount(1); // the title's hat
  for (let i = 0; i < 4; i++) await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/ingen idé att tjuvtitta/);
  await expect(tomte(page).locator('.tomte-help')).toContainText('Om knappen inte syns');
  await tomte(page).getByRole('button', { name: 'Nu kör vi' }).click();
  await expect(tomte(page)).toBeHidden();

  await page.reload();
  await expect(page.locator('#grid .door').first()).toBeVisible();
  await page.waitForTimeout(900);
  await expect(tomte(page)).toBeHidden();
});

test('intro: the install button shows once beforeinstallprompt has fired', async ({ page }) => {
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(tomte(page)).toBeVisible();
  for (let i = 0; i < 4; i++) await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(tomte(page).locator('.tomte-help')).toBeVisible();

  // Chrome offers installing while the intro is open: the help text becomes the button.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => { window.__prompted = true; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  const install = tomte(page).getByRole('button', { name: 'Installera appen' });
  await expect(install).toBeVisible();
  await expect(tomte(page).locator('.tomte-help')).toHaveCount(0);
  await install.click();
  expect(await page.evaluate(() => window.__prompted)).toBe(true);
  await expect(install).toHaveCount(0);
});

test('welcome: shown once when installed, independent of the intro', async ({ page }) => {
  await page.clock.setFixedTime(at('2026-10-14'));
  await runAsInstalled(page);
  await markSeen(page, { intro: false, welcome: false });
  await gotoApp(page);
  await expect(bubbleText(page)).toHaveText('Ho ho ho, välkommen, Elin! Nu bor jag i din telefon.');
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await tomte(page).getByRole('button', { name: 'Hej då!' }).click();
  expect(await page.evaluate(() => localStorage.getItem('advent.tomte.introSeen'))).toBeNull();

  await page.reload();
  await expect(page.locator('#grid .door').first()).toBeVisible();
  await page.waitForTimeout(900);
  await expect(tomte(page)).toBeHidden();
});

test('a scene shows within its dates, once, and never before from', async ({ page }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-11-29'));
  await gotoApp(page);
  await page.waitForTimeout(900);
  await expect(tomte(page)).toBeHidden();

  await page.clock.setFixedTime(at('2026-11-30'));
  await page.reload();
  await expect(bubbleText(page)).toHaveText('Ho ho ho! God måndag, Elin.');
  await tomte(page).getByRole('button', { name: 'Stäng' }).click(); // the × closes early
  await expect(tomte(page)).toBeHidden();

  await page.reload();
  await expect(page.locator('#grid .door').first()).toBeVisible();
  await page.waitForTimeout(900);
  await expect(tomte(page)).toBeHidden();
});

test('questions: each answer gets its reply, then the closing line, answers stay local', async ({ page }) => {
  const requests = [];
  page.on('request', (req) => requests.push(`${req.method()} ${new URL(req.url()).pathname}`));
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-12-04'));
  await gotoApp(page);
  await expect(bubbleText(page)).toHaveText('Hej igen, Elin! Jag har en snabb koll inför julen.');
  const t = tomte(page);
  await t.getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText('Har ni fixat julgranen?');
  await t.getByRole('button', { name: 'Ja, den står där' }).click();
  await expect(bubbleText(page)).toHaveText('Fint! Nu börjar det likna jul.');
  await t.getByRole('button', { name: 'Nästa' }).click();
  await t.getByRole('button', { name: 'Inte än' }).click();
  await expect(bubbleText(page)).toHaveText(/behöver sin plats/);
  await t.getByRole('button', { name: 'Nästa' }).click();
  await t.getByRole('button', { name: 'Ja, det lyser fint' }).click();
  await t.getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Jag tror på er/); // someNegative
  await t.getByRole('button', { name: 'Hej då!' }).click();
  await expect(t).toBeHidden();

  const answers = JSON.parse(await page.evaluate(() => localStorage.getItem('advent.tomte.answers')));
  expect(answers['v1-uppfoljning']).toEqual({ gran: 0, ljusstakar: 1, utebelysning: 0 });
  expect(requests.filter((r) => !r.startsWith('GET '))).toEqual([]);
});

test('weather scenes use the "unknown" lines for now', async ({ page }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-12-18'));
  await gotoApp(page);
  await expect(bubbleText(page)).toHaveText('Fredag, Elin! Nu har jag koll på helgens väder.');
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(bubbleText(page)).toHaveText(/Jag får inte tag i någon prognos/);
});

test('reduced motion: Tomten shows without the ho ho ho animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(tomte(page)).toBeVisible();
  expect(await page.locator('.tomte-svg').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('.tomte-hoho span').first()).toHaveCSS('opacity', '0');
});

test('dev: play any scene, the date override picks the current one, reset scenes', async ({ page }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page, './?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');

  // Plays a scene long before its dates.
  await panel.getByRole('button', { name: 'Spela upp v4-avsked' }).click();
  await expect(bubbleText(page)).toHaveText('God jul, Elin! Ho ho ho!');
  await tomte(page).getByRole('button', { name: 'Stäng' }).click();
  expect(await page.evaluate(() => localStorage.getItem('advent.tomte.scenesSeen'))).toBeNull();

  // The simulated date decides which scene is current, and it shows on the next start.
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await panel.getByLabel('Simulerat datum').fill('2026-12-08');
  await expect(panel.locator('.dev-tomte-item.is-current')).toContainText('v2-sten-ake');
  await page.reload();
  await expect(bubbleText(page)).toHaveText('God måndag, Elin!');
  await tomte(page).getByRole('button', { name: 'Stäng' }).click();

  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  await expect(panel.locator('.dev-tomte-item.is-current')).toContainText('sedd');
  await panel.getByRole('button', { name: 'Nollställ tomtescener' }).click();
  await expect(panel.locator('.dev-tomte-item.is-current')).not.toContainText('sedd');
  expect(await page.evaluate(() => localStorage.getItem('advent.tomte.scenesSeen'))).toBeNull();
});

test('Tomten works offline after the first visit', async ({ page, context }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-11-29'));
  await gotoApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.clock.setFixedTime(at('2026-11-30'));
  await page.reload();
  await expect(bubbleText(page)).toHaveText('Ho ho ho! God måndag, Elin.');
});

test('resuming on a new day shows that day\'s scene, after a conversation left open', async ({ page }) => {
  await markSeen(page);
  await page.clock.setFixedTime(at('2026-11-30'));
  await gotoApp(page);
  await expect(bubbleText(page)).toHaveText('Ho ho ho! God måndag, Elin.');

  // The app sat in the background for days with Tomten still open, then comes back.
  await page.clock.setFixedTime(at('2026-12-03'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  await expect(bubbleText(page)).toHaveText('Ho ho ho! God måndag, Elin.');
  await tomte(page).getByRole('button', { name: 'Stäng' }).click();
  await expect(bubbleText(page)).toHaveText('Hej igen, Elin! Jag har en snabb koll inför julen.');
});

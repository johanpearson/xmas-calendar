// Sound (milestone 9): the wiring, not the sound itself (that is tested by ear).
// AudioContext is wrapped so the tests can see when it is created, its state and how
// many oscillators have been started.
import { test, expect } from '@playwright/test';
import { skipTomte } from './helpers.js';

const at = (date) => new Date(`${date}T10:00:00+01:00`);

async function spyOnAudio(page) {
  await page.addInitScript(() => {
    const spy = { contexts: [], oscillators: 0 };
    window.__audio = spy;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor(...args) {
        super(...args);
        spy.contexts.push(this);
      }
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (...a) => {
          spy.oscillators++;
          return start(...a);
        };
        return osc;
      }
    };
  });
}

const audio = (page) =>
  page.evaluate(() => ({
    contexts: window.__audio.contexts.length,
    state: window.__audio.contexts[0]?.state ?? null,
    oscillators: window.__audio.oscillators,
  }));

// Collects uncaught errors and console errors.
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  return errors;
}

async function gotoApp(page) {
  await page.goto('./');
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

const header = (page) => page.locator('.audio-controls');
const tomte = (page) => page.locator('dialog.tomte');

test('no sound before the first tap; the intro\'s first "Nästa" starts the jingle', async ({ page }) => {
  const errors = watchErrors(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(tomte(page)).toBeVisible();
  await page.waitForTimeout(800); // Tomten's entrance has happened, silently
  expect(await audio(page)).toEqual({ contexts: 0, state: null, oscillators: 0 });

  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  const after = await audio(page);
  expect(after.contexts).toBe(1);
  expect(after.oscillators).toBeGreaterThan(60); // the click and the whole jingle
  expect(errors).toEqual([]);
});

test('sound buttons: on by default, music off, in sync with Tomten, saved', async ({ page }) => {
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  const speaker = header(page).getByRole('button', { name: 'Ljud' });
  const music = header(page).getByRole('button', { name: 'Musik', exact: true });
  const bubbleSpeaker = tomte(page).getByRole('button', { name: 'Ljud' });
  await expect(speaker).toHaveAttribute('aria-pressed', 'true');
  await expect(music).not.toHaveClass(/is-on/);
  await expect(bubbleSpeaker).toHaveAttribute('aria-pressed', 'true');

  await bubbleSpeaker.click();
  await expect(bubbleSpeaker).toHaveAttribute('aria-pressed', 'false');
  await expect(speaker).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('advent.sound'))).toBe('off');
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');

  // Muted from the start: taps create no AudioContext at all.
  await page.reload();
  await expect(header(page).getByRole('button', { name: 'Ljud' })).toHaveAttribute('aria-pressed', 'false');
  await expect(tomte(page)).toBeHidden(); // the intro has been seen
  await page.locator('#grid .door').first().click();
  await page.keyboard.press('Enter');
  expect((await audio(page)).contexts).toBe(0);
});

test('sound off is silent: tapping a locked door starts nothing', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  const locked = page.locator('.door[data-date="2026-12-06"]');

  await locked.click(); // first tap: unlocks audio and plays the "tonk"
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  const tonk = (await audio(page)).oscillators;
  expect(tonk).toBeGreaterThan(0);

  await header(page).getByRole('button', { name: 'Ljud' }).click();
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
  await locked.click();
  await page.waitForTimeout(100);
  expect((await audio(page)).oscillators).toBe(tonk);
});

test('opening a door plays its sound', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  await header(page).getByRole('button', { name: 'Ljud' }).click(); // off
  await header(page).getByRole('button', { name: 'Ljud' }).click(); // on again: a click
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  const before = (await audio(page)).oscillators;
  await page.locator('.door[data-date="2026-12-05"]').click();
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(before + 2);
});

test('a door with "music" plays its theme song, one without does not', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } }); // unlocks audio, silently
  await expect.poll(async () => (await audio(page)).state).toBe('running');

  // 3 December has no music: only its sound.
  let before = (await audio(page)).oscillators;
  await page.locator('.door[data-date="2026-12-03"]').click();
  await page.waitForTimeout(1500);
  const effectOnly = (await audio(page)).oscillators - before;
  expect(effectOnly).toBeGreaterThan(2);
  expect(effectOnly).toBeLessThan(30);
  await page.keyboard.press('Escape');

  // 1:a advent has "tusen-juleljus": its sound and a whole song.
  before = (await audio(page)).oscillators;
  await page.locator('.door[data-date="2026-11-29"]').click();
  // The first eight bars on the celesta with their bass: about 60 oscillators.
  await expect.poll(async () => (await audio(page)).oscillators - before).toBeGreaterThan(45);
});

test('music menu: off by default, Blandat starts it, a hidden page suspends it', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  const music = header(page).getByRole('button', { name: 'Musik', exact: true });
  const menu = page.locator('#music-menu');
  await expect(menu).toBeHidden();
  await music.click();
  await expect(music).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.music-now')).toHaveText('Ingen musik');
  await expect(menu.getByRole('button', { name: 'Av' })).toHaveAttribute('aria-pressed', 'true');
  await expect(menu.getByRole('button', { name: 'Nästa låt' })).toBeDisabled();
  // Av, Blandat and the seven songs.
  await expect(menu.locator('.music-option')).toHaveCount(9);

  await menu.getByRole('button', { name: 'Blandat' }).click();
  await expect(music).toHaveClass(/is-on/);
  await expect(menu.getByRole('button', { name: 'Blandat' })).toHaveAttribute('aria-pressed', 'true');
  await expect(menu.locator('.music-now')).toHaveText(/^Nu spelas: /);
  // Before Lucia the mix never plays Santa Lucia.
  await expect(menu.locator('.music-now')).not.toHaveText('Nu spelas: Santa Lucia');
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(40);
  expect(await page.evaluate(() => localStorage.getItem('advent.music'))).toBe('mix');

  // "Nästa låt" picks another song.
  const first = await menu.locator('.music-now').textContent();
  await menu.getByRole('button', { name: 'Nästa låt' }).click();
  await expect(menu.locator('.music-now')).not.toHaveText(first);
  await expect(menu.locator('.music-now')).toHaveText(/^Nu spelas: /);

  // A tap outside closes the menu; Escape too.
  await page.locator('#title').click();
  await expect(menu).toBeHidden();
  await music.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(music).toBeFocused();

  // Pretend the app went to the background, then came back.
  const setVisibility = (state) =>
    page.evaluate((state) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
  await setVisibility('visible');
  await expect.poll(async () => (await audio(page)).state).toBe('running');
});

test('music menu: the background music pauses for a door\'s theme song', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  const music = header(page).getByRole('button', { name: 'Musik', exact: true });
  const now = page.locator('#music-menu .music-now');
  await music.click();
  await page.locator('#music-menu').getByRole('button', { name: 'Jingle Bells' }).click();
  await expect(now).toHaveText('Nu spelas: Jingle Bells');
  await page.keyboard.press('Escape');

  // 1:a advent has its own song: the background music waits for it.
  await page.locator('.door[data-date="2026-11-29"]').click();
  await expect(now).toHaveText('Musiken är pausad en stund');
  await expect(music).toHaveClass(/is-on/); // still chosen, just waiting
});

test('music menu: one song, saved, "Nästa låt" goes down the list, Av stops it', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  const music = header(page).getByRole('button', { name: 'Musik', exact: true });
  const menu = page.locator('#music-menu');
  await music.click();
  await menu.getByRole('button', { name: 'Stilla natt' }).click();
  await expect(menu.locator('.music-now')).toHaveText('Nu spelas: Stilla natt');
  expect(await page.evaluate(() => localStorage.getItem('advent.music'))).toBe('stilla-natt');
  await menu.getByRole('button', { name: 'Nästa låt' }).click();
  await expect(menu.locator('.music-now')).toHaveText('Nu spelas: Santa Lucia');
  await expect(menu.getByRole('button', { name: 'Santa Lucia' })).toHaveAttribute('aria-pressed', 'true');

  // Saved: after a reload the choice is still there (it starts on the first tap).
  await page.reload();
  await music.click();
  await expect(menu.getByRole('button', { name: 'Santa Lucia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(menu.locator('.music-now')).toHaveText('Nu spelas: Santa Lucia');
  await menu.getByRole('button', { name: 'Av' }).click();
  await expect(menu.locator('.music-now')).toHaveText('Ingen musik');
  await expect(music).not.toHaveClass(/is-on/);
  expect(await page.evaluate(() => localStorage.getItem('advent.music'))).toBe('off');
});

test('music menu: the old saved "on" means Blandat', async ({ page }) => {
  await skipTomte(page);
  await page.addInitScript(() => localStorage.setItem('advent.music', 'on'));
  await page.clock.setFixedTime(at('2026-12-05'));
  await gotoApp(page);
  await header(page).getByRole('button', { name: 'Musik', exact: true }).click();
  await expect(page.locator('#music-menu').getByRole('button', { name: 'Blandat' })).toHaveAttribute('aria-pressed', 'true');
});

test('without Web Audio: no sound buttons and no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });
  await page.clock.setFixedTime(at('2026-10-14'));
  await gotoApp(page);
  await expect(tomte(page)).toBeVisible();
  await tomte(page).getByRole('button', { name: 'Nästa' }).click();
  await expect(page.locator('.audio-btn')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('dev panel: every melody and effect with "Spela", who uses it, all effects in a row', async ({ page }) => {
  await skipTomte(page);
  await spyOnAudio(page);
  await page.clock.setFixedTime(at('2026-12-05'));
  await page.goto('./?dev=on');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const panel = page.locator('#dev-panel');
  await panel.getByRole('button', { name: 'Testa jingle' }).click();
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(60);

  await panel.getByText('Melodier (7)').click();
  const lucia = panel.locator('.dev-sound-item', { hasText: 'santa-lucia' });
  await expect(lucia).toContainText('Används av: Lucka 13, 3:e advent');
  await expect(lucia).toContainText('I Blandat från 12-13');
  let before = (await audio(page)).oscillators;
  await panel.getByRole('button', { name: 'Spela Stilla natt' }).click();
  await expect.poll(async () => (await audio(page)).oscillators - before).toBeGreaterThan(150); // the whole song, not just its theme (about 60)
  await panel.getByRole('button', { name: 'Stoppa melodi' }).click();

  await panel.getByText(/^Effekter \(\d+\)$/).click();
  await expect(panel.locator('.dev-sound-item', { hasText: 'Katt som jamar' })).toContainText('Används av: Lucka 4');
  await expect(panel.locator('.dev-sound-item', { hasText: 'Fanfar' })).toContainText('Lucka 5 (standard)');
  await expect(panel.locator('.dev-sound-item', { hasText: 'Lucka som öppnas igen' })).toContainText('Används inte av någon lucka');
  before = (await audio(page)).oscillators;
  await panel.getByRole('button', { name: 'Spela Mjukt ding' }).click();
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(before);

  await panel.getByRole('button', { name: 'Spela alla effekter i följd' }).click();
  await expect(page.locator('#toast')).toHaveText('Bjällror');
});

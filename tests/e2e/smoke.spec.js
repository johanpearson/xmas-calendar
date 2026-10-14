// Smoke tests against the real app, served under /xmas-calendar/ like on GitHub Pages.
import { test, expect, devices } from '@playwright/test';
import { skipTomte } from './helpers.js';

// Mid-morning local time, so the date is the same in every time zone offset we care about.
const NOW = new Date('2026-12-05T10:00:00+01:00');

const door = (page, date) => page.locator(`.door[data-date="${date}"]`);

async function gotoApp(page, path = './') {
  await page.goto(path);
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

// Waits until the service worker is active and controls the page.
async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
}

test.beforeEach(async ({ page }) => {
  // Fixes Date only; timers keep running so animations and toasts behave normally.
  await page.clock.setFixedTime(NOW);
  await skipTomte(page);
});

test('on 2026-12-05 doors up to the 5th open and the 6th is locked', async ({ page }) => {
  await gotoApp(page);
  const card = page.locator('#card');

  for (const date of ['2026-11-29', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05']) {
    await door(page, date).click();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Stäng' }).click();
    await expect(card).toBeHidden();
    await expect(door(page, date)).toHaveClass(/is-opened/);
  }

  await expect(door(page, '2026-12-05')).toHaveClass(/is-today/);

  const sixth = door(page, '2026-12-06');
  await expect(sixth).toHaveClass(/is-locked/);
  await expect(sixth).toHaveAttribute('aria-label', /låst, öppnas 6 december/);
  await sixth.click();
  await expect(page.locator('#toast')).toHaveText('Den här luckan öppnas 6 december');
  await expect(card).toBeHidden();
  await expect(door(page, '2026-12-24')).toHaveClass(/is-locked/);
});

test('an opened door stays opened after reload', async ({ page }) => {
  await gotoApp(page);
  await door(page, '2026-12-03').click();
  await expect(page.locator('#card')).toBeVisible();

  await page.reload();
  await expect(door(page, '2026-12-03')).toHaveClass(/is-opened/);
  await expect(door(page, '2026-12-03')).toHaveAttribute('aria-label', /öppnad/);
  await expect(door(page, '2026-12-04')).not.toHaveClass(/is-opened/);
});

test('the app loads offline after the first visit', async ({ page, context }) => {
  await gotoApp(page);
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#grid .door')).toHaveCount(24);
  await expect(page.locator('#special .door')).toHaveCount(1);
  await expect(page.locator('#error')).toBeHidden();
  await expect(door(page, '2026-12-06')).toHaveClass(/is-locked/);

  // A fresh navigation (not just a reload) works offline too.
  await page.goto('./?dev=off');
  await expect(page.locator('#grid .door')).toHaveCount(24);
});

test('the manifest is valid and its icons exist', async ({ page, request }) => {
  await gotoApp(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('./manifest.webmanifest');

  const res = await request.get(href);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('manifest+json');
  const manifest = await res.json();

  expect(manifest).toMatchObject({
    short_name: 'Advent',
    start_url: './',
    scope: './',
    display: 'standalone',
    lang: 'sv',
  });
  expect(manifest.name).toBeTruthy();
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);

  const has = (sizes, purpose) => manifest.icons.some((i) => i.sizes === sizes && i.purpose.split(' ').includes(purpose));
  expect(has('192x192', 'any')).toBe(true);
  expect(has('512x512', 'any')).toBe(true);
  expect(has('512x512', 'maskable')).toBe(true);

  const icons = [...manifest.icons.map((i) => i.src), 'icons/apple-touch-icon-180.png', 'icons/favicon.svg'];
  for (const src of icons) {
    expect(src.startsWith('/'), `${src} must be relative`).toBe(false);
    const icon = await request.get(src);
    expect(icon.ok(), src).toBe(true);
  }
  // Icon dimensions match what the manifest says.
  for (const { src, sizes } of manifest.icons) {
    const size = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, src);
    expect(size, src).toBe(sizes);
  }

  // Chrome's own installability check (the criteria Lighthouse uses).
  await waitForServiceWorker(page);
  await page.reload();
  const cdp = await page.context().newCDPSession(page);
  const { errors } = await cdp.send('Page.getAppManifest');
  expect(errors).toEqual([]);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('every request stays inside the site folder (no root-absolute paths)', async ({ page }) => {
  const outside = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname === 'localhost' && !url.pathname.startsWith('/xmas-calendar/')) outside.push(url.pathname);
  });
  await gotoApp(page, './?dev=on');
  await waitForServiceWorker(page);
  await expect(page.locator('.dev-toggle')).toBeVisible();
  await page.reload();
  await expect(page.locator('#grid .door').first()).toBeVisible();
  expect(outside).toEqual([]);
});

test('Android: Installera button appears on beforeinstallprompt', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.install-btn')).toHaveCount(0);

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => { window.__prompted = true; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  const btn = page.getByRole('button', { name: 'Installera appen på hemskärmen' });
  await expect(btn).toBeVisible();
  await btn.click();
  expect(await page.evaluate(() => window.__prompted)).toBe(true);
  await expect(btn).toHaveCount(0);
});

test.describe('iOS Safari', () => {
  test.use({ userAgent: devices['iPhone 13'].userAgent });

  test('shows the Add to Home Screen hint once', async ({ page }) => {
    await gotoApp(page);
    const hint = page.locator('.install-hint');
    await expect(hint).toContainText('Lägg till på hemskärmen');
    await hint.getByRole('button', { name: 'Okej' }).click();
    await expect(hint).toHaveCount(0);

    await page.reload();
    await expect(page.locator('#grid .door').first()).toBeVisible();
    await expect(hint).toHaveCount(0);
  });
});

test('no install hint on Android Chrome', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.install-hint')).toHaveCount(0);
});

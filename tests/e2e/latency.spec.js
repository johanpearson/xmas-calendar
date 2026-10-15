// Sound latency (milestone 14) with a mocked AudioContext: the door's sound is started
// in its pointerdown (not on click), before the opening animation is drawn, and a slow
// forecast (Open-Meteo, mocked, on 2026-12-20) holds up neither. Nothing here reaches
// the real api.open-meteo.com, and nothing is really heard.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const tomte = JSON.parse(readFileSync(new URL('../../content/tomte.json', import.meta.url), 'utf8'));

// A fake AudioContext that records every started source (oscillator or buffer) with the
// event being handled at that moment (window.event) and a sequence number shared with
// the moment the opening animation's overlay (.fx) enters the DOM. No OfflineAudioContext:
// every effect takes the live path, which builds on this context.
async function mockAudio(page) {
  await page.addInitScript(() => {
    const log = { seq: 0, starts: [], overlays: [], contexts: 0, resumes: 0 };
    window.__latency = log;
    const param = () => ({
      value: 1,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
      setTargetAtTime() {},
    });
    const node = (ctx, kind) => ({
      kind,
      gain: param(),
      frequency: param(),
      Q: param(),
      pan: param(),
      playbackRate: param(),
      detune: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      buffer: null,
      loop: false,
      type: 'sine',
      onended: null,
      connect: (dest) => dest,
      disconnect() {},
      start(when = 0) {
        if (kind === 'source' && this.buffer?.length <= 1) return; // the wake-up blip
        log.starts.push({ seq: log.seq++, kind, when, now: ctx.currentTime, at: performance.now(), event: window.event?.type ?? null });
      },
      stop() {},
    });
    class FakeAudioContext {
      constructor(options) {
        log.contexts++;
        log.latencyHint = options?.latencyHint ?? null;
        this.state = 'suspended';
        this.sampleRate = 48000;
        this.baseLatency = 0.01;
        this.outputLatency = 0.02;
        this.destination = node(this, 'destination');
        this.created = performance.now();
      }
      get currentTime() {
        return (performance.now() - this.created) / 1000;
      }
      resume() {
        log.resumes++;
        this.state = 'running';
        return Promise.resolve();
      }
      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }
      addEventListener() {}
      createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { length, sampleRate, numberOfChannels: channels, duration: length / sampleRate, getChannelData: (c) => data[c] };
      }
    }
    for (const kind of ['Gain', 'DynamicsCompressor', 'BufferSource', 'Oscillator', 'BiquadFilter', 'StereoPanner']) {
      FakeAudioContext.prototype[`create${kind}`] = function () {
        return node(this, kind === 'BufferSource' ? 'source' : kind.toLowerCase());
      };
    }
    window.AudioContext = FakeAudioContext;
    delete window.webkitAudioContext;
    delete window.OfflineAudioContext;
    delete window.webkitOfflineAudioContext;
    // When the opening animation's overlay is added: that is the heavy drawing.
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) if (n.classList?.contains('fx')) log.overlays.push({ seq: log.seq++, at: performance.now() });
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

const audioLog = (page) => page.evaluate(() => window.__latency);

async function start(page, date) {
  await page.addInitScript((ids) => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
    localStorage.setItem('advent.tomte.scenesSeen', JSON.stringify(ids));
    localStorage.setItem('advent.iosHintDismissed', '1');
  }, tomte.scenes.map((s) => s.id));
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+01:00`));
  await page.goto('./');
  await expect(page.locator('#grid .door').first()).toBeVisible();
}

// Presses a door like a finger: down, hold, then up. Returns the log taken while still down.
async function pressDoor(page, date, holdMs = 150) {
  const door = page.locator(`.door[data-date="${date}"]`);
  await door.scrollIntoViewIfNeeded();
  const box = await door.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  const whileDown = await audioLog(page);
  await page.mouse.up();
  return whileDown;
}

test.beforeEach(async ({ page }) => {
  await mockAudio(page);
});

test('the AudioContext is made on the first pointerdown anywhere, with latencyHint "interactive"', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await start(page, '2026-12-05');
  expect((await audioLog(page)).contexts).toBe(0);
  const title = await page.locator('#title').boundingBox();
  await page.mouse.move(title.x + 5, title.y + 5);
  await page.mouse.down();
  const log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.latencyHint).toBe('interactive');
  await page.mouse.up();
});

test('sfx.play runs in the pointerdown, before the opening animation is drawn', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await start(page, '2026-12-05');
  const log = await pressDoor(page, '2026-12-05');
  // While the finger is still down, the sound has started, from inside the pointerdown.
  expect(log.starts.length).toBeGreaterThan(0);
  const first = log.starts[0];
  expect(first.event).toBe('pointerdown');
  // A hair ahead on the audio clock (the lookahead, plus about one frame for the sync).
  expect(first.when - first.now).toBeGreaterThan(0);
  expect(first.when - first.now).toBeLessThan(0.05);
  // The overlay came after the sound was scheduled, in a later frame.
  expect(log.overlays.length).toBe(1);
  expect(log.overlays[0].seq).toBeGreaterThan(first.seq);
  expect(log.overlays[0].at).toBeGreaterThanOrEqual(first.at);
  // The click that follows the tap neither opens the door again nor plays anything.
  await expect(page.locator('#card')).toBeVisible();
  const after = await audioLog(page);
  expect(after.starts.filter((s) => s.event === 'click')).toEqual([]);
  expect(after.overlays.length).toBe(1);
});

test('2026-12-20: a slow forecast holds up neither the sound nor the animation', async ({ page }) => {
  let answered = false;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    answered = true;
    await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }).catch(() => {});
  });
  await start(page, '2026-12-20');
  const down = performance.now();
  const log = await pressDoor(page, '2026-12-20', 300);
  expect(answered).toBe(false);
  expect(log.starts[0]?.event).toBe('pointerdown'); // the bells, before anything else
  expect(log.overlays.length).toBe(1); // the animation is already running
  expect(log.overlays[0].seq).toBeGreaterThan(log.starts[0].seq);
  // The card comes once the animation is over, still long before the forecast.
  await expect(page.locator('#card')).toBeVisible({ timeout: 3000 });
  expect(answered).toBe(false);
  expect(performance.now() - down).toBeLessThan(4500);
});

test('Enter on a focused door still opens it, with its sound', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await start(page, '2026-12-05');
  await page.locator('#title').click(); // a first gesture for the audio
  await page.locator('.door[data-date="2026-12-04"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#card')).toBeVisible();
  const log = await audioLog(page);
  expect(log.starts.some((s) => s.event === 'click')).toBe(true); // a keyboard click opens the door
});

test('a tap that becomes a scroll (pointercancel) does not open the door', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await start(page, '2026-12-05');
  await page.locator('.door[data-date="2026-12-05"]').evaluate((door) => {
    const init = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
    door.dispatchEvent(new PointerEvent('pointerdown', init));
    setTimeout(() => door.dispatchEvent(new PointerEvent('pointercancel', init)), 80);
  });
  await page.waitForTimeout(1600); // longer than the opening animation
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('.fx')).toHaveCount(0);
  await expect(page.locator('.door[data-date="2026-12-05"]')).not.toHaveClass(/is-opened/);
  expect(await page.evaluate(() => localStorage.getItem('advent.opened'))).toBeNull();
});

// The door opens on pointerdown, so a finger lifted after the overlay is drawn sends the
// tap's click to the overlay. That click must not skip the animation; a new tap does.
test('the click of the opening tap does not skip the animation, a second tap does', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 780 } });
  const page = await context.newPage();
  await mockAudio(page);
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await start(page, '2026-12-05');
  const door = page.locator('.door[data-date="2026-12-05"]');
  await door.scrollIntoViewIfNeeded();
  const box = await door.boundingBox();
  const cdp = await context.newCDPSession(page);
  const tap = async (holdMs) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await tap(150); // a normal tap, long enough for the overlay to be under the finger
  await page.waitForTimeout(200);
  await expect(page.locator('.fx')).toHaveCount(1);
  await expect(page.locator('#card')).toBeHidden();
  await tap(50);
  await expect(page.locator('.fx')).toHaveCount(0);
  await expect(page.locator('#card')).toBeVisible();
  await context.close();
});

test('dev panel: "Ljudlatens" lists each press, and every effect can be tested with its offset', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await page.addInitScript(() => localStorage.setItem('advent.dev', 'on'));
  await start(page, '2026-12-05');
  await pressDoor(page, '2026-12-05');
  await expect(page.locator('#card')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Öppna dev-panelen' }).click();
  const section = page.locator('.dev-latency');
  await expect(section.locator('legend')).toHaveText('Ljudlatens');
  const row = section.locator('tbody tr').first();
  await expect(row.locator('td').nth(0)).toHaveText('2026-12-05');
  await expect(row.locator('td').nth(1)).toHaveText('sneak (live)');
  await expect(row.locator('td').nth(2)).toHaveText(/^\d+ ms$/); // sfx.play
  await expect(row.locator('td').nth(6)).toHaveText(/^\d+ ms$/); // the first frame

  await section.getByText('Testa ljud med aktuell offset').click();
  const test = section.getByRole('button', { name: 'Testa Popcorn med aktuell offset' });
  await expect(section.locator('.dev-offset-item', { hasText: 'popcorn' })).toContainText('offset 0 ms');
  const before = (await audioLog(page)).starts.length;
  await test.click();
  await expect.poll(async () => (await audioLog(page)).starts.length).toBeGreaterThan(before);
  await expect(row.locator('td').nth(0)).toHaveText('test popcorn');
});

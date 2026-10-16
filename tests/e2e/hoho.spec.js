// Tomten's own "ho ho ho" (milestone 15) with a mocked AudioContext: the recording is
// played when it exists and can be decoded, the synthesis when it is missing or cannot be
// decoded (without an error), and the page works offline without the file.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';

// Page routes do not see the service worker's own requests: it is blocked, except in the offline test.
test.use({ serviceWorkers: 'block' });

const at = (date) => new Date(`${date}T10:00:00+01:00`);

// A fake AudioContext. Every started source is logged with its buffer's tag ("ho" for the
// decoded recording) and every oscillator with its type (the synthesis is the only
// sawtooth in the intro). decodeAudioData rejects data shorter than 1000 bytes.
async function mockAudio(page) {
  await page.addInitScript(() => {
    const log = { starts: [], decoded: 0 };
    window.__ho = log;
    const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
    const node = (kind) => ({
      kind,
      gain: param(), frequency: param(), Q: param(), pan: param(), playbackRate: param(), detune: param(),
      threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      buffer: null, loop: false, type: 'sine', onended: null,
      connect: (dest) => dest,
      disconnect() {},
      start(when = 0) {
        if (kind === 'source' && this.buffer?.length <= 1) return; // the wake-up blip
        log.starts.push({ kind, tag: this.buffer?.tag ?? null, type: this.type, when });
      },
      stop() {},
    });
    class FakeAudioContext {
      constructor() {
        this.state = 'suspended';
        this.sampleRate = 48000;
        this.baseLatency = 0.01;
        this.outputLatency = 0.02;
        this.destination = node('destination');
        this.created = performance.now();
      }
      get currentTime() {
        return (performance.now() - this.created) / 1000;
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }
      addEventListener() {}
      decodeAudioData(data) {
        if (data.byteLength < 1000) return Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError'));
        log.decoded++;
        return Promise.resolve({ tag: 'ho', length: 61000, sampleRate: 44100, duration: 1.4, numberOfChannels: 1, getChannelData: () => new Float32Array(8) });
      }
      createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { length, sampleRate, numberOfChannels: channels, duration: length / sampleRate, getChannelData: (c) => data[c] };
      }
    }
    for (const kind of ['Gain', 'DynamicsCompressor', 'BufferSource', 'Oscillator', 'BiquadFilter', 'StereoPanner']) {
      FakeAudioContext.prototype[`create${kind}`] = function () {
        return node(kind === 'BufferSource' ? 'source' : kind.toLowerCase());
      };
    }
    window.AudioContext = FakeAudioContext;
    delete window.webkitAudioContext;
    delete window.OfflineAudioContext;
    delete window.webkitOfflineAudioContext;
  });
}

const problems = (page) => {
  const list = [];
  page.on('pageerror', (e) => list.push(String(e)));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/Service Worker registration blocked/.test(m.text()) && list.push(m.text()));
  return list;
};

// A new visitor: Tomten's intro is open, the sound waits for the first tap ("Nästa").
async function openIntro(page) {
  await page.clock.setFixedTime(at('2026-10-14'));
  await page.goto('./');
  await expect(page.locator('dialog.tomte')).toBeVisible();
  expect((await page.evaluate(() => window.__ho)).starts).toEqual([]); // silent before the first tap
}

const tapNext = (page) => page.locator('dialog.tomte').getByRole('button', { name: 'Nästa' }).click();
const startsOf = (page) => page.evaluate(() => window.__ho.starts);

test.beforeEach(async ({ page }) => {
  await mockAudio(page);
});

test('the recording is loaded after the first tap and played when Tomten appears', async ({ page }) => {
  const seen = problems(page);
  await openIntro(page);
  await tapNext(page);
  await expect.poll(async () => (await startsOf(page)).filter((s) => s.tag === 'ho').length).toBe(1);
  const starts = await startsOf(page);
  expect(starts.some((s) => s.type === 'sawtooth')).toBe(false); // not the synthesis as well
  expect(starts.some((s) => s.kind === 'oscillator')).toBe(true); // the jingle is untouched
  expect(seen).toEqual([]);
});

test('the file is requested only after the first tap', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => r.url().endsWith('/audio/sfx/hohoho.mp3') && requests.push(r.url()));
  await openIntro(page);
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
  await tapNext(page);
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toContain('/xmas-calendar/audio/sfx/hohoho.mp3'); // under the site folder
});

test('a missing file: the synthesis plays instead, with no error', async ({ page }) => {
  const seen = problems(page);
  await page.route('**/audio/sfx/hohoho.mp3', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await openIntro(page);
  await tapNext(page);
  await expect.poll(async () => (await startsOf(page)).filter((s) => s.type === 'sawtooth').length).toBeGreaterThan(0);
  expect((await startsOf(page)).filter((s) => s.tag === 'ho')).toEqual([]);
  expect(seen.filter((m) => !/404/.test(m))).toEqual([]); // only the browser's own note about the 404
});

test('a file that cannot be decoded: the synthesis plays instead, with no error', async ({ page }) => {
  const seen = problems(page);
  await page.route('**/audio/sfx/hohoho.mp3', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'not audio' }));
  await openIntro(page);
  await tapNext(page);
  await expect.poll(async () => (await startsOf(page)).filter((s) => s.type === 'sawtooth').length).toBeGreaterThan(0);
  expect((await startsOf(page)).filter((s) => s.tag === 'ho')).toEqual([]);
  expect(seen).toEqual([]);
});

test('the dev panel plays the recording and the synthesis on request', async ({ page }) => {
  await page.clock.setFixedTime(at('2026-12-05'));
  await page.addInitScript(() => {
    localStorage.setItem('advent.tomte.introSeen', '1');
    localStorage.setItem('advent.tomte.welcomeSeen', '1');
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await page.goto('./?dev=on');
  await page.locator('#title').click(); // the first tap: the recording starts loading
  await expect.poll(() => page.evaluate(() => window.__ho.decoded)).toBe(1);
  await page.locator('.dev-toggle').click();
  await page.getByRole('button', { name: 'Spela ho ho ho (fil)' }).click();
  await page.getByRole('button', { name: 'Spela ho ho ho (syntes)' }).click();
  const starts = await startsOf(page);
  expect(starts.filter((s) => s.tag === 'ho')).toHaveLength(1);
  expect(starts.some((s) => s.type === 'sawtooth')).toBe(true);
});

// Offline without the file: a second server that answers 404 for it, so the service
// worker's install must survive the missing file.
test.describe('offline without the recording', () => {
  test.use({ serviceWorkers: 'allow' });
  const PORT = 4175;
  let server;
  test.beforeAll(async () => {
    server = spawn('node', ['tests/e2e/serve.mjs'], { env: { ...process.env, PORT: String(PORT), HIDE: 'audio/sfx/hohoho.mp3' }, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      if (await fetch(`http://localhost:${PORT}/xmas-calendar/`).then((r) => r.ok, () => false)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('the test server did not start');
  });
  test.afterAll(() => server?.kill());

  test('the service worker installs, the page loads offline and Tomten still has a "ho"', async ({ page, context }) => {
    const seen = problems(page);
    const base = `http://localhost:${PORT}/xmas-calendar/`;
    await page.clock.setFixedTime(at('2026-10-14'));
    await page.goto(base);
    await expect(page.locator('#grid .door').first()).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    expect(await page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('advent-shell-')))).toBe(true);
    expect(await page.evaluate(async () => (await caches.match('audio/sfx/hohoho.mp3')) !== undefined)).toBe(false);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#grid .door')).toHaveCount(24);
    await expect(page.locator('dialog.tomte')).toBeVisible();
    await tapNext(page);
    await expect.poll(async () => (await startsOf(page)).filter((s) => s.type === 'sawtooth').length).toBeGreaterThan(0);
    expect((await startsOf(page)).filter((s) => s.tag === 'ho')).toEqual([]);
    expect(seen.filter((m) => !/404|Failed to load resource|net::ERR/.test(m))).toEqual([]);
  });
});

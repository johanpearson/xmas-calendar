// Tomten's own "ho ho ho" (milestone 15): the choice between the recording and the
// synthesis, the fallback when the file is missing, fails or cannot be decoded, the
// level and offset constants, the service worker's optional caching and the file itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { SFX_LEAD_MS, HO_GAIN, HO_URL, SFX_OFFSETS_MS, effectOffsetMs, chooseHo, loadHoBuffer, startEffect } from '../js/audio.js';

const FILE = new URL('../audio/sfx/hohoho.mp3', import.meta.url);
const BUFFER = { duration: 1.4, length: 61000 };
const ok = (data = new ArrayBuffer(8)) => ({ ok: true, arrayBuffer: async () => data });

test('chooseHo: the recording when it is decoded, else the synthesis', () => {
  assert.equal(chooseHo(BUFFER), 'file');
  assert.equal(chooseHo(null), 'synth');
  assert.equal(chooseHo(undefined), 'synth');
});

test('loadHoBuffer: fetches the file and returns the decoded buffer', async () => {
  const urls = [];
  const buffer = await loadHoBuffer({
    fetchFn: async (url) => (urls.push(url), ok()),
    decode: async () => BUFFER,
  });
  assert.equal(buffer, BUFFER);
  assert.deepEqual(urls, [HO_URL]);
});

test('loadHoBuffer: null, quietly, when the file is missing, the fetch fails or the data cannot be decoded', async () => {
  const noise = [];
  const originals = { warn: console.warn, error: console.error };
  console.warn = console.error = (...a) => noise.push(a);
  try {
    const good = async () => BUFFER;
    assert.equal(await loadHoBuffer({ fetchFn: async () => ({ ok: false, status: 404 }), decode: good }), null); // missing
    assert.equal(await loadHoBuffer({ fetchFn: async () => { throw new TypeError('offline'); }, decode: good }), null); // network error
    assert.equal(await loadHoBuffer({ fetchFn: async () => ok(), decode: async () => { throw new Error('EncodingError'); } }), null); // rejects
    assert.equal(await loadHoBuffer({ fetchFn: async () => ok(), decode: () => { throw new Error('sync'); } }), null); // throws
    assert.equal(await loadHoBuffer({ fetchFn: async () => ({ ok: true, arrayBuffer: async () => { throw new Error('cut off'); } }), decode: good }), null);
    assert.equal(await loadHoBuffer({ fetchFn: async () => ok(), decode: async () => undefined }), null);
  } finally {
    Object.assign(console, originals);
  }
  assert.deepEqual(noise, []); // no error message anywhere
});

// A small fake AudioContext, as in latency.test.js.
function fakeContext() {
  const calls = [];
  const node = (kind) => ({
    kind,
    gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
    connect: (dest) => dest,
    disconnect() {},
    start: (t) => calls.push([`${kind}.start`, t]),
    stop() {},
  });
  return { calls, state: 'running', currentTime: 5, createGain: () => node('gain'), createBufferSource: () => node('source') };
}

test('with the recording ready it plays as one buffer source, otherwise the synthesis runs', () => {
  for (const [buffer, source] of [[BUFFER, 'buffer'], [null, 'live']]) {
    const ctx = fakeContext();
    let synthesised = 0;
    const handle = startEffect(ctx, {
      buffer: chooseHo(buffer) === 'file' ? buffer : null,
      dest: { kind: 'fx' },
      offsetMs: effectOffsetMs('ho'),
      live: () => synthesised++,
    });
    assert.equal(handle.source, source);
    assert.equal(ctx.calls.filter(([name]) => name === 'source.start').length, source === 'buffer' ? 1 : 0);
    assert.equal(synthesised, source === 'live' ? 1 : 0);
    // Scheduled on the audio clock with the lookahead and the offset, not with a timer.
    assert.ok(handle.at > 5.005 && handle.at < 5.5, String(handle.at));
  }
});

test('the constants: a gain to adjust, an offset row for "ho", a relative file path', () => {
  assert.ok(HO_GAIN > 0 && HO_GAIN <= 1);
  assert.equal(typeof SFX_OFFSETS_MS.ho, 'number');
  assert.equal(effectOffsetMs('ho'), SFX_LEAD_MS + SFX_OFFSETS_MS.ho);
  assert.ok(HO_URL.endsWith('/audio/sfx/hohoho.mp3'));
  const source = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  assert.match(source, /new URL\('\.\.\/audio\/sfx\/hohoho\.mp3', import\.meta\.url\)/); // relative, never "/audio/..."
});

test('the service worker caches the recording on its own (try/catch), not in addAll', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const shell = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  assert.ok(!shell.includes('hohoho'), 'a missing file would make cache.addAll, and the installation, fail');
  assert.match(sw, /OPTIONAL_FILES = \['audio\/sfx\/hohoho\.mp3'\]/);
  assert.match(sw, /try \{\s*await cache\.add\(/);
});

let hasFfprobe = true;
try {
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
} catch {
  hasFfprobe = false;
}

test('audio/sfx/hohoho.mp3 is mono MP3, at most 3 s and under 60 kB', { skip: !hasFfprobe && 'ffprobe is not installed' }, () => {
  const info = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration', '-of', 'json', FILE.pathname]),
  );
  const [stream] = info.streams;
  assert.equal(stream.codec_name, 'mp3');
  assert.equal(stream.channels, 1);
  assert.equal(stream.sample_rate, '44100');
  assert.ok(Number(info.format.duration) > 0.5 && Number(info.format.duration) <= 3, info.format.duration);
  assert.ok(statSync(FILE).size < 60 * 1024, `${statSync(FILE).size} bytes`);
});

test('audio/sfx/hohoho.mp3 does not clip: the peak is at most -1 dBFS', { skip: !hasFfprobe && 'ffprobe is not installed' }, () => {
  const log = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i '${FILE.pathname}' -af volumedetect -f null - 2>&1`]).toString();
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(log)[1]);
  assert.ok(peak <= -1, `peak ${peak} dB`);
});

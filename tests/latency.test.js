// Sound latency (milestone 14): the scheduling in js/audio.js (lookahead, never awaiting
// a running context, the fallback when a buffer is not ready, the offsets), the
// prerendering order and the dev log in js/latency.js. The AudioContext is a fake that
// records what is called, in order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOKAHEAD,
  DUCK_RAMP,
  ANIMATION_FRAME_MS,
  SFX_LEAD_MS,
  SFX_OFFSETS_MS,
  EFFECTS,
  effectOffsetMs,
  effectDelay,
  effectStartTime,
  outputLatencyOf,
  planPlayback,
  startEffect,
  prerenderOrder,
  startupKeys,
  RENDER_RATE,
  RENDER_RATES,
  MAX_THEME_BUFFERS,
} from '../js/audio.js';
import { enableLatencyLog, notePress, noteSfx, noteFrame, latencyEntries, summarize, clearLatency } from '../js/latency.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not close to ${expected}`);

// A fake AudioContext: records every call in `calls`, in order.
function fakeContext({ state = 'running', currentTime = 12.5, baseLatency = 0, outputLatency = 0 } = {}) {
  const calls = [];
  const param = (name) => ({
    value: 1,
    cancelScheduledValues: (t) => calls.push([`${name}.cancel`, t]),
    setValueAtTime: (v, t) => calls.push([`${name}.set`, v, t]),
    linearRampToValueAtTime: (v, t) => calls.push([`${name}.ramp`, v, t]),
  });
  const node = (kind) => ({
    kind,
    gain: param(`${kind}.gain`),
    connect: (dest) => {
      calls.push([`${kind}.connect`, dest?.kind ?? dest]);
      return dest;
    },
    disconnect: () => calls.push([`${kind}.disconnect`]),
    start: (t) => calls.push([`${kind}.start`, t]),
    stop: (t) => calls.push([`${kind}.stop`, t]),
  });
  return {
    calls,
    state,
    currentTime,
    baseLatency,
    outputLatency,
    resume() {
      calls.push(['resume']);
      return new Promise(() => {}); // never settles: nothing may wait for it
    },
    createGain: () => node('gain'),
    createBufferSource: () => node('source'),
  };
}

const dest = { kind: 'fx' };
const ASAP = -1000; // an offset that asks for "as early as possible"

test('effects start a hair ahead on the audio clock: currentTime + 0.005', () => {
  assert.equal(LOOKAHEAD, 0.005);
  close(effectStartTime({ now: 3 }), 3.005);
  close(effectStartTime({ now: 3, delay: 1.1 }), 4.105);
  close(effectStartTime({ now: 3, delay: -2 }), 3.005); // never in the past
});

test('a running context plays at once and is never asked to resume (nothing awaited)', () => {
  const ctx = fakeContext({ state: 'running', currentTime: 12.5 });
  const handle = startEffect(ctx, { buffer: { duration: 1 }, dest, offsetMs: ASAP, live: () => assert.fail('no fallback') });
  // Synchronous: the start is already scheduled when startEffect returns.
  assert.deepEqual(ctx.calls.find(([name]) => name === 'source.start'), ['source.start', 12.505]);
  assert.ok(!ctx.calls.some(([name]) => name === 'resume'));
  assert.equal(handle.source, 'buffer');
  close(handle.at, 12.505);
});

test('a suspended context is asked to resume, but the sound is scheduled without waiting', () => {
  const ctx = fakeContext({ state: 'suspended', currentTime: 0 });
  const handle = startEffect(ctx, { buffer: { duration: 1 }, dest, offsetMs: ASAP, live: () => {} });
  const names = ctx.calls.map(([name]) => name);
  assert.ok(names.includes('resume'));
  assert.ok(names.indexOf('source.start') > names.indexOf('resume')); // resume() never settles, start came anyway
  close(handle.at, LOOKAHEAD); // on the stopped clock: plays as soon as it runs
});

test('without a buffer the effect is synthesised on the spot (the fallback)', () => {
  const ctx = fakeContext();
  const seen = [];
  const handle = startEffect(ctx, { buffer: null, dest, offsetMs: ASAP, live: (out, at) => seen.push([out.kind, at]) });
  assert.equal(handle.source, 'live');
  assert.deepEqual(seen, [['gain', 12.505]]); // into its own gain, at the same time
  assert.ok(!ctx.calls.some(([name]) => name === 'source.start'));
  assert.deepEqual(planPlayback({ state: 'running', hasBuffer: false }), { resume: false, source: 'live' });
  assert.deepEqual(planPlayback({ state: 'running', hasBuffer: true }), { resume: false, source: 'buffer' });
  assert.deepEqual(planPlayback({ state: 'suspended', hasBuffer: true }), { resume: true, source: 'buffer' });
  assert.deepEqual(planPlayback({ state: 'interrupted', hasBuffer: false }), { resume: true, source: 'live' });
});

test('a handle fades its sound out quickly (a tap that became a scroll)', () => {
  const ctx = fakeContext();
  const handle = startEffect(ctx, { buffer: { duration: 1 }, dest, offsetMs: ASAP, live: () => {} });
  handle.stop(0.04);
  assert.deepEqual(ctx.calls.find(([name]) => name === 'gain.gain.ramp'), ['gain.gain.ramp', 0, 12.54]);
  assert.ok(ctx.calls.some(([name]) => name === 'source.stop'));
});

test('offsets: the sound is heard offsetMs after the first frame, minus the output latency', () => {
  // No latency: the first frame plus the offset.
  close(effectDelay({ offsetMs: 0 }), ANIMATION_FRAME_MS / 1000);
  close(effectDelay({ offsetMs: 520 }), (ANIMATION_FRAME_MS + 520) / 1000);
  // A phone's output latency is taken off, so the sound is heard on time.
  close(effectDelay({ offsetMs: 520, latency: 0.04 }), (ANIMATION_FRAME_MS + 520) / 1000 - 0.04);
  // Negative (the sound first) can never go before the tap.
  assert.equal(effectDelay({ offsetMs: -200 }), 0);
  assert.equal(effectDelay({ offsetMs: 0, latency: 0.06 }), 0);
  // An extra delay (the treasure hunt's fanfare) adds to it.
  close(effectDelay({ delay: 1.1, offsetMs: 0, latency: 0.03 }), 1.1 + ANIMATION_FRAME_MS / 1000 - 0.03);
  // Through startEffect: at = currentTime + LOOKAHEAD + that delay.
  const ctx = fakeContext({ currentTime: 2, baseLatency: 0.01, outputLatency: 0.02 });
  close(outputLatencyOf(ctx), 0.03);
  const handle = startEffect(ctx, { buffer: { duration: 1 }, dest, offsetMs: 100, live: () => {} });
  close(handle.at, 2 + LOOKAHEAD + (ANIMATION_FRAME_MS + 100) / 1000 - 0.03);
  assert.equal(outputLatencyOf({}), 0); // browsers that do not report it
});

test('the offset table: one line per effect, SFX_LEAD_MS moves them all', () => {
  assert.deepEqual(Object.keys(SFX_OFFSETS_MS).sort(), [...EFFECTS].sort());
  for (const name of EFFECTS) {
    assert.equal(typeof SFX_OFFSETS_MS[name], 'number', name);
    assert.equal(effectOffsetMs(name), SFX_LEAD_MS + SFX_OFFSETS_MS[name]);
    // About 50 ms from the tap at most, as the milestone asks.
    assert.ok(effectDelay({ offsetMs: effectOffsetMs(name) }) <= 0.05, name);
  }
  assert.equal(effectOffsetMs('unknown'), SFX_LEAD_MS);
});

test('ducking the music is quick: under 100 ms', () => {
  assert.ok(DUCK_RAMP > 0 && DUCK_RAMP < 0.1);
});

const doors = [
  { date: '2026-12-01', effect: 'twinkle', music: null },
  { date: '2026-12-04', effect: 'cat', music: null },
  { date: '2026-12-05', effect: 'sneak', fanfare: true, music: 'deck-the-halls' },
  { date: '2026-12-06', effect: 'bells', music: 'hej-tomtegubbar' },
  { date: '2026-12-12', effect: 'pop', music: 'deck-the-halls' },
];

test("prerendering: today's door first, then the app's sounds, unlocked doors newest first, themes last", () => {
  assert.deepEqual(prerenderOrder(doors, '2026-12-05'), [
    'effect:sneak',
    'effect:fanfare',
    'effect:knock',
    'effect:chime',
    'effect:click',
    'effect:cat',
    'effect:twinkle',
    'effect:sleigh',
    'jingle',
    'theme:deck-the-halls',
  ]);
  // Locked doors are left out; repeated sounds once.
  const late = prerenderOrder(doors, '2026-12-24');
  assert.equal(late[0], 'effect:knock'); // no door today
  assert.equal(new Set(late).size, late.length);
  assert.deepEqual(late.filter((k) => k.startsWith('theme:')), ['theme:deck-the-halls', 'theme:hej-tomtegubbar']);
  assert.ok(late.indexOf('effect:pop') < late.indexOf('effect:bells')); // newest first
  // Before the first tap only today's door's own sounds.
  assert.deepEqual(startupKeys(doors, '2026-12-06'), ['effect:bells']);
  assert.deepEqual(startupKeys(doors, '2026-12-05'), ['effect:sneak', 'effect:fanfare']);
  assert.deepEqual(startupKeys(doors, '2026-12-07'), []);
});

test('prerendering keeps memory down: low sample rates, few theme songs', () => {
  assert.ok(RENDER_RATE <= 24000);
  for (const rate of Object.values(RENDER_RATES)) assert.ok(rate <= 32000);
  assert.ok(MAX_THEME_BUFFERS >= 1 && MAX_THEME_BUFFERS <= 3);
});

test('the dev latency log: one entry per press, in ms from its pointerdown', () => {
  notePress('before', 0); // not recorded while the log is off
  assert.deepEqual(latencyEntries(), []);
  enableLatencyLog();
  notePress('2026-12-05', 1000, { audio: 'running' });
  noteSfx({ name: 'sneak', source: 'buffer', calledAt: 1004, at: 10.02, currentTime: 10, baseLatency: 0.01, outputLatency: 0.03 });
  noteSfx({ name: 'fanfare', source: 'buffer', calledAt: 1005, at: 11.1, currentTime: 10 }); // the first effect of a press counts
  noteFrame(1020);
  const [entry] = latencyEntries();
  assert.equal(entry.effect, 'sneak');
  assert.equal(entry.firstPress, false); // "before" was the first press
  const t = summarize(entry);
  assert.equal(t.sfx, 4);
  assert.equal(t.frame, 20);
  assert.equal(t.heard - t.start, 40); // baseLatency + outputLatency
  assert.equal(t.soundMinusFrame, t.heard - 20);
  clearLatency();
  assert.deepEqual(latencyEntries(), []);
});

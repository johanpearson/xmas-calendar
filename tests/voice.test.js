import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curveAt, renderVoice, hoSpec, catSpec, renderCreak } from '../js/voice.js';

// A repeatable random source, so the renders are the same on every run.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

test('curves ease between their points and hold at the ends', () => {
  const curve = [[0, 100], [1, 200]];
  assert.equal(curveAt(curve, -1), 100);
  assert.equal(curveAt(curve, 0.5), 150);
  assert.equal(curveAt(curve, 2), 200);
  assert.ok(curveAt(curve, 0.1) < 110); // eased, not a straight line
});

// The pitch of a stretch of samples, by autocorrelation: the shortest period whose
// correlation is close to the best (so an octave below never wins).
function pitchOf(data, rate, from, lo, hi) {
  const win = Math.floor(rate * 0.04);
  const start = Math.floor(from * rate);
  const sums = [];
  for (let lag = Math.floor(rate / hi); lag <= Math.floor(rate / lo); lag++) {
    let sum = 0;
    for (let i = 0; i < win; i++) sum += data[start + i] * data[start + i + lag];
    sums.push([lag, sum]);
  }
  const best = Math.max(...sums.map(([, sum]) => sum));
  const [lag] = sums.find(([, sum], i) => sum >= 0.85 * best && sum >= (sums[i + 1]?.[1] ?? -Infinity));
  return rate / lag;
}

for (const [name, render, seconds] of [
  ['ho', (o) => renderVoice(hoSpec(), o), 1.2],
  ['cat', (o) => renderVoice(catSpec(), o), 0.9],
  ['door', (o) => renderCreak(o), 1.05],
]) {
  test(`${name}: finite samples, a peak of 1, under 2 seconds`, () => {
    const data = render({ rate: 22050, random: seeded() });
    assert.equal(data.length, Math.ceil(seconds * 22050));
    assert.ok(seconds < 2);
    let peak = 0;
    for (const v of data) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 1) < 1e-6);
  });
}

test('the cat rises and falls in pitch; "ho ho ho" is deep and falls', () => {
  const rate = 22050;
  const cat = renderVoice(catSpec(), { rate, random: seeded(3) });
  const start = pitchOf(cat, rate, 0.08, 300, 1200);
  const top = pitchOf(cat, rate, 0.32, 300, 1200);
  const end = pitchOf(cat, rate, 0.78, 300, 1200);
  assert.ok(top > start * 1.1 && top > end * 1.2, `cat ${start} -> ${top} -> ${end}`);
  const ho = renderVoice(hoSpec(), { rate, random: seeded(4) });
  const first = pitchOf(ho, rate, 0.12, 60, 300);
  const last = pitchOf(ho, rate, 0.95, 60, 300);
  assert.ok(first < 140 && last < first, `ho ${first} -> ${last}`);
});

test('every render is a little different, like a real voice', () => {
  const a = renderVoice(catSpec(), { rate: 22050, random: seeded(1) });
  const b = renderVoice(catSpec(), { rate: 22050, random: seeded(2) });
  assert.notDeepEqual(a.slice(5000, 5100), b.slice(5000, 5100));
});

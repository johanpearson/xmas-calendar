// Tomten's random lines (milestone 16): the lottery and the validation of content/tomte-random.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRandom, randomProblems, emptyBag, normalizeBag, drawLine, MAX_LINE_LENGTH } from '../js/tomte-random.js';

const json = JSON.parse(readFileSync(new URL('../content/tomte-random.json', import.meta.url), 'utf8'));

// A fake localStorage, so the real storage.js can be used (and "restarted" by re-reading it).
function fakeStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  return data;
}

// --- content/tomte-random.json ---

test('tomte-random.json: lines are unique, non-empty, at most 160 characters and without dashes', () => {
  assert.ok(Array.isArray(json.lines) && json.lines.length > 0);
  assert.deepEqual(randomProblems(json.lines), []);
  for (const line of json.lines) {
    assert.equal(typeof line, 'string');
    assert.notEqual(line.trim(), '');
    assert.ok(line.length <= MAX_LINE_LENGTH, `too long: ${line}`);
    assert.ok(!/[–—]/.test(line), `has a dash: ${line}`);
  }
  assert.equal(new Set(json.lines).size, json.lines.length);
  assert.deepEqual(normalizeRandom(json), json.lines);
});

test('randomProblems finds empty, duplicate, long and dashed lines', () => {
  const problems = randomProblems(['ok', '', 'ok', 'x'.repeat(161), 'a — b', 'a – b']);
  assert.equal(problems.length, 5);
});

test('normalizeRandom: rejects a broken file, drops empty and duplicate lines', () => {
  assert.throws(() => normalizeRandom(null));
  assert.throws(() => normalizeRandom({}));
  assert.throws(() => normalizeRandom({ lines: [] }));
  assert.throws(() => normalizeRandom({ lines: ['', '  ', 7] }));
  assert.deepEqual(normalizeRandom({ lines: [' a ', 'a', '', 'b'] }), ['a', 'b']);
});

// --- the lottery ---

// A deterministic Math.random.
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

test('drawLine: no line repeats until all have been used, round after round', () => {
  const lines = json.lines;
  const rng = seeded(7);
  let bag = emptyBag();
  for (let round = 0; round < 3; round++) {
    const drawn = [];
    for (let i = 0; i < lines.length; i++) {
      const result = drawLine(lines, bag, rng);
      bag = result.bag;
      drawn.push(result.line);
    }
    assert.equal(new Set(drawn).size, lines.length, `round ${round} repeated a line`);
    assert.deepEqual([...drawn].sort(), [...lines].sort());
  }
});

test('drawLine: a new round never starts with the line that ended the last one', () => {
  const lines = ['a', 'b', 'c'];
  for (let seed = 1; seed < 40; seed++) {
    const rng = seeded(seed);
    let bag = emptyBag();
    let previous = null;
    for (let i = 0; i < 12; i++) {
      const result = drawLine(lines, bag, rng);
      assert.notEqual(result.line, previous);
      previous = result.line;
      bag = result.bag;
    }
  }
});

test('drawLine: a single line is allowed to repeat, no lines gives null', () => {
  assert.equal(drawLine(['a'], drawLine(['a']).bag).line, 'a');
  assert.equal(drawLine([]).line, null);
});

test('drawLine: copes with lines added or removed after the bag was saved', () => {
  const first = drawLine(['a', 'b'], emptyBag(), () => 0);
  assert.equal(first.line, 'a');
  // "b" is removed, "c" added: only unused lines are drawn, the removed one is forgotten.
  const next = drawLine(['a', 'c'], first.bag, () => 0);
  assert.equal(next.line, 'c');
  assert.deepEqual(next.bag.used, ['a', 'c']);
});

test('normalizeBag: anything unusable becomes an empty bag', () => {
  assert.deepEqual(normalizeBag(null), emptyBag());
  assert.deepEqual(normalizeBag({ used: 'x' }), emptyBag());
  assert.deepEqual(normalizeBag({ used: ['a', 3], last: 5 }), { used: ['a'], last: null });
});

test('the lottery survives a restart: the bag is read back from localStorage', async () => {
  fakeStorage();
  const storage = await import('../js/storage.js');
  const lines = json.lines;
  const rng = seeded(3);
  const drawn = [];
  for (let i = 0; i < 10; i++) {
    const { line, bag } = drawLine(lines, storage.getRandomBag(), rng);
    storage.setRandomBag(bag); // every draw is saved, as the app does
    drawn.push(line);
  }
  // "Restart": a fresh read of what was saved continues the same round.
  for (let i = 10; i < lines.length; i++) {
    const { line, bag } = drawLine(lines, storage.getRandomBag(), rng);
    storage.setRandomBag(bag);
    drawn.push(line);
  }
  assert.equal(new Set(drawn).size, lines.length);
  storage.clearRandomBag();
  assert.deepEqual(storage.getRandomBag(), emptyBag());
});

test('a broken value in localStorage gives an empty bag, not an error', async () => {
  const data = fakeStorage();
  const storage = await import('../js/storage.js');
  data.set('advent.tomte.randomBag', '{not json');
  assert.deepEqual(storage.getRandomBag(), emptyBag());
  data.set('advent.tomte.randomBag', JSON.stringify([1, 2]));
  assert.deepEqual(storage.getRandomBag(), emptyBag());
});

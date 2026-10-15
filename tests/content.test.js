// Validates content/days.json, so a broken edit fails `npm test` instead of the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidDateKey } from '../js/dates.js';
import { isEffect } from '../js/audio.js';
import { MELODIES } from '../js/melodies.js';

const TYPES = ['ledtrad', 'litet', 'uppdrag', 'rim', 'jakt'];
const raw = readFileSync(new URL('../content/days.json', import.meta.url), 'utf8');

test('days.json is valid JSON with a days array', () => {
  const json = JSON.parse(raw);
  assert.ok(Array.isArray(json.days), '"days" must be an array');
  assert.ok(json.days.length > 0, '"days" must not be empty');
});

const { days } = JSON.parse(raw);

test('every date is a valid YYYY-MM-DD', () => {
  for (const [i, d] of days.entries()) {
    assert.ok(isValidDateKey(d.date), `entry ${i} has an invalid date: ${JSON.stringify(d.date)}`);
  }
});

test('dates are unique and in ascending order', () => {
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1].date;
    const cur = days[i].date;
    assert.notEqual(cur, prev, `duplicate date ${cur}`);
    assert.ok(cur > prev, `${cur} (entry ${i}) comes after ${prev}`);
  }
});

test('ids are unique', () => {
  // Same fallback as normalizeContent() in js/app.js: a missing id becomes d-<date>.
  const ids = days.map((d) => (typeof d.id === 'string' && d.id ? d.id : `d-${d.date}`));
  assert.equal(new Set(ids).size, ids.length);
});

test('type is one of ledtrad, litet, uppdrag, rim or jakt', () => {
  for (const d of days) {
    assert.ok(TYPES.includes(d.type), `${d.date} has an unknown type: ${JSON.stringify(d.type)}`);
  }
});

test('verse is a string when present', () => {
  for (const d of days) {
    if ('verse' in d) assert.equal(typeof d.verse, 'string', `${d.date}: verse must be a string`);
    if (d.alternative && 'verse' in d.alternative) {
      assert.equal(typeof d.alternative.verse, 'string', `${d.date}: alternative.verse must be a string`);
    }
  }
});

test('sound is a known effect and music a known melody, when present', () => {
  for (const d of days) {
    if ('sound' in d) assert.ok(isEffect(d.sound), `${d.date}: unknown sound ${JSON.stringify(d.sound)} (see EFFECTS in js/audio.js)`);
    if ('music' in d) assert.ok(Object.hasOwn(MELODIES, d.music), `${d.date}: unknown music ${JSON.stringify(d.music)} (see js/melodies.js)`);
  }
});

test('scene is a non-empty string when present (used by a later milestone)', () => {
  for (const d of days) {
    if ('scene' in d) assert.ok(typeof d.scene === 'string' && d.scene.length > 0, `${d.date}: scene must be a string`);
  }
});

test('only known fields', () => {
  const FIELDS = ['id', 'date', 'label', 'type', 'title', 'verse', 'body', 'alternative', 'animation', 'sound', 'music', 'scene'];
  for (const d of days) {
    for (const key of Object.keys(d)) assert.ok(FIELDS.includes(key), `${d.date}: unknown field "${key}"`);
  }
});

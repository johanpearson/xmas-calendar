// Validates content/days.json, so a broken edit fails `npm test` instead of the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidDateKey } from '../js/dates.js';

const TYPES = ['ledtrad', 'litet', 'uppdrag', 'rim'];
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
  const ids = days.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('type is one of ledtrad, litet, uppdrag or rim', () => {
  for (const d of days) {
    assert.ok(TYPES.includes(d.type), `${d.date} has an unknown type: ${JSON.stringify(d.type)}`);
  }
});

test('verse is a string when present', () => {
  for (const d of days) {
    if ('verse' in d) assert.equal(typeof d.verse, 'string', `${d.date}: verse must be a string`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  today,
  isUnlocked,
  formatDate,
  toDateKey,
  isValidDateKey,
  parseDateKey,
  dayOfMonth,
  isBeforeDecember,
  msUntilNextMidnight,
  adventSunday,
  isChristmasEve,
} from '../js/dates.js';

const DOOR = '2026-12-06';

test('toDateKey uses local calendar fields and zero pads', () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toDateKey(new Date(2026, 11, 24)), '2026-12-24');
});

test('locked the day before the date', () => {
  const t = today(new Date(2026, 11, 5, 12, 0));
  assert.equal(isUnlocked(DOOR, t), false);
});

test('unlocked on the same day', () => {
  const t = today(new Date(2026, 11, 6, 12, 0));
  assert.equal(isUnlocked(DOOR, t), true);
});

test('unlocked the day after the date', () => {
  const t = today(new Date(2026, 11, 7, 12, 0));
  assert.equal(isUnlocked(DOOR, t), true);
});

test('still locked at 23:59 local time the evening before', () => {
  const t = today(new Date(2026, 11, 5, 23, 59, 59, 999));
  assert.equal(t, '2026-12-05');
  assert.equal(isUnlocked(DOOR, t), false);
});

test('unlocked at 00:00 local time on the day', () => {
  const t = today(new Date(2026, 11, 6, 0, 0, 0, 0));
  assert.equal(t, '2026-12-06');
  assert.equal(isUnlocked(DOOR, t), true);
});

test('override replaces the clock', () => {
  const now = new Date(2026, 9, 13, 9, 0);
  assert.equal(today(now, '2026-12-10'), '2026-12-10');
  assert.equal(isUnlocked(DOOR, today(now, '2026-12-10')), true);
  assert.equal(isUnlocked(DOOR, today(now, '2026-12-01')), false);
});

test('invalid or empty override falls back to the clock', () => {
  const now = new Date(2026, 11, 3, 9, 0);
  assert.equal(today(now, null), '2026-12-03');
  assert.equal(today(now, ''), '2026-12-03');
  assert.equal(today(now, 'nonsense'), '2026-12-03');
  assert.equal(today(now, '2026-02-30'), '2026-12-03');
});

test('everything is unlocked after the last date', () => {
  const t = today(new Date(2027, 0, 2));
  for (const d of ['2026-11-29', '2026-12-01', '2026-12-24']) {
    assert.equal(isUnlocked(d, t), true);
  }
});

test('comparison works across month and year boundaries', () => {
  assert.equal(isUnlocked('2026-12-01', '2026-11-30'), false);
  assert.equal(isUnlocked('2026-11-29', '2026-11-30'), true);
  assert.equal(isUnlocked('2027-01-01', '2026-12-31'), false);
});

test('formatDate gives Swedish day and month', () => {
  assert.equal(formatDate('2026-12-06'), '6 december');
  assert.equal(formatDate('2026-11-29'), '29 november');
});

test('isValidDateKey and parseDateKey', () => {
  assert.equal(isValidDateKey('2026-12-24'), true);
  assert.equal(isValidDateKey('2026-12-32'), false);
  assert.equal(isValidDateKey('2026-1-5'), false);
  assert.equal(isValidDateKey(20261224), false);
  assert.equal(parseDateKey('bad'), null);
  const d = parseDateKey('2026-12-24');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 11, 24, 0]);
});

test('dayOfMonth and isBeforeDecember', () => {
  assert.equal(dayOfMonth('2026-12-06'), 6);
  assert.equal(isBeforeDecember('2026-11-29'), true);
  assert.equal(isBeforeDecember('2026-12-01'), false);
  assert.equal(isBeforeDecember('2027-12-01'), false);
});

test('msUntilNextMidnight', () => {
  assert.equal(msUntilNextMidnight(new Date(2026, 11, 5, 23, 59, 0)), 60_000);
  assert.equal(msUntilNextMidnight(new Date(2026, 11, 5, 0, 0, 0)), 24 * 3600_000);
});

test('adventSunday finds the four advent Sundays of any year', () => {
  const advents = (year) =>
    Array.from({ length: 40 }, (_, i) => toDateKey(new Date(year, 10, 20 + i)))
      .filter((key) => adventSunday(key))
      .map((key) => `${key}:${adventSunday(key)}`);
  assert.deepEqual(advents(2026), ['2026-11-29:1', '2026-12-06:2', '2026-12-13:3', '2026-12-20:4']);
  assert.deepEqual(advents(2027), ['2027-11-28:1', '2027-12-05:2', '2027-12-12:3', '2027-12-19:4']);
  // Christmas Eve on a Sunday is also the fourth advent.
  assert.deepEqual(advents(2023), ['2023-12-03:1', '2023-12-10:2', '2023-12-17:3', '2023-12-24:4']);
  // Christmas Day on a Sunday: the fourth advent is a week earlier.
  assert.deepEqual(advents(2022), ['2022-11-27:1', '2022-12-04:2', '2022-12-11:3', '2022-12-18:4']);
});

test('adventSunday is 0 for other days and invalid keys', () => {
  assert.equal(adventSunday('2026-12-14'), 0);
  assert.equal(adventSunday('2026-11-22'), 0);
  assert.equal(adventSunday('2026-12-27'), 0);
  assert.equal(adventSunday('nope'), 0);
});

test('isChristmasEve', () => {
  assert.equal(isChristmasEve('2026-12-24'), true);
  assert.equal(isChristmasEve('2026-12-23'), false);
});

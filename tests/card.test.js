// js/card.js: the card's paragraphs, plan A or B, and plan B's fallbacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  paragraphs,
  hasAlternative,
  planContent,
  initialChoice,
  withForecast,
  toggled,
  showsWeatherNote,
  toggleLabel,
  waitForForecast,
  FORECAST_WAIT_MS,
  WEATHER_NOTE,
  SHOW_PLAN_A,
  SHOW_PLAN_B,
} from '../js/card.js';

const { days } = JSON.parse(readFileSync(new URL('../content/days.json', import.meta.url), 'utf8'));

// --- Paragraphs ---

test('paragraphs: one per line, trimmed', () => {
  assert.deepEqual(paragraphs('Första\n  Andra  '), [
    { text: 'Första', gapBefore: false },
    { text: 'Andra', gapBefore: false },
  ]);
});

test('paragraphs: a blank line gives the next one extra space instead of disappearing', () => {
  assert.deepEqual(paragraphs('Hälsningar, Tomten\n\nPS. Johan'), [
    { text: 'Hälsningar, Tomten', gapBefore: false },
    { text: 'PS. Johan', gapBefore: true },
  ]);
  // Several blank lines are one gap, and blank lines at the ends give none.
  assert.deepEqual(paragraphs('\n\nA\n\n\n \nB\n\n'), [
    { text: 'A', gapBefore: false },
    { text: 'B', gapBefore: true },
  ]);
});

test('paragraphs: an empty or missing text has none', () => {
  assert.deepEqual(paragraphs(''), []);
  assert.deepEqual(paragraphs('\n \n'), []);
  assert.deepEqual(paragraphs(undefined), []);
});

test('the doors on 8 and 10 December keep their blank line as a gap', () => {
  for (const date of ['2026-12-08', '2026-12-10']) {
    const day = days.find((d) => d.date === date);
    assert.equal(paragraphs(day.body).filter((p) => p.gapBefore).length, 1, date);
  }
});

// --- Plan B content ---

const day = {
  title: 'När fjärde ljuset brinner',
  verse: 'vi hämtar julegran',
  body: 'Mössa och vantar på!',
  alternative: { body: 'Julfilm hemma.' },
};

test('plan B falls back on the door\'s own title and verse', () => {
  assert.deepEqual(planContent(day, 'A'), { title: day.title, verse: day.verse, body: day.body });
  assert.deepEqual(planContent(day, 'B'), { title: day.title, verse: day.verse, body: 'Julfilm hemma.' });
  // Empty texts count as missing.
  const blank = { ...day, alternative: { title: ' ', verse: '', body: 'Julfilm hemma.' } };
  assert.deepEqual(planContent(blank, 'B'), { title: day.title, verse: day.verse, body: 'Julfilm hemma.' });
});

test('plan B uses its own title and verse when it has them', () => {
  const own = { ...day, alternative: { title: 'Plan B', verse: 'Reservvers', body: 'Julfilm hemma.' } };
  assert.deepEqual(planContent(own, 'B'), { title: 'Plan B', verse: 'Reservvers', body: 'Julfilm hemma.' });
});

test('a door without a plan B always shows its main text', () => {
  const plain = { title: 'T', body: 'B' };
  assert.equal(hasAlternative(plain), false);
  assert.equal(hasAlternative({ ...plain, alternative: {} }), false);
  assert.deepEqual(planContent(plain, 'B'), { title: 'T', verse: '', body: 'B' });
  assert.equal(hasAlternative(day), true);
});

test('4th advent in days.json: title and verse are the same in plan A and B', () => {
  const advent4 = days.find((d) => d.date === '2026-12-20');
  assert.ok(hasAlternative(advent4));
  const a = planContent(advent4, 'A');
  const b = planContent(advent4, 'B');
  assert.equal(b.title, a.title);
  assert.equal(b.verse, a.verse);
  assert.notEqual(b.body, a.body);
});

// --- Plan A or B ---

test('before any forecast: plan A, no weather line', () => {
  const choice = initialChoice();
  assert.equal(choice.plan, 'A');
  assert.equal(showsWeatherNote(choice), false);
  assert.equal(toggleLabel(choice), SHOW_PLAN_B);
});

test('"bad" gives plan B with Tomten\'s line and "Visa plan A"', () => {
  const choice = withForecast(initialChoice(), 'bad');
  assert.equal(choice.plan, 'B');
  assert.equal(showsWeatherNote(choice), true);
  assert.equal(toggleLabel(choice), SHOW_PLAN_A);
  assert.equal(SHOW_PLAN_A, 'Visa plan A');
  assert.equal(WEATHER_NOTE, 'Tomten har tittat på vädret och det ser blött eller blåsigt ut, så det blir plan B.');
});

test('"good" and "unknown" give the main text with "Dåligt väder? Visa plan B"', () => {
  for (const variant of ['good', 'unknown', 'nonsense', undefined]) {
    const choice = withForecast(initialChoice(), variant);
    assert.equal(choice.plan, 'A', String(variant));
    assert.equal(showsWeatherNote(choice), false);
    assert.equal(toggleLabel(choice), 'Dåligt väder? Visa plan B');
  }
});

test('switching by hand works both ways, whatever the forecast', () => {
  for (const variant of ['good', 'bad', 'unknown']) {
    let choice = withForecast(initialChoice(), variant);
    const start = choice.plan;
    choice = toggled(choice);
    assert.notEqual(choice.plan, start, variant);
    choice = toggled(choice);
    assert.equal(choice.plan, start, variant);
  }
});

test('Tomten\'s line only while plan B is up because of a bad forecast', () => {
  const bad = withForecast(initialChoice(), 'bad');
  assert.equal(showsWeatherNote(toggled(bad)), false); // back on plan A
  assert.equal(showsWeatherNote(toggled(toggled(bad))), true);
  assert.equal(showsWeatherNote(toggled(withForecast(initialChoice(), 'good'))), false); // B by hand
});

test('timeout: a late "bad" still switches to plan B', () => {
  const late = withForecast(initialChoice(), 'bad');
  assert.equal(late.plan, 'B');
});

test('timeout: a late forecast never moves a plan that was switched by hand', () => {
  // Switched to B by hand, then a late "good": stays on B.
  const toB = withForecast(toggled(initialChoice()), 'good');
  assert.equal(toB.plan, 'B');
  // Switched to B and back to A by hand, then a late "bad": stays on A.
  const backToA = withForecast(toggled(toggled(initialChoice())), 'bad');
  assert.equal(backToA.plan, 'A');
  assert.equal(showsWeatherNote(backToA), false);
});

test('only the first forecast counts', () => {
  const choice = withForecast(withForecast(initialChoice(), 'good'), 'bad');
  assert.equal(choice.plan, 'A');
  assert.equal(choice.variant, 'good');
});

// --- Waiting for the forecast ---

// A fake clock: timers run when tick() is called.
function fakeTimers() {
  const timers = new Map();
  let next = 1;
  return {
    setTimeout: (fn, ms) => {
      timers.set(next, { fn, ms });
      return next++;
    },
    clearTimeout: (id) => timers.delete(id),
    tick() {
      for (const [id, { fn }] of timers) {
        timers.delete(id);
        fn();
      }
    },
    pending: () => [...timers.values()].map((t) => t.ms),
  };
}

test('waitForForecast: the variant when it comes in time', async () => {
  const timers = fakeTimers();
  assert.equal(await waitForForecast(Promise.resolve('bad'), FORECAST_WAIT_MS, timers), 'bad');
  assert.deepEqual(timers.pending(), []); // the timer is cleared
});

test('waitForForecast: null after about 800 ms when the forecast is late', async () => {
  assert.equal(FORECAST_WAIT_MS, 800);
  const timers = fakeTimers();
  const waiting = waitForForecast(new Promise(() => {}), FORECAST_WAIT_MS, timers);
  assert.deepEqual(timers.pending(), [800]);
  timers.tick();
  assert.equal(await waiting, null);
});

test('waitForForecast: real timers, a slow forecast is cut off', async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve('bad'), 200));
  assert.equal(await waitForForecast(slow, 20), null);
});

test('waitForForecast: nothing to wait for, or a failed lookup', async () => {
  assert.equal(await waitForForecast(null), null);
  assert.equal(await waitForForecast(Promise.reject(new Error('offline')), 50), 'unknown');
});

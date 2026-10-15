// Pure logic for the door's card: its paragraphs and whether plan A (the main text) or
// plan B (`alternative`, for bad weather) shows. No DOM: everything here is testable with
// `node --test`. Rendering lives in app.js.

// How long an opening waits for the forecast before the card shows the main text anyway.
export const FORECAST_WAIT_MS = 800;

export const WEATHER_NOTE = 'Tomten har tittat på vädret och det ser blött eller blåsigt ut, så det blir plan B.';
export const SHOW_PLAN_B = 'Dåligt väder? Visa plan B';
export const SHOW_PLAN_A = 'Visa plan A';

const VARIANTS = ['good', 'bad', 'unknown'];
const isText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Plain text to paragraphs, one per line. Blank lines are not paragraphs of their own:
 * they give the next paragraph extra space before it (gapBefore). Leading and trailing
 * blank lines are dropped, so an empty text has no paragraphs at all.
 */
export function paragraphs(text) {
  const result = [];
  let gap = false;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      gap = result.length > 0;
      continue;
    }
    result.push({ text: line, gapBefore: gap });
    gap = false;
  }
  return result;
}

// A door has a plan B when its `alternative` has something to show.
export function hasAlternative(day) {
  const alt = day?.alternative;
  return Boolean(alt && typeof alt === 'object' && (isText(alt.body) || isText(alt.title) || isText(alt.verse)));
}

/**
 * What the card shows for a plan: { title, verse, body }. Plan B takes the alternative's
 * body, and its title and verse when it has them, otherwise the door's own, so title and
 * verse look the same in both plans unless the alternative says otherwise.
 */
export function planContent(day, plan) {
  const main = { title: day?.title ?? '', verse: day?.verse ?? '', body: day?.body ?? '' };
  if (plan !== 'B' || !hasAlternative(day)) return main;
  const alt = day.alternative;
  return {
    title: isText(alt.title) ? alt.title : main.title,
    verse: isText(alt.verse) ? alt.verse : main.verse,
    body: alt.body ?? '',
  };
}

// --- Plan A or B ---
//
// The choice is a small state: { plan: 'A' | 'B', variant, manual }. variant is the
// forecast once it has come (null before), manual is true once the plan was switched by
// hand. Only the first forecast counts, and never after a switch by hand, so the card
// never jumps under someone who already chose.

export function initialChoice() {
  return { plan: 'A', variant: null, manual: false };
}

export function withForecast(choice, variant) {
  if (choice.variant !== null) return choice;
  const known = VARIANTS.includes(variant) ? variant : 'unknown';
  if (choice.manual) return { ...choice, variant: known };
  return { ...choice, variant: known, plan: known === 'bad' ? 'B' : 'A' };
}

export function toggled(choice) {
  return { ...choice, plan: choice.plan === 'A' ? 'B' : 'A', manual: true };
}

// Tomten's line about the weather shows while plan B is up because the forecast is bad.
export function showsWeatherNote(choice) {
  return choice.plan === 'B' && choice.variant === 'bad';
}

export function toggleLabel(choice) {
  return choice.plan === 'B' ? SHOW_PLAN_A : SHOW_PLAN_B;
}

/**
 * Waits for a forecast (a promise of a variant) at most timeoutMs. Resolves to the variant,
 * or null when it hasn't come in time (or there is nothing to wait for). Never rejects.
 */
export function waitForForecast(forecast, timeoutMs = FORECAST_WAIT_MS, { setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout } = {}) {
  if (!forecast) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    Promise.resolve(forecast).then(
      (variant) => {
        clearTimeout(timer);
        resolve(variant);
      },
      () => {
        clearTimeout(timer);
        resolve('unknown');
      },
    );
  });
}

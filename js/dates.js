// Pure date logic. No DOM, no storage: everything here is testable with `node --test`.
//
// Dates are handled as local calendar days in the form "YYYY-MM-DD" (a "date key").
// Never use toISOString() for this: it converts to UTC and gives the wrong day
// near midnight in any time zone other than UTC.

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n) => String(n).padStart(2, '0');

// Returns true for a syntactically valid key that is also a real calendar day.
export function isValidDateKey(key) {
  if (typeof key !== 'string') return false;
  const m = DATE_KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

// Converts a Date to a local date key using the local calendar fields.
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Parses a date key into a Date at local midnight. Returns null for invalid keys.
export function parseDateKey(key) {
  if (!isValidDateKey(key)) return null;
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

// The effective "today" as a date key. A valid override (dev mode) wins over the clock.
export function today(now = new Date(), override = null) {
  if (override && isValidDateKey(override)) return override;
  return toDateKey(now);
}

// A door is unlocked once today has reached its date. Date keys compare correctly as strings.
export function isUnlocked(dateKey, todayKey) {
  return todayKey >= dateKey;
}

// Human friendly Swedish date, e.g. "6 december".
export function formatDate(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' }).format(date);
}

// Day of month as a number, e.g. 6 for "2026-12-06".
export function dayOfMonth(dateKey) {
  return Number(dateKey.slice(8, 10));
}

// Doors dated before December 1st of their own year are shown as special doors above the grid.
export function isBeforeDecember(dateKey) {
  return dateKey.slice(5) < '12-01';
}

// December 24th of any year: the door that looks like a Christmas present.
export function isChristmasEve(dateKey) {
  return dateKey.slice(5) === '12-24';
}

// Milliseconds from `now` until the next local midnight.
export function msUntilNextMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

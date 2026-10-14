// Thin wrapper around localStorage. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the app must still work.

import { isValidDateKey } from './dates.js';

const KEY_OPENED = 'advent.opened';
const KEY_DEV = 'advent.dev';
const KEY_DATE_OVERRIDE = 'advent.dateOverride';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ignore: state simply won't persist.
  }
}

// Set of door ids that have been opened at least once.
export function getOpened() {
  try {
    const list = JSON.parse(read(KEY_OPENED) ?? '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function markOpened(id) {
  markAllOpened([id]);
}

export function markAllOpened(ids) {
  const opened = getOpened();
  for (const id of ids) opened.add(id);
  write(KEY_OPENED, JSON.stringify([...opened]));
}

export function clearOpened() {
  write(KEY_OPENED, null);
}

// --- Dev mode ---

export function isDevEnabled() {
  return read(KEY_DEV) === 'on';
}

// Turning dev mode off also drops the date override so nothing lingers.
export function setDevEnabled(enabled) {
  write(KEY_DEV, enabled ? 'on' : null);
  if (!enabled) write(KEY_DATE_OVERRIDE, null);
}

// Applies ?dev=on / ?dev=off from a URL. Returns true if the URL had a dev parameter.
export function applyDevParam(url) {
  const value = url.searchParams.get('dev');
  if (value === 'on') setDevEnabled(true);
  else if (value === 'off') setDevEnabled(false);
  return value !== null;
}

export function getDateOverride() {
  const value = read(KEY_DATE_OVERRIDE);
  return isValidDateKey(value) ? value : null;
}

export function setDateOverride(dateKey) {
  write(KEY_DATE_OVERRIDE, isValidDateKey(dateKey) ? dateKey : null);
}

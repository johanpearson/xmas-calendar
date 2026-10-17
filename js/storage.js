// Thin wrapper around localStorage. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the app must still work.

import { isValidDateKey } from './dates.js';
import { parseToggle } from './audio.js';
import { parseMusicChoice } from './melodies.js';
import { normalizeBag, emptyBag } from './tomte-random.js';
import { normalizeHistory } from './history.js';

const KEY_OPENED = 'advent.opened';
const KEY_DEV = 'advent.dev';
const KEY_DATE_OVERRIDE = 'advent.dateOverride';
const KEY_TOMTE_INTRO = 'advent.tomte.introSeen';
const KEY_TOMTE_WELCOME = 'advent.tomte.welcomeSeen';
const KEY_TOMTE_SCENES = 'advent.tomte.scenesSeen';
const KEY_TOMTE_ANSWERS = 'advent.tomte.answers';
const KEY_TOMTE_HISTORY = 'advent.tomte.history';
const KEY_TOMTE_BAG = 'advent.tomte.randomBag';
const KEY_SOUND = 'advent.sound';
const KEY_MUSIC = 'advent.music';
const KEY_FORECAST_OVERRIDE = 'advent.dev.forecast';

const FORECAST_OVERRIDES = ['good', 'bad', 'unknown'];

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
  return new Set(readJson(KEY_OPENED, Array.isArray, []));
}

function readJson(key, isValid, fallback) {
  try {
    const value = JSON.parse(read(key));
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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
  if (!enabled) {
    write(KEY_DATE_OVERRIDE, null);
    write(KEY_FORECAST_OVERRIDE, null);
  }
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

// Dev "Prognos": "good", "bad" or "unknown" forces Tomten's weather lines, null means
// the real forecast. Only honoured while dev mode is on.
export function getForecastOverride() {
  const value = read(KEY_FORECAST_OVERRIDE);
  return FORECAST_OVERRIDES.includes(value) ? value : null;
}

export function setForecastOverride(value) {
  write(KEY_FORECAST_OVERRIDE, FORECAST_OVERRIDES.includes(value) ? value : null);
}

// --- Tomten ---

// What Tomten has already shown: intro and welcome have separate flags, scenes are a list of ids.
export function getTomteSeen() {
  return {
    intro: read(KEY_TOMTE_INTRO) === '1',
    welcome: read(KEY_TOMTE_WELCOME) === '1',
    scenes: readJson(KEY_TOMTE_SCENES, Array.isArray, []),
  };
}

export function setTomteSeen({ intro, welcome, scenes }) {
  write(KEY_TOMTE_INTRO, intro ? '1' : null);
  write(KEY_TOMTE_WELCOME, welcome ? '1' : null);
  write(KEY_TOMTE_SCENES, scenes.length ? JSON.stringify(scenes) : null);
}

// Answers to Tomten's questions, { sceneId: { questionId: optionIndex } }. Only ever read
// back for Tomten's own lines, never sent anywhere.
export function getTomteAnswers(sceneId) {
  const all = readJson(KEY_TOMTE_ANSWERS, isPlainObject, {});
  return isPlainObject(all[sceneId]) ? all[sceneId] : {};
}

export function saveTomteAnswer(sceneId, questionId, optionIndex) {
  const all = readJson(KEY_TOMTE_ANSWERS, isPlainObject, {});
  all[sceneId] = { ...(isPlainObject(all[sceneId]) ? all[sceneId] : {}), [questionId]: optionIndex };
  write(KEY_TOMTE_ANSWERS, JSON.stringify(all));
}

// Forgets everything Tomten has shown and been told (dev mode).
export function clearTomte() {
  for (const key of [KEY_TOMTE_INTRO, KEY_TOMTE_WELCOME, KEY_TOMTE_SCENES, KEY_TOMTE_ANSWERS]) write(key, null);
}

// What Tomten has said and been answered, oldest first (see history.js).
export function getHistory() {
  return normalizeHistory(readJson(KEY_TOMTE_HISTORY, Array.isArray, []));
}

export function setHistory(history) {
  write(KEY_TOMTE_HISTORY, history.length ? JSON.stringify(history) : null);
}

// The lottery for Tomten's random lines (see tomte-random.js): which lines this round has used.
export function getRandomBag() {
  return normalizeBag(readJson(KEY_TOMTE_BAG, isPlainObject, emptyBag()));
}

export function setRandomBag(bag) {
  write(KEY_TOMTE_BAG, JSON.stringify(bag));
}

export function clearRandomBag() {
  write(KEY_TOMTE_BAG, null);
}

// --- Sound ---

// Sound is on unless turned off. The music menu is "off" unless something else was picked
// ("mix" or a melody key; the old "on" from before the menu means "mix").
export function getSoundOn() {
  return parseToggle(read(KEY_SOUND), true);
}

export function setSoundOn(on) {
  write(KEY_SOUND, on ? 'on' : 'off');
}

export function getMusicChoice() {
  return parseMusicChoice(read(KEY_MUSIC));
}

export function setMusicChoice(choice) {
  write(KEY_MUSIC, parseMusicChoice(choice));
}

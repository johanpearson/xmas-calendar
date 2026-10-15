// UI and rendering.
import {
  today,
  isUnlocked,
  isValidDateKey,
  formatDate,
  dayOfMonth,
  isBeforeDecember,
  msUntilNextMidnight,
  toDateKey,
} from './dates.js';
import {
  getOpened,
  markOpened,
  markAllOpened,
  clearOpened,
  isDevEnabled,
  setDevEnabled,
  applyDevParam,
  getDateOverride,
  setDateOverride,
  getTomteSeen,
  clearTomte,
  getForecastOverride,
  setForecastOverride,
  getSoundOn,
  setSoundOn,
  getMusicChoice,
  setMusicChoice,
} from './storage.js';
import { setupInstall, isStandalone } from './install.js';
import { loadTomte, createTomte } from './tomte-ui.js';
import { currentScene } from './tomte.js';
import { lastFetch, testFetch } from './weather.js';
import { mountScene } from './scene.js';
import { assignThemes, doorLook, animationFor } from './themes.js';
import { playOpening, revealFor } from './effects.js';
import { icon, typeIcon, adventCandles } from './icons.js';
import {
  initAudio,
  playEffect,
  playForDoor,
  playThemeFor,
  playTheme,
  stopThemeSong,
  playAllEffects,
  playJingle,
  isSoundOn,
  soundForDoor,
  fanfareFor,
} from './audio.js';
import { audioControls } from './audio-ui.js';
import { SCENES, isScene, homeSceneFor } from './scenes.js';

const CONTENT_URL = './content/days.json';
const TOAST_MS = 2800;

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  header: $('header'),
  title: $('title'),
  subtitle: $('subtitle'),
  loading: $('loading'),
  error: $('error'),
  retry: $('retry'),
  special: $('special'),
  grid: $('grid'),
  toast: $('toast'),
  card: $('card'),
  cardIcon: $('card-icon'),
  cardDate: $('card-date'),
  cardTitle: $('card-title'),
  cardVerse: $('card-verse'),
  cardBody: $('card-body'),
  cardInner: document.querySelector('#card .card-inner'),
  cardAlt: $('card-alt'),
  homeScene: $('home-scene'),
};

const state = {
  days: [],
  doors: new Map(), // id -> { day, btn }
  todayKey: null,
  busy: false, // true while an opening animation runs
  midnightTimer: null,
  toastTimer: null,
  onDoorsUpdated: null, // set by dev mode to keep its banner in sync
  tomte: null, // { content, ui } once content/tomte.json has loaded
  tomteDay: null, // the day Tomten last checked, so a resume on a new day counts as a start
  cardScene: null, // cleanup for the scene in the open card
  home: { key: null, date: null, cleanup: null }, // the small scene on the main screen
};

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Content loading and validation ---

// Validates entries and sorts them by date. Throws on any invalid date, an empty list
// or a duplicate id (ids key the door map), so mistakes show the error state.
function normalizeContent(json) {
  if (!json || !Array.isArray(json.days)) throw new Error('days.json: "days" must be an array');
  json.days.forEach((d, i) => {
    if (!d || !isValidDateKey(d.date)) throw new Error(`days.json: entry ${i} has an invalid date`);
  });
  const days = json.days
    .map((d) => ({ ...d, id: typeof d.id === 'string' && d.id ? d.id : `d-${d.date}` }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) throw new Error('days.json: no days');
  const ids = new Set();
  for (const d of days) {
    if (ids.has(d.id)) throw new Error(`days.json: duplicate id "${d.id}"`);
    ids.add(d.id);
  }
  return {
    title: typeof json.title === 'string' ? json.title : 'Adventskalender',
    recipient: typeof json.recipient === 'string' ? json.recipient : '',
    days,
  };
}

async function loadContent() {
  const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`days.json: HTTP ${res.status}`);
  return normalizeContent(await res.json());
}

// --- "Today" ---

// The date override is only honoured while dev mode is on.
function currentToday() {
  return today(new Date(), isDevEnabled() ? getDateOverride() : null);
}

// --- Rendering ---

function doorName(day) {
  if (isBeforeDecember(day.date)) return day.label ?? `Lucka ${formatDate(day.date)}`;
  const n = dayOfMonth(day.date);
  return day.label ? `Lucka ${n}, ${day.label}` : `Lucka ${n}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Door markup: the inside (seen when opened) and the leaf that swings open on its left hinge.
function createDoor(day, theme) {
  const special = isBeforeDecember(day.date);
  const look = doorLook(day.date, theme);

  const btn = el('button', `door type-${day.type ?? 'unknown'} look-${look.kind}`);
  btn.type = 'button';
  btn.dataset.date = day.date;
  if (look.theme) btn.dataset.theme = look.theme;
  if (special) btn.classList.add('is-special');

  // Special doors lead with their label; grid doors lead with the day number.
  const mainText = special ? (day.label ?? formatDate(day.date)) : String(dayOfMonth(day.date));
  const subText = special ? formatDate(day.date) : day.label;

  const inside = el('span', 'door-inside');
  inside.setAttribute('aria-hidden', 'true');
  inside.append(typeIcon(day.type, 'door-type-icon'), el('span', 'door-inside-num', mainText));

  const leaf = el('span', 'door-leaf');
  leaf.setAttribute('aria-hidden', 'true');
  if (look.kind === 'theme') leaf.append(icon(look.icon, 'door-deco'));
  if (look.kind === 'christmas') leaf.append(icon('bow', 'door-bow'));
  const text = el('span', 'door-text');
  text.append(el('span', 'door-num', mainText));
  if (subText) text.append(el('span', 'door-label', subText));
  leaf.append(text);
  if (look.kind === 'advent') leaf.append(adventCandles(look.advent, 'door-candles'));
  leaf.append(icon('lock', 'door-lock'), el('span', 'door-knob'));

  btn.append(inside, leaf);
  btn.addEventListener('click', () => onDoorClick(day.id));
  btn.addEventListener('animationend', (e) => {
    if (e.animationName === 'shake') btn.classList.remove('is-shaking');
  });
  return btn;
}

function renderGrid() {
  els.special.replaceChildren();
  els.grid.replaceChildren();
  state.doors.clear();
  const gridDays = state.days.filter((d) => !isBeforeDecember(d.date));
  const gridThemes = assignThemes(gridDays.map((d) => d.date));
  const themeById = new Map(gridDays.map((d, i) => [d.id, gridThemes[i]]));
  // Special doors (before December) sit outside the grid, so they can't clash with it.
  const specialThemes = assignThemes(state.days.filter((d) => isBeforeDecember(d.date)).map((d) => d.date), [1]);
  let specialIndex = 0;
  for (const day of state.days) {
    const special = isBeforeDecember(day.date);
    const theme = special ? specialThemes[specialIndex++] : themeById.get(day.id);
    const btn = createDoor(day, theme);
    state.doors.set(day.id, { day, btn });
    (special ? els.special : els.grid).append(btn);
  }
  els.special.hidden = els.special.childElementCount === 0;
  els.grid.hidden = els.grid.childElementCount === 0;
}

// Updates lock/open/today state on every door without rebuilding the DOM.
function updateDoors() {
  const todayKey = currentToday();
  const opened = getOpened();
  state.todayKey = todayKey;
  for (const { day, btn } of state.doors.values()) {
    const unlocked = isUnlocked(day.date, todayKey);
    const isOpened = unlocked && opened.has(day.id);
    const isToday = day.date === todayKey;
    btn.classList.toggle('is-locked', !unlocked);
    btn.classList.toggle('is-opened', isOpened);
    btn.classList.toggle('is-today', isToday);

    let badge = btn.querySelector('.door-badge');
    if (isToday && !badge) {
      badge = el('span', 'door-badge', 'Idag');
      badge.setAttribute('aria-hidden', 'true');
      btn.append(badge);
    } else if (!isToday && badge) {
      badge.remove();
    }

    let status;
    if (!unlocked) status = `låst, öppnas ${formatDate(day.date)}`;
    else if (isOpened) status = isToday ? 'idag, öppnad' : 'öppnad';
    else status = isToday ? 'idag, redo att öppnas' : 'redo att öppnas';
    btn.setAttribute('aria-label', `${doorName(day)}, ${status}`);
  }
  updateHomeScene();
  state.onDoorsUpdated?.();
}

// --- Day scenes (js/scenes.js) ---

// The small scene on the main screen: only on the date of a door whose scene has one.
function updateHomeScene(dateKey = state.todayKey) {
  const key = homeSceneFor(state.days, dateKey);
  const { home } = state;
  if (key === home.key && dateKey === home.date) return key;
  home.cleanup?.();
  home.cleanup = key
    ? SCENES[key].render(els.homeScene, { date: dateKey, reducedMotion: prefersReducedMotion(), small: true })
    : null;
  home.key = key;
  home.date = dateKey;
  return key;
}

// The door's scene behind the text in the card. Replaces any scene already there.
function showCardScene(day) {
  clearCardScene();
  if (!isScene(day.scene)) return;
  const layer = el('div', 'card-scene');
  layer.setAttribute('aria-hidden', 'true');
  els.cardInner.prepend(layer);
  const cleanup = SCENES[day.scene].render(layer, { date: day.date, reducedMotion: prefersReducedMotion() });
  els.card.classList.add('has-scene');
  state.cardScene = () => {
    cleanup();
    layer.remove();
  };
}

function clearCardScene() {
  state.cardScene?.();
  state.cardScene = null;
  els.card.classList.remove('has-scene');
}

// --- Interaction ---

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), TOAST_MS);
}

function onDoorClick(id) {
  const entry = state.doors.get(id);
  if (!entry || state.busy) return;
  const { day, btn } = entry;

  // Always re-check against the clock at click time, not the last render.
  if (currentToday() !== state.todayKey) updateDoors();

  if (!isUnlocked(day.date, state.todayKey)) {
    btn.classList.remove('is-shaking');
    void btn.offsetWidth; // restart the animation on repeated taps
    btn.classList.add('is-shaking');
    playEffect('knock');
    showToast(`Den här luckan öppnas ${formatDate(day.date)}`);
    return;
  }

  const firstTime = !btn.classList.contains('is-opened');
  markOpened(day.id);
  updateDoors();
  playThemeFor(day); // the door's own song, opened before or not

  if (firstTime && !prefersReducedMotion()) playThenShow(day, btn, animationFor(day));
  else {
    // Reduced motion skips the animation but not its sound. An opened door gets a soft ding.
    if (firstTime) playForDoor(day, animationFor(day));
    else playEffect('chime');
    showCard(day, firstTime ? 'fade' : null);
  }
}

// Plays an opening animation, then shows the card. A skipped animation gets a plain fade.
// The door's sound starts with the opening animation, or, for a door with a scene, together
// with the scene's entrance when the card appears.
async function playThenShow(day, btn, animation, { haptics = true } = {}) {
  state.busy = true;
  const withScene = isScene(day.scene);
  if (!withScene) playForDoor(day, animation);
  try {
    const { skipped } = await playOpening(btn, animation, { haptics });
    showCard(day, skipped ? 'fade' : revealFor(animation));
    if (withScene) playForDoor(day, animation);
  } finally {
    state.busy = false;
  }
}

// Plain text to one element per line, never innerHTML.
function lines(text, tag) {
  return String(text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => el(tag, null, line));
}

function setCardContent(title, verse, body) {
  els.cardTitle.textContent = title ?? '';
  // Verse: one line per line break, shown in italics between title and body.
  const verseLines = lines(verse, 'p');
  els.cardVerse.replaceChildren(...verseLines);
  els.cardVerse.hidden = verseLines.length === 0;
  // Body: one paragraph per line.
  els.cardBody.replaceChildren(...lines(body, 'p'));
}

// reveal: how the card enters (see .card[data-reveal] in style.css), null for the default.
function showCard(day, reveal = null) {
  els.card.className = `card type-${day.type ?? 'unknown'}`;
  if (reveal) els.card.dataset.reveal = reveal;
  else delete els.card.dataset.reveal;
  els.cardIcon.replaceChildren(typeIcon(day.type));
  els.cardDate.textContent = day.label ? `${day.label} · ${formatDate(day.date)}` : formatDate(day.date);
  setCardContent(day.title, day.verse, day.body);

  const alt = day.alternative;
  if (alt && (alt.title || alt.body)) {
    let showingAlt = false;
    els.cardAlt.hidden = false;
    els.cardAlt.textContent = 'Dåligt väder? Visa plan B';
    els.cardAlt.onclick = () => {
      showingAlt = !showingAlt;
      if (showingAlt) setCardContent(alt.title ?? day.title, alt.verse ?? day.verse, alt.body);
      else setCardContent(day.title, day.verse, day.body);
      els.cardAlt.textContent = showingAlt ? 'Tillbaka till ursprungsplanen' : 'Dåligt väder? Visa plan B';
    };
  } else {
    els.cardAlt.hidden = true;
    els.cardAlt.onclick = null;
  }

  if (!els.card.open) els.card.showModal();
  els.card.scrollTop = 0;
  showCardScene(day); // starts its entrance now, as the card appears
}

// Close the card when tapping the backdrop.
els.card.addEventListener('click', (e) => {
  if (e.target === els.card) els.card.close();
});
els.card.addEventListener('close', clearCardScene);

// --- Keeping "today" fresh while the app stays open ---

function refreshIfDayChanged() {
  if (currentToday() === state.todayKey) return false;
  updateDoors();
  return true;
}

function scheduleMidnight() {
  clearTimeout(state.midnightTimer);
  // A small margin so we land safely after midnight.
  state.midnightTimer = setTimeout(() => {
    refreshIfDayChanged();
    scheduleMidnight();
  }, msUntilNextMidnight(new Date()) + 1000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // Timers may have been throttled or frozen in the background.
  // Coming back on a new day counts as a new start for Tomten: phones keep apps alive for days.
  // Compared with Tomten's own day: the midnight timer may already have moved todayKey on.
  refreshIfDayChanged();
  if (currentToday() !== state.tomteDay) checkTomte();
  scheduleMidnight();
});

// --- Startup ---

function showError(err) {
  console.error(err);
  els.loading.hidden = true;
  els.special.hidden = true;
  els.grid.hidden = true;
  els.error.hidden = false;
  els.app.setAttribute('aria-busy', 'false');
}

els.retry.addEventListener('click', () => location.reload());

// Handles ?dev=on|off, then strips the parameter so it isn't bookmarked or shared.
function handleDevParam() {
  const url = new URL(location.href);
  if (!applyDevParam(url)) return;
  url.searchParams.delete('dev');
  history.replaceState(null, '', url);
}

// Dev code is only loaded when the flag is set, so without it nothing dev related reaches the DOM.
async function startDevMode() {
  const { mountDevPanel } = await import('./dev.js');
  state.onDoorsUpdated = mountDevPanel({
    days: state.days,
    realToday: () => today(new Date()),
    effectiveToday: () => state.todayKey,
    getOverride: getDateOverride,
    setOverride(dateKey) {
      setDateOverride(dateKey);
      updateDoors();
    },
    openAll() {
      markAllOpened(state.days.map((d) => d.id));
      // Opened doors stay locked until their date, so jump to the last date to show them all.
      const last = state.days[state.days.length - 1].date;
      if (!isUnlocked(last, state.todayKey)) setDateOverride(last);
      updateDoors();
    },
    resetOpened() {
      clearOpened();
      updateDoors();
    },
    // Preview: plays an animation on a door without marking it opened (works on locked doors too).
    async playAnimation(id, animation) {
      const entry = state.doors.get(id);
      if (!entry || state.busy) return;
      playThemeFor(entry.day);
      if (els.card.open) els.card.close();
      entry.btn.scrollIntoView({ block: 'center' });
      if (prefersReducedMotion()) {
        playForDoor(entry.day, animation ?? animationFor(entry.day));
        showCard(entry.day, 'fade');
      } else await playThenShow(entry.day, entry.btn, animation ?? animationFor(entry.day), { haptics: false });
    },
    disable() {
      setDevEnabled(false);
      location.reload();
    },
    tomte: state.tomte && devTomte(state.tomte),
    audio: {
      isOn: isSoundOn,
      playAll: (onEach) => playAllEffects(onEach),
      playJingle: () => playJingle(),
      playEffect: (name) => playEffect(name),
      playMelody: (key) => playTheme(key, { full: true, delay: 0 }),
      stopMelody: () => stopThemeSong(),
      usage: soundUsage(),
    },
    toast: showToast,
  });
}

// Which doors use which effect and melody, for the dev panel: { effects, melodies },
// each a Map from name to [{ door, own }] (own: set in days.json, not the type's default).
function soundUsage() {
  const effects = new Map();
  const melodies = new Map();
  const add = (map, name, entry) => map.set(name, [...(map.get(name) ?? []), entry]);
  for (const day of state.days) {
    const door = doorName(day);
    add(effects, soundForDoor(day, animationFor(day)), { door, own: Boolean(day.sound) && soundForDoor(day) === day.sound });
    if (fanfareFor(day)) add(effects, 'fanfare', { door, own: false });
    if (day.music) add(melodies, day.music, { door, own: true });
  }
  return { effects, melodies };
}

// --- Tomten ---

// Resolves when no door is opening and the card is closed, so Tomten never talks over it.
async function whenIdle() {
  while (state.busy || els.card.open) {
    await new Promise((resolve) => els.card.addEventListener('close', resolve, { once: true }));
  }
}

async function checkTomte() {
  if (!state.tomte) return;
  state.tomteDay = currentToday();
  await whenIdle();
  // A conversation left open (e.g. overnight) finishes first, then today's check runs.
  await state.tomte.ui.whenClosed();
  await whenIdle();
  state.tomte.ui.check(currentToday(), isStandalone());
}

// Tomten is a bonus: if tomte.json is missing or broken, the calendar works as before.
async function startTomte() {
  try {
    const content = await loadTomte();
    state.tomte = { content, ui: createTomte(content) };
  } catch (err) {
    console.warn('Tomten could not start', err);
    return;
  }
  // Let the calendar settle on screen before Tomten pops up.
  setTimeout(checkTomte, prefersReducedMotion() ? 0 : 600);
}

// Tomten in the dev panel: play anything at once (ignoring dates and seen state) and reset.
function devTomte({ content, ui }) {
  return {
    items: [
      ...(content.intro ? [{ kind: 'intro', id: 'intro', label: 'Intro' }] : []),
      ...(content.welcome ? [{ kind: 'welcome', id: 'welcome', label: 'Välkomst' }] : []),
      ...content.scenes.map((scene) => ({ kind: 'scene', id: scene.id, label: scene.id, scene })),
    ],
    // The scene the effective date (simulated or real) points at, seen or not.
    currentId: () => currentScene(content.scenes, state.todayKey)?.id ?? null,
    isSeen(item) {
      const seen = getTomteSeen();
      return item.kind === 'scene' ? seen.scenes.includes(item.id) : seen[item.kind];
    },
    async play(item) {
      if (els.card.open) els.card.close();
      await whenIdle();
      await ui.play(item.kind, item.scene);
    },
    reset: clearTomte,
    // "Prognos": null (the real forecast), "good", "bad" or "unknown".
    forecast: {
      get: getForecastOverride,
      set: setForecastOverride,
      last: () => lastFetch(),
      // A real fetch for tomorrow by the real date (the simulated one is often out of the
      // source's range), to check that the source answers. Scenes are not affected.
      async testTomorrow() {
        const now = new Date();
        const date = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
        return { date, ...(await testFetch(date)) };
      },
    },
  };
}

// Relative path and scope, so it works under /<repo>/ on GitHub Pages.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('Service worker registration failed', err);
  });
}

async function init() {
  handleDevParam();
  registerServiceWorker();
  mountScene();
  // Sound is a bonus: audio.js never throws, and stays silent until the first tap.
  initAudio({ getSoundOn, setSoundOn, getMusicChoice, setMusicChoice, today: currentToday });
  const controls = audioControls();
  if (controls) els.header.append(controls);
  setupInstall({ container: els.header });

  let content;
  try {
    content = await loadContent();
  } catch (err) {
    showError(err);
    return;
  }

  document.title = content.title;
  els.title.textContent = content.title;
  els.subtitle.textContent = content.recipient ? `Till ${content.recipient}` : '';
  state.days = content.days;

  renderGrid();
  updateDoors();
  els.loading.hidden = true;
  els.app.setAttribute('aria-busy', 'false');
  scheduleMidnight();
  const tomteLoaded = startTomte();

  if (isDevEnabled()) {
    await tomteLoaded; // the dev panel lists Tomten's scenes
    try {
      await startDevMode();
    } catch (err) {
      console.error('Dev mode failed to start', err);
    }
  }
}

init();

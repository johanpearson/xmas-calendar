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
import { lastFetch, testFetch, getWeatherVariant } from './weather.js';
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
  audioState,
  setPrerenderPlan,
  prerenderOrder,
  startupKeys,
  prerendered,
  effectOffsetMs,
} from './audio.js';
import { audioControls } from './audio-ui.js';
import { enableLatencyLog, notePress, noteFrame, noteExtra, onLatency, latencyEntries, clearLatency } from './latency.js';
import { SCENES, SCENE_KEYS, isScene, homeSceneFor } from './scenes.js';
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
  WEATHER_NOTE,
} from './card.js';

const CONTENT_URL = './content/days.json';
const TOAST_MS = 2800;
// A finger that moves further than this while down is scrolling, not tapping.
const TAP_SLOP_PX = 10;
// A touch this soon after the page scrolled stops the scroll; it is not a tap on a door.
const SCROLL_GRACE_MS = 150;
// An opened door opens again on a double tap: the second tap within this long of the first.
const DOUBLE_TAP_MS = 400;

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
  cardNote: $('card-note'),
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
  press: null, // the door opened by the latest pointerdown (see cancelPress)
  pointerDoor: null, // that door, until its click (which is swallowed) has come
  pointerDoorTimer: null,
  lastScroll: -Infinity, // performance.now() of the latest scroll event
  lastTap: null, // { id, at }: the first tap on an opened door, waiting for its second
  tapHintTimer: null,
  midnightTimer: null,
  toastTimer: null,
  onDoorsUpdated: null, // set by dev mode to keep its banner in sync
  tomte: null, // { content, ui } once content/tomte.json has loaded
  tomteDay: null, // the day Tomten last checked, so a resume on a new day counts as a start
  cardScene: null, // cleanup for the scene in the open card
  cardToken: null, // the card showing now, so a late forecast never reaches another one
  home: { key: null, date: null, cleanup: null }, // the small scene on the main screen
  homePreview: null, // dev: show the main-screen scene of this date instead of today's
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
  btn.addEventListener('pointerdown', (e) => onDoorPointerDown(e, day.id));
  btn.addEventListener('pointercancel', () => cancelPress(day.id));
  btn.addEventListener('click', (e) => onDoorClick(e, day.id));
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
function updateHomeScene(dateKey = state.homePreview ?? state.todayKey) {
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

// A door opens on pointerdown, not on click: the click only comes when the finger lifts
// (and on a phone often later still). The click that follows is swallowed; a click
// without a pointer before it (Enter or Space on a focused door) opens the door as before.
// The card itself waits until the finger is lifted (see waitForRelease), so a touch that
// turns into a scroll never ends with an open card.
function onDoorPointerDown(e, id) {
  if (!e.isPrimary || e.button !== 0) return;
  state.pointerDoor = id; // its click is swallowed either way
  clearTimeout(state.pointerDoorTimer);
  state.pointerDoorTimer = setTimeout(() => (state.pointerDoor = null), 1500);
  if (e.pointerType === 'touch' && performance.now() - state.lastScroll < SCROLL_GRACE_MS) return; // stopping a scroll
  notePress(state.doors.get(id)?.day.date ?? id, e.timeStamp, { audio: audioState() });
  const press = {
    id,
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    released: false,
    cancelled: false,
    shown: false,
    toast: false,
    theme: false,
    sounds: [],
    controller: new AbortController(),
  };
  press.release = new Promise((resolve) => (press.onRelease = resolve));
  state.press = press;
  openDoor(id, press);
}

// Follows the finger of the latest press: lifted, it lets the card come; moved too far
// (or the page scrolled under it), the press is cancelled.
function trackPresses() {
  const release = (e) => {
    const { press } = state;
    if (!press || press.released || e.pointerId !== press.pointerId) return;
    press.released = true;
    press.onRelease();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', (e) => {
    if (state.press && e.pointerId === state.press.pointerId) cancelPress(state.press.id);
  });
  window.addEventListener('pointermove', (e) => {
    const { press } = state;
    if (!press || press.released || e.pointerId !== press.pointerId) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP_PX) cancelPress(press.id);
  });
  window.addEventListener('scroll', () => {
    state.lastScroll = performance.now();
    const { press } = state;
    if (press && !press.released) cancelPress(press.id);
  }, { passive: true });
}

function onDoorClick(e, id) {
  if (e.detail > 0 && state.pointerDoor === id) {
    state.pointerDoor = null; // opened on its pointerdown already
    return;
  }
  notePress(state.doors.get(id)?.day.date ?? id, e.timeStamp, { audio: audioState() });
  openDoor(id);
}

// The tap became a scroll (the browser took the pointer over): the door does not open
// after all. Its sound fades out at once and the animation stops before the card.
function cancelPress(id) {
  const { press } = state;
  if (!press || press.id !== id || press.shown || press.cancelled) return;
  press.cancelled = true;
  press.released = true;
  press.onRelease();
  press.controller.abort();
  for (const sound of press.sounds) sound.stop();
  if (press.theme) stopThemeSong();
  if (press.toast) els.toast.classList.remove('is-visible');
}

// Opens a door (or knocks on a locked one). The sound starts first, right here in the
// event handler; everything that draws waits for the next frame (see runOpening).
function openDoor(id, press = null) {
  const entry = state.doors.get(id);
  if (!entry || state.busy) return;
  const { day, btn } = entry;

  // Always re-check against the clock at tap time, not the last render.
  if (currentToday() !== state.todayKey) updateDoors();

  if (!isUnlocked(day.date, state.todayKey)) {
    const knock = playEffect('knock');
    if (press && knock) press.sounds.push(knock);
    requestAnimationFrame(() => {
      if (press?.cancelled) return;
      btn.classList.remove('is-shaking');
      void btn.offsetWidth; // restart the animation on repeated taps
      btn.classList.add('is-shaking');
      showToast(`Den här luckan öppnas ${formatDate(day.date)}`);
      if (press) press.toast = true;
    });
    return;
  }

  const firstTime = !btn.classList.contains('is-opened');
  if (!firstTime && press && !isSecondTap(id, press)) return;
  const animation = animationFor(day);
  // Reduced motion skips the animation but not its sound. An opened door gets a soft ding.
  const sounds = firstTime ? playForDoor(day, animation) : [playEffect('chime')].filter(Boolean);
  press?.sounds.push(...sounds);
  runOpening(day, btn, {
    animation: firstTime && !prefersReducedMotion() ? animation : null,
    reveal: firstTime ? 'fade' : null,
    mark: true,
    press,
  });
}

// An opened door needs a double tap (a press with the pointer; Enter or Space opens it at
// once), so a touch on the way to a scroll never opens it again. A first tap that ends as
// a tap, with no second one, shows a hint.
function isSecondTap(id, press) {
  const now = performance.now();
  const prev = state.lastTap;
  clearTimeout(state.tapHintTimer);
  if (prev && prev.id === id && now - prev.at < DOUBLE_TAP_MS) {
    state.lastTap = null;
    return true;
  }
  const tap = { id, at: now };
  state.lastTap = tap;
  press.release.then(() => {
    if (state.lastTap !== tap) return;
    if (press.cancelled) {
      state.lastTap = null; // a scroll, not a first tap
      return;
    }
    state.tapHintTimer = setTimeout(() => {
      if (state.lastTap === tap) showToast('Tryck två gånger för att öppna luckan igen');
    }, Math.max(0, tap.at + DOUBLE_TAP_MS - performance.now()));
  });
  return false;
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// The heavy part of opening a door, after its sound has started. In the next frame: the
// opening animation (none for reduced motion or an opened door, which get `reveal`), the
// forecast lookup and, just after, the door's theme song. Then the card, once the
// animation has ended and the forecast is in (but waiting at most FORECAST_WAIT_MS: a
// later answer can still switch the open card to plan B, see showCard). The forecast
// never holds up the sound or the animation. mark: save the door as opened (not for dev
// previews). A cancelled press (see cancelPress) stops before the card.
async function runOpening(day, btn, { animation = null, reveal = null, haptics = true, mark = false, press = null } = {}) {
  state.busy = true;
  try {
    await nextFrame();
    if (press?.cancelled) return;
    const forecast = forecastFor(day);
    const opening = animation ? playOpening(btn, animation, { haptics, signal: press?.controller.signal }) : null;
    setTimeout(() => {
      if (press?.cancelled) return;
      playThemeFor(day); // the door's own song, opened before or not (it starts a second in)
      if (press) press.theme = Boolean(day.music);
    }, 0);
    const [result, variant] = await Promise.all([opening ?? { skipped: false }, waitForForecast(forecast)]);
    if (press && !press.released) await press.release; // a tap, not the start of a scroll
    if (press?.cancelled || result.aborted) return;
    if (press) press.shown = true;
    if (mark) {
      markOpened(day.id);
      updateDoors();
    }
    showCard(day, animation ? (result.skipped ? 'fade' : revealFor(animation)) : reveal, { variant, forecast });
  } finally {
    state.busy = false;
  }
}

// Plan B: a door with an alternative asks for the forecast of its own date, through the
// same function and cache as Tomten's weather scenes, so both judge the weather alike.
// Dev mode's "Prognos" forces a variant here too. Never rejects; null without a plan B.
function forecastFor(day) {
  if (!hasAlternative(day)) return null;
  const override = isDevEnabled() ? getForecastOverride() : null;
  return getWeatherVariant([day.date], { override });
}

// Plain text to one element per line, never innerHTML. A blank line in the text gives the
// next line extra space before it (.is-spaced) instead of disappearing.
function lines(text, tag) {
  return paragraphs(text).map(({ text: line, gapBefore }) => el(tag, gapBefore ? 'is-spaced' : null, line));
}

function setCardContent({ title, verse, body }) {
  els.cardTitle.textContent = title ?? '';
  // Verse: one line per line break, shown in italics between title and body.
  const verseLines = lines(verse, 'p');
  els.cardVerse.replaceChildren(...verseLines);
  els.cardVerse.hidden = verseLines.length === 0;
  // Body: one paragraph per line. An empty body (a door that is all verse) takes no space.
  const bodyLines = lines(body, 'p');
  els.cardBody.replaceChildren(...bodyLines);
  els.cardBody.hidden = bodyLines.length === 0;
}

// Plan A or B in the card, Tomten's weather line and the button's text. smooth: the plan
// changed under an open card (a late forecast), so the new text fades in.
function showPlan(day, choice, { smooth = false } = {}) {
  setCardContent(planContent(day, choice.plan));
  els.cardNote.hidden = !showsWeatherNote(choice);
  els.cardAlt.textContent = toggleLabel(choice);
  els.cardAlt.dataset.plan = choice.plan;
  els.card.classList.remove('is-replanned');
  if (smooth) {
    void els.card.offsetWidth; // restart the fade on a second switch
    els.card.classList.add('is-replanned');
  }
}

// reveal: how the card enters (see .card[data-reveal] in style.css), null for the default.
// variant: the forecast if it came in time (null otherwise); forecast: the pending lookup,
// which may still switch the card to plan B when it comes later.
function showCard(day, reveal = null, { variant = null, forecast = null } = {}) {
  const token = {};
  state.cardToken = token;
  els.card.className = `card type-${day.type ?? 'unknown'}`;
  if (reveal) els.card.dataset.reveal = reveal;
  else delete els.card.dataset.reveal;
  els.cardIcon.replaceChildren(typeIcon(day.type));
  els.cardDate.textContent = day.label ? `${day.label} · ${formatDate(day.date)}` : formatDate(day.date);

  if (hasAlternative(day)) {
    // The button always switches, whatever the forecast said.
    let choice = variant === null ? initialChoice() : withForecast(initialChoice(), variant);
    showPlan(day, choice);
    els.cardAlt.hidden = false;
    els.cardAlt.onclick = () => {
      choice = toggled(choice);
      showPlan(day, choice);
    };
    // Too late for the opening: a bad forecast still switches to plan B, unless the plan
    // was already switched by hand (withForecast keeps it then) or the card has moved on.
    if (variant === null && forecast) {
      forecast.then((late) => {
        if (state.cardToken !== token) return;
        const next = withForecast(choice, late);
        const changed = next.plan !== choice.plan;
        choice = next;
        if (changed) showPlan(day, choice, { smooth: !prefersReducedMotion() });
      });
    }
  } else {
    setCardContent(planContent(day, 'A'));
    els.cardNote.hidden = true;
    els.cardAlt.hidden = true;
    els.cardAlt.onclick = null;
  }

  if (!els.card.open) els.card.showModal();
  els.card.scrollTop = 0;
  noteExtra('card');
  requestAnimationFrame(noteFrame); // without an opening animation the card is the first frame
  showCardScene(day); // starts its entrance now, as the card appears
}

// Close the card when tapping the backdrop.
els.card.addEventListener('click', (e) => {
  if (e.target === els.card) els.card.close();
});
els.card.addEventListener('close', () => {
  state.cardToken = null;
  clearCardScene();
});
els.cardNote.textContent = WEATHER_NOTE;

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
  enableLatencyLog();
  const { mountDevPanel } = await import('./dev.js');
  state.onDoorsUpdated = mountDevPanel({
    days: state.days,
    realToday: () => today(new Date()),
    effectiveToday: () => state.todayKey,
    getOverride: getDateOverride,
    setOverride(dateKey) {
      setDateOverride(dateKey);
      state.homePreview = null; // the main screen follows the new date again
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
      if (els.card.open) els.card.close();
      entry.btn.scrollIntoView({ block: 'center' });
      const name = animation ?? animationFor(entry.day);
      playForDoor(entry.day, name); // the sound first, as when a door opens
      await runOpening(entry.day, entry.btn, { animation: prefersReducedMotion() ? null : name, reveal: 'fade', haptics: false });
    },
    disable() {
      setDevEnabled(false);
      location.reload();
    },
    tomte: state.tomte && devTomte(state.tomte),
    scenes: devScenes(),
    audio: {
      isOn: isSoundOn,
      playAll: (onEach) => playAllEffects(onEach),
      playJingle: () => playJingle(),
      playEffect: (name) => playEffect(name),
      playMelody: (key) => playTheme(key, { full: true, delay: 0 }),
      stopMelody: () => stopThemeSong(),
      usage: soundUsage(),
    },
    latency: {
      entries: latencyEntries,
      onChange: onLatency,
      clear: clearLatency,
      prerendered,
      offsetOf: effectOffsetMs,
      isOn: isSoundOn,
      // The sound now (with its offset), then flash() as the animation in the next frame.
      test(name, flash) {
        notePress(`test ${name}`, performance.now(), { audio: audioState() });
        playEffect(name);
        requestAnimationFrame((time) => {
          noteFrame(time);
          flash();
        });
      },
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

// Day scenes in the dev panel: every scene with the doors that use it, a preview in the
// card (nothing is marked opened or reset) and the main-screen scene for any date.
function devScenes() {
  return {
    items: SCENE_KEYS.map((key) => ({
      key,
      label: SCENES[key].label,
      home: SCENES[key].home,
      doors: state.days.filter((d) => d.scene === key).map(doorName),
    })),
    play(key) {
      if (state.busy) return;
      const door = state.days.find((d) => d.scene === key);
      const day = door
        ? { ...door, scene: key }
        : { id: `scene-${key}`, date: state.todayKey, type: 'ledtrad', title: SCENES[key].label, body: 'Förhandsvisning av scenen.', scene: key };
      playForDoor(day, animationFor(day)); // the sound first, as when a door opens
      showCard(day, 'fade', { forecast: forecastFor(day) });
    },
    // Shows the main-screen scene of dateKey (until the simulated date changes). Returns its key or null.
    showHome(dateKey) {
      state.homePreview = dateKey;
      const key = updateHomeScene();
      if (key) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      return key;
    },
  };
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
  trackPresses();
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
  // The sounds to prerender: today's door's at once, the others after the first tap.
  const doorSounds = state.days.map((d) => ({ date: d.date, effect: soundForDoor(d, animationFor(d)), fanfare: fanfareFor(d), music: d.music }));
  setPrerenderPlan(
    () => prerenderOrder(doorSounds, state.todayKey ?? currentToday()),
    () => startupKeys(doorSounds, state.todayKey ?? currentToday()),
  );
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

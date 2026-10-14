// UI and rendering.
import {
  today,
  isUnlocked,
  isValidDateKey,
  formatDate,
  dayOfMonth,
  isBeforeDecember,
  msUntilNextMidnight,
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
} from './storage.js';
import { setupInstall } from './install.js';
import { mountScene } from './scene.js';
import { assignThemes, doorLook } from './themes.js';
import { icon, typeIcon } from './icons.js';

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
  cardBody: $('card-body'),
  cardAlt: $('card-alt'),
};

const state = {
  days: [],
  doors: new Map(), // id -> { day, btn }
  todayKey: null,
  busy: false, // true while an opening animation runs
  midnightTimer: null,
  toastTimer: null,
  onDoorsUpdated: null, // set by dev mode to keep its banner in sync
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
  leaf.append(text, icon('lock', 'door-lock'), el('span', 'door-knob'));

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
  state.onDoorsUpdated?.();
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
    showToast(`Den här luckan öppnas ${formatDate(day.date)}`);
    return;
  }

  const firstTime = !btn.classList.contains('is-opened');
  markOpened(day.id);
  updateDoors();

  if (firstTime && !prefersReducedMotion()) {
    state.busy = true;
    const flipMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flip-ms')) || 700;
    setTimeout(() => {
      state.busy = false;
      showCard(day);
    }, flipMs);
  } else {
    showCard(day);
  }
}

function setCardContent(title, body) {
  els.cardTitle.textContent = title ?? '';
  // Body is plain text: one paragraph per line, never innerHTML.
  const paragraphs = String(body ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => el('p', null, text));
  els.cardBody.replaceChildren(...paragraphs);
}

function showCard(day) {
  els.card.className = `card type-${day.type ?? 'unknown'}`;
  els.cardIcon.replaceChildren(typeIcon(day.type));
  els.cardDate.textContent = day.label ? `${day.label} · ${formatDate(day.date)}` : formatDate(day.date);
  setCardContent(day.title, day.body);

  const alt = day.alternative;
  if (alt && (alt.title || alt.body)) {
    let showingAlt = false;
    els.cardAlt.hidden = false;
    els.cardAlt.textContent = 'Dåligt väder? Visa plan B';
    els.cardAlt.onclick = () => {
      showingAlt = !showingAlt;
      if (showingAlt) setCardContent(alt.title ?? day.title, alt.body);
      else setCardContent(day.title, day.body);
      els.cardAlt.textContent = showingAlt ? 'Tillbaka till ursprungsplanen' : 'Dåligt väder? Visa plan B';
    };
  } else {
    els.cardAlt.hidden = true;
    els.cardAlt.onclick = null;
  }

  if (!els.card.open) els.card.showModal();
  els.card.scrollTop = 0;
}

// Close the card when tapping the backdrop.
els.card.addEventListener('click', (e) => {
  if (e.target === els.card) els.card.close();
});

// --- Keeping "today" fresh while the app stays open ---

function refreshIfDayChanged() {
  if (currentToday() !== state.todayKey) updateDoors();
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
  refreshIfDayChanged();
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
    disable() {
      setDevEnabled(false);
      location.reload();
    },
    toast: showToast,
  });
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

  if (isDevEnabled()) {
    try {
      await startDevMode();
    } catch (err) {
      console.error('Dev mode failed to start', err);
    }
  }
}

init();

// UI and rendering.
import { today, isUnlocked, formatDate, dayOfMonth, isBeforeDecember } from './dates.js';
import { getOpened, markOpened } from './storage.js';

const CONTENT_URL = './content/days.json';

const els = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  special: document.getElementById('special'),
  grid: document.getElementById('grid'),
  card: document.getElementById('card'),
  cardDate: document.getElementById('card-date'),
  cardTitle: document.getElementById('card-title'),
  cardBody: document.getElementById('card-body'),
};

let days = [];

function currentToday() {
  return today(new Date());
}

function renderDoor(day, todayKey, opened) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'door';
  btn.textContent = day.label ?? String(dayOfMonth(day.date));
  const unlocked = isUnlocked(day.date, todayKey);
  btn.classList.toggle('is-locked', !unlocked);
  btn.classList.toggle('is-opened', opened.has(day.id));
  btn.addEventListener('click', () => {
    if (isUnlocked(day.date, currentToday())) openDoor(day);
  });
  return btn;
}

function render() {
  const todayKey = currentToday();
  const opened = getOpened();
  els.special.replaceChildren();
  els.grid.replaceChildren();
  for (const day of days) {
    const door = renderDoor(day, todayKey, opened);
    if (isBeforeDecember(day.date)) {
      door.classList.add('is-special');
      els.special.append(door);
    } else {
      els.grid.append(door);
    }
  }
  els.special.hidden = els.special.childElementCount === 0;
}

function openDoor(day) {
  markOpened(day.id);
  els.cardDate.textContent = formatDate(day.date);
  els.cardTitle.textContent = day.title ?? '';
  els.cardBody.replaceChildren(
    ...String(day.body ?? '').split('\n').filter(Boolean).map((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    }),
  );
  els.card.showModal();
  render();
}

async function init() {
  const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
  const content = await res.json();
  document.title = content.title;
  els.title.textContent = content.title;
  els.subtitle.textContent = content.recipient ? `Till ${content.recipient}` : '';
  days = [...content.days].sort((a, b) => a.date.localeCompare(b.date));
  render();
}

init();

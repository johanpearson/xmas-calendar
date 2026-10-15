// Dev panel. Only imported (and only touches the DOM) when the dev flag is set.
import { formatDate, isValidDateKey } from './dates.js';
import { ANIMATIONS, animationFor } from './themes.js';
import { EFFECT_LABELS } from './audio.js';

const ANIMATION_LABELS = {
  sparkle: 'Gnistor och brev',
  gift: 'Present och konfetti',
  bells: 'Dörr, ljus och klockor',
  ribbon: 'Rosett och hjärtan',
  magnifier: 'Förstoringsglas och glitter',
  confetti: 'Konfetti',
  snowburst: 'Snöyra',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, onClick, className = 'dev-btn') {
  const btn = el('button', className, text);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Mounts the banner, floating toggle and panel.
 * Returns a refresh function the app calls whenever "today" may have changed.
 */
export function mountDevPanel(api) {
  // Banner shown while a simulated date is active.
  const banner = el('div', 'dev-banner');
  banner.setAttribute('role', 'status');
  banner.hidden = true;
  document.body.prepend(banner);

  const toggle = button('DEV', () => setPanelOpen(panel.hidden), 'dev-toggle');
  toggle.setAttribute('aria-controls', 'dev-panel');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Öppna dev-panelen');

  const panel = el('section', 'dev-panel');
  panel.id = 'dev-panel';
  panel.setAttribute('aria-label', 'Dev-panel');
  panel.hidden = true;

  const heading = el('h2', 'dev-heading', 'Dev-läge');
  const realInfo = el('p', 'dev-info');

  const dateLabel = el('label', 'dev-field');
  dateLabel.append(el('span', null, 'Simulerat datum'));
  const dateInput = el('input', 'dev-input');
  dateInput.type = 'date';
  dateInput.addEventListener('change', () => {
    if (!isValidDateKey(dateInput.value)) return;
    api.setOverride(dateInput.value);
    preselectDoor();
  });
  dateLabel.append(dateInput);

  const actions = el('div', 'dev-actions');
  actions.append(
    button('Använd riktigt datum', () => {
      api.setOverride(null);
      preselectDoor();
      api.toast('Riktigt datum används');
    }),
    button('Öppna alla', () => {
      api.openAll();
      api.toast('Alla luckor är öppnade');
    }),
    button('Nollställ öppnade luckor', () => {
      api.resetOpened();
      api.toast('Öppnade luckor nollställda');
    }),
    button('Stäng av dev-läge', () => api.disable(), 'dev-btn dev-btn-quiet'),
  );

  // Animation preview: plays on any door without marking it opened.
  const preview = el('fieldset', 'dev-preview');
  preview.append(el('legend', null, 'Spela upp animation'));
  // Labels sit next to the selects (not around them), so their names are just the label text.
  const field = (id, text, control) => {
    const wrap = el('div', 'dev-field');
    const label = el('label', null, text);
    label.htmlFor = id;
    control.id = id;
    wrap.append(label, control);
    return wrap;
  };
  const doorSelect = el('select', 'dev-input');
  for (const day of api.days) {
    const option = el('option', null, day.label ? `${formatDate(day.date)} · ${day.label}` : formatDate(day.date));
    option.value = day.id;
    doorSelect.append(option);
  }
  const animSelect = el('select', 'dev-input');
  const ownOption = el('option');
  ownOption.value = '';
  animSelect.append(ownOption);
  for (const name of ANIMATIONS) {
    const option = el('option', null, `${ANIMATION_LABELS[name] ?? name} (${name})`);
    option.value = name;
    animSelect.append(option);
  }
  const updateOwnOption = () => {
    const day = api.days.find((d) => d.id === doorSelect.value);
    ownOption.textContent = `Luckans egen (${animationFor(day)})`;
  };
  doorSelect.addEventListener('change', updateOwnOption);
  preview.append(
    field('dev-door', 'Lucka', doorSelect),
    field('dev-animation', 'Animation', animSelect),
    button('Spela upp animation', () => {
      setPanelOpen(false);
      api.playAnimation(doorSelect.value, animSelect.value || null);
    }),
  );

  const tomte = api.tomte ? tomteSection(api.tomte, () => setPanelOpen(false), api.toast) : null;

  panel.append(heading, realInfo, dateLabel, actions, preview);
  if (api.audio) panel.append(audioSection(api.audio, api.toast));
  if (tomte) panel.append(tomte.node);
  // Toggle first so Tab moves from it into the open panel.
  document.body.append(toggle, panel);

  function setPanelOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) refresh();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return;
    const hadFocus = panel.contains(document.activeElement);
    setPanelOpen(false);
    if (hadFocus) toggle.focus();
  });

  function refresh() {
    const override = api.getOverride();
    banner.hidden = !override;
    banner.textContent = override ? `DEV: simulerat datum ${override}` : '';
    document.body.classList.toggle('has-dev-banner', Boolean(override));
    realInfo.textContent = `Riktigt datum: ${formatDate(api.realToday())}. Effektivt: ${formatDate(api.effectiveToday())}.`;
    dateInput.value = api.effectiveToday();
    tomte?.refresh();
  }

  // Preselects today's door (or the last unlocked one) for the animation preview.
  function preselectDoor() {
    const current = [...api.days].reverse().find((d) => d.date <= api.effectiveToday()) ?? api.days[0];
    if (current) doorSelect.value = current.id;
    updateOwnOption();
  }

  refresh();
  preselectDoor();
  return refresh;
}

const FORECAST_CHOICES = [
  ['real', 'Riktig'],
  ['good', 'Bra'],
  ['bad', 'Dålig'],
  ['unknown', 'Okänd'],
];

const VARIANT_LABELS = { good: 'bra', bad: 'dålig', unknown: 'okänd (data saknas)' };

const decimal = (value, unit) =>
  typeof value === 'number' ? `${value.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ${unit}` : 'saknas';

// "Senast hämtat 18 dec 14:03, för 20 december: nederbörd 1,2 mm, vind 6,5 m/s"
function describeLastFetch(last) {
  if (!last) return 'Ingen prognos hämtad än.';
  const when = new Date(last.fetchedAt).toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Senast hämtat ${when}, för ${formatDate(last.date)}: nederbörd ${decimal(last.precipitation, 'mm')}, vind ${decimal(last.wind, 'm/s')}.`;
}


// Sound: every effect in turn, and Tomten's jingle. The panel stays open.
function audioSection(audio, toast) {
  const node = el('fieldset', 'dev-preview dev-audio');
  node.append(el('legend', null, 'Ljud'));
  const whenOn = (fn) => () => {
    if (!audio.isOn()) toast('Ljudet är avstängt');
    else fn();
  };
  const actions = el('div', 'dev-actions');
  actions.append(
    button('Spela alla ljud', whenOn(() => audio.playAll((name) => toast(EFFECT_LABELS[name] ?? name)))),
    button('Testa jingle', whenOn(() => audio.playJingle())),
  );
  node.append(actions);
  return node;
}

// Tomten: every conversation with a "Spela upp" button (ignores dates and seen state),
// which one the effective date points at, and a reset.
function tomteSection(tomte, closePanel, toast) {
  const node = el('fieldset', 'dev-preview dev-tomte');
  node.append(el('legend', null, 'Tomten'));
  // "Prognos": the real forecast, or a forced variant for weather scenes (saved, and used
  // by "Spela upp" and by scenes at app start alike).
  const weatherSelect = el('select', 'dev-input');
  weatherSelect.id = 'dev-forecast';
  for (const [value, label] of FORECAST_CHOICES) {
    const option = el('option', null, label);
    option.value = value;
    weatherSelect.append(option);
  }
  weatherSelect.value = tomte.forecast.get() ?? 'real';
  weatherSelect.addEventListener('change', () => {
    tomte.forecast.set(weatherSelect.value === 'real' ? null : weatherSelect.value);
    toast(`Prognos: ${weatherSelect.selectedOptions[0].textContent}`);
  });
  const weatherField = el('div', 'dev-field');
  const weatherLabel = el('label', null, 'Prognos');
  weatherLabel.htmlFor = 'dev-forecast';
  weatherField.append(weatherLabel, weatherSelect);
  const lastInfo = el('p', 'dev-info dev-forecast-last');
  const testButton = button('Testa hämtning (imorgon)', async () => {
    testButton.disabled = true;
    toast('Hämtar prognos …');
    try {
      const result = await tomte.forecast.testTomorrow();
      toast(
        result.ok
          ? `Prognos för ${formatDate(result.date)}: ${VARIANT_LABELS[result.variant]}`
          : `Hämtningen misslyckades: ${result.error}`,
      );
    } finally {
      testButton.disabled = false;
      refresh();
    }
  });
  node.append(weatherField, lastInfo, testButton);
  const list = el('ul', 'dev-tomte-list');
  const rows = tomte.items.map((item) => {
    const row = el('li', 'dev-tomte-item');
    const name = el('span', 'dev-tomte-name', item.label);
    const dates = item.scene ? el('span', 'dev-tomte-dates', `${item.scene.from} – ${item.scene.until}`) : null;
    const status = el('span', 'dev-tomte-status');
    const play = button('Spela upp', () => {
      closePanel();
      tomte.play(item);
    });
    play.setAttribute('aria-label', `Spela upp ${item.label}`);
    const text = el('span', 'dev-tomte-text');
    text.append(name);
    if (dates) text.append(dates);
    text.append(status);
    row.append(text, play);
    list.append(row);
    return { item, row, status };
  });
  node.append(
    list,
    button('Nollställ tomtescener', () => {
      tomte.reset();
      refresh();
      toast('Tomtescener nollställda');
    }),
  );

  function refresh() {
    lastInfo.textContent = describeLastFetch(tomte.forecast.last());
    const current = tomte.currentId();
    for (const { item, row, status } of rows) {
      const isCurrent = item.kind === 'scene' && item.id === current;
      row.classList.toggle('is-current', isCurrent);
      status.textContent = [isCurrent && 'aktuell', tomte.isSeen(item) && 'sedd'].filter(Boolean).join(', ');
    }
  }

  return { node, refresh };
}

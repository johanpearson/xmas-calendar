// Dev panel. Only imported (and only touches the DOM) when the dev flag is set.
import { formatDate, isValidDateKey } from './dates.js';
import { ANIMATIONS, animationFor } from './themes.js';
import { EFFECTS, EFFECT_LABELS } from './audio.js';
import { MELODIES, MELODY_KEYS, MIX_FROM } from './melodies.js';

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
  const scenes = api.scenes ? scenesSection(api.scenes, () => setPanelOpen(false), api.toast, api.effectiveToday) : null;

  panel.append(heading, realInfo, dateLabel, actions, preview);
  if (scenes) panel.append(scenes.node);
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
    scenes?.refresh();
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


// "Lucka 5, Lucka 9 (standard)": the doors that use an effect or a melody.
function usedBy(entries = []) {
  if (entries.length === 0) return 'Används inte av någon lucka';
  return `Används av: ${entries.map(({ door, own }) => (own ? door : `${door} (standard)`)).join(', ')}`;
}

// One row in a sound list: a name, who uses it and a "Spela" button.
function soundRow(label, key, usage, onPlay) {
  const row = el('li', 'dev-sound-item');
  const text = el('span', 'dev-tomte-text');
  text.append(el('span', 'dev-tomte-name', label), el('span', 'dev-tomte-dates', key), el('span', 'dev-tomte-status', usage));
  const play = button('Spela', onPlay);
  play.setAttribute('aria-label', `Spela ${label}`);
  row.append(text, play);
  return row;
}

// Sound: every melody and every effect with "Spela" and the doors that use it, all
// effects in a row, and Tomten's jingle. The panel stays open.
function audioSection(audio, toast) {
  const node = el('fieldset', 'dev-preview dev-audio');
  node.append(el('legend', null, 'Ljud och musik'));
  const whenOn = (fn) => () => {
    if (!audio.isOn()) toast('Ljudet är avstängt');
    else fn();
  };
  const actions = el('div', 'dev-actions');
  actions.append(
    button('Spela alla effekter i följd', whenOn(() => audio.playAll((name) => toast(EFFECT_LABELS[name] ?? name)))),
    button('Testa jingle', whenOn(() => audio.playJingle())),
    button('Stoppa melodi', () => audio.stopMelody()),
  );

  const melodies = el('details', 'dev-sounds');
  melodies.append(el('summary', null, `Melodier (${MELODY_KEYS.length})`));
  const melodyList = el('ul', 'dev-tomte-list');
  for (const key of MELODY_KEYS) {
    const title = MELODIES[key].title;
    const from = MIX_FROM[key] ? `. I Blandat från ${MIX_FROM[key]}` : '';
    melodyList.append(
      soundRow(title, key, `${usedBy(audio.usage.melodies.get(key))}${from}`, whenOn(() => {
        audio.playMelody(key);
        toast(`Spelar ${title}`);
      })),
    );
  }
  melodies.append(melodyList);

  const effects = el('details', 'dev-sounds');
  effects.append(el('summary', null, `Effekter (${EFFECTS.length})`));
  const effectList = el('ul', 'dev-tomte-list');
  for (const name of EFFECTS) {
    effectList.append(soundRow(EFFECT_LABELS[name], name, usedBy(audio.usage.effects.get(name)), whenOn(() => audio.playEffect(name))));
  }
  effects.append(effectList);

  node.append(actions, melodies, effects);
  return node;
}

// Day scenes: every scene with "Spela upp" (a preview in the card, nothing is marked opened
// or reset) and the main screen's scene for any date.
function scenesSection(scenes, closePanel, toast, effectiveToday) {
  const node = el('fieldset', 'dev-preview dev-scenes');
  node.append(el('legend', null, 'Dagsscener'));

  const homeField = el('div', 'dev-field');
  const homeLabel = el('label', null, 'Datum för huvudskärmen');
  const homeDate = el('input', 'dev-input');
  homeDate.type = 'date';
  homeDate.id = 'dev-home-date';
  homeLabel.htmlFor = homeDate.id;
  homeField.append(homeLabel, homeDate);
  const showHome = button('Visa dagens huvudskärmsdekor', () => {
    if (!isValidDateKey(homeDate.value)) return;
    const key = scenes.showHome(homeDate.value);
    const label = scenes.items.find((item) => item.key === key)?.label;
    toast(key ? `Huvudskärmen ${formatDate(homeDate.value)}: ${label}` : `Ingen huvudskärmsdekor ${formatDate(homeDate.value)}`);
    if (key) closePanel();
  });

  const list = el('details', 'dev-sounds');
  list.append(el('summary', null, `Scener (${scenes.items.length})`));
  const ul = el('ul', 'dev-tomte-list');
  for (const item of scenes.items) {
    const used = item.doors.length ? `Används av: ${item.doors.join(', ')}` : 'Används inte av någon lucka';
    const row = el('li', 'dev-sound-item');
    const text = el('span', 'dev-tomte-text');
    text.append(
      el('span', 'dev-tomte-name', item.label),
      el('span', 'dev-tomte-dates', item.home ? `${item.key} · även på huvudskärmen` : item.key),
      el('span', 'dev-tomte-status', used),
    );
    const play = button('Spela upp', () => {
      closePanel();
      scenes.play(item.key);
    });
    play.setAttribute('aria-label', `Spela upp scenen ${item.label}`);
    row.append(text, play);
    ul.append(row);
  }
  list.append(ul);
  node.append(homeField, showHome, list);

  return {
    node,
    refresh() {
      homeDate.value = effectiveToday();
    },
  };
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

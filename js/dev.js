// Dev panel. Only imported (and only touches the DOM) when the dev flag is set.
import { formatDate, isValidDateKey } from './dates.js';
import { ANIMATIONS, animationFor } from './themes.js';

const ANIMATION_LABELS = {
  sparkle: 'Gnistor och brev',
  gift: 'Present och konfetti',
  bells: 'Dörr, ljus och klockor',
  ribbon: 'Rosett och hjärtan',
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

  panel.append(heading, realInfo, dateLabel, actions, preview);
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

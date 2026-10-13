// Dev panel. Only imported (and only touches the DOM) when the dev flag is set.
import { formatDate, isValidDateKey } from './dates.js';

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
    if (isValidDateKey(dateInput.value)) api.setOverride(dateInput.value);
  });
  dateLabel.append(dateInput);

  const actions = el('div', 'dev-actions');
  actions.append(
    button('Använd riktigt datum', () => {
      api.setOverride(null);
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

  panel.append(heading, realInfo, dateLabel, actions);
  document.body.append(panel, toggle);

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

  refresh();
  return refresh;
}

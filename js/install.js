// Install flow. Android/Chrome: a discreet "Installera" button driven by
// beforeinstallprompt. iOS Safari has no such event, so it gets a one-time hint
// about Share -> "Lägg till på hemskärmen". Nothing is rendered when the app
// already runs installed (standalone).

const KEY_IOS_HINT = 'advent.iosHintDismissed';

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Ignore: the hint may show again, which is harmless.
  }
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// Safari on iPhone/iPad. iPadOS reports itself as a Mac, so check for touch too.
// Other iOS browsers (Chrome, Firefox, Edge) are excluded: the hint describes Safari's menu.
export function isIosSafari(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  return ios && safari;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Safari's share symbol: a box with an arrow pointing up.
function shareIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'install-hint-share');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6v11h12V10h-2');
  svg.append(path);
  return svg;
}

// The saved beforeinstallprompt event, shared by the header button and Tomten's intro.
let deferredPrompt = null;
const installListeners = new Set();

function setDeferredPrompt(event) {
  deferredPrompt = event;
  for (const listener of installListeners) listener();
}

// True while the browser lets us show its install prompt.
export function canInstall() {
  return deferredPrompt !== null;
}

// Calls `listener` whenever canInstall() may have changed. Returns an unsubscribe function.
export function onInstallChange(listener) {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}

// Shows the browser's install prompt. Resolves with 'accepted', 'dismissed' or null.
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return null;
  setDeferredPrompt(null); // a prompt can only be used once
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  return choice?.outcome ?? null;
}

function setupInstallButton(container) {
  let btn = null;

  // The button follows the prompt: shown while one is available, gone once used.
  onInstallChange(() => {
    if (!canInstall()) {
      btn?.remove();
      btn = null;
      return;
    }
    if (btn) return;
    btn = el('button', 'install-btn', 'Installera');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Installera appen på hemskärmen');
    btn.addEventListener('click', () => promptInstall());
    container.append(btn);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // show our own button instead of the browser's mini bar
    setDeferredPrompt(event);
  });

  window.addEventListener('appinstalled', () => setDeferredPrompt(null));
}

function showIosHint() {
  if (readFlag(KEY_IOS_HINT)) return;

  const hint = el('aside', 'install-hint');
  hint.setAttribute('role', 'dialog');
  hint.setAttribute('aria-labelledby', 'install-hint-title');
  const title = el('p', 'install-hint-title', 'Lägg kalendern på hemskärmen');
  title.id = 'install-hint-title';
  const text = el('p', 'install-hint-text');
  text.append('Tryck på Dela ', shareIcon(), ' och sedan ”Lägg till på hemskärmen”.');
  const ok = el('button', 'btn btn-primary', 'Okej');
  ok.type = 'button';
  ok.addEventListener('click', () => {
    writeFlag(KEY_IOS_HINT);
    hint.remove();
  });
  hint.append(title, text, ok);
  document.body.append(hint);
}

export function setupInstall({ container }) {
  if (isStandalone()) return;
  setupInstallButton(container);
  if (isIosSafari()) showIosHint();
}

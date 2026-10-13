// Thin wrapper around localStorage. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the app must still work.

const KEY_OPENED = 'advent.opened';

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
  try {
    const list = JSON.parse(read(KEY_OPENED) ?? '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function markOpened(id) {
  const opened = getOpened();
  opened.add(id);
  write(KEY_OPENED, JSON.stringify([...opened]));
}

// Dev mode: a log of how long a press takes to be heard and seen (milestone 14).
//
// Every timestamp is performance.now() (the same clock as event.timeStamp and the
// requestAnimationFrame timestamp), in ms. One entry per press:
//   down      pointerdown on the door (event.timeStamp)
//   sfx       sfx.play was called
//   start     when the sound is due on the performance clock (from its scheduled
//             AudioContext time), heard: plus baseLatency and outputLatency
//   frame     the opening animation's first frame
// Nothing is recorded until dev mode turns the log on, and nothing here touches the DOM.

const MAX_ENTRIES = 30;

const log = {
  enabled: false,
  entries: [], // newest first
  current: null,
  presses: 0, // since the app started, also while the log was off
  listeners: new Set(),
};

const notify = () => {
  for (const listener of log.listeners) listener();
};

export function enableLatencyLog() {
  log.enabled = true;
}

export const latencyEnabled = () => log.enabled;

/** Calls listener whenever an entry changes. Returns an unsubscribe function. */
export function onLatency(listener) {
  log.listeners.add(listener);
  return () => log.listeners.delete(listener);
}

export const latencyEntries = () => log.entries;

export function clearLatency() {
  log.entries = [];
  log.current = null;
  notify();
}

/** A press starts: label (e.g. the door's date) and the event's timeStamp. */
export function notePress(label, eventTime = performance.now(), extra = {}) {
  log.presses++;
  if (!log.enabled) return;
  log.current = { label, down: eventTime, handler: performance.now(), firstPress: log.presses === 1, ...extra };
  log.entries.unshift(log.current);
  log.entries.length = Math.min(log.entries.length, MAX_ENTRIES);
  notify();
}

/**
 * sfx.play scheduled a sound: { name, source, calledAt, at, currentTime, baseLatency,
 * outputLatency, state } (AudioContext times in seconds, calledAt from performance.now()). Only the
 * first effect of a press is kept (a treasure hunt's fanfare comes later on purpose).
 */
export function noteSfx(info) {
  if (!log.enabled) return;
  const entry = log.current;
  if (!entry || entry.sfx !== undefined) return;
  const now = performance.now();
  entry.sfx = info.calledAt ?? now;
  entry.build = now - entry.sfx; // building the nodes (or picking the buffer) on the main thread
  entry.effect = info.name;
  entry.source = info.source;
  entry.state = info.state;
  entry.currentTime = info.currentTime;
  entry.at = info.at;
  entry.baseLatency = info.baseLatency ?? null;
  entry.outputLatency = info.outputLatency ?? null;
  // The audio clock's distance to the start, from now. (getOutputTimestamp() is not used:
  // headless and freshly started outputs report times far off.)
  const lead = (info.at - info.currentTime) * 1000;
  entry.start = now + lead;
  entry.heard = entry.start + ((entry.baseLatency ?? 0) + (entry.outputLatency ?? 0)) * 1000;
  notify();
}

/** The opening animation's first frame (a requestAnimationFrame timestamp). */
export function noteFrame(time = performance.now()) {
  if (!log.enabled) return;
  const entry = log.current;
  if (!entry || entry.frame !== undefined) return;
  entry.frame = time;
  notify();
}

/** Anything else worth a column (e.g. when the card appeared). */
export function noteExtra(key, value = performance.now()) {
  if (!log.enabled || !log.current) return;
  log.current[key] ??= value;
  notify();
}

/** An entry as rounded ms from the pointerdown: { sfx, start, heard, frame, card, build, soundMinusFrame }. */
export function summarize(entry) {
  const since = (t) => (typeof t === 'number' ? Math.round(t - entry.down) : null);
  return {
    sfx: since(entry.sfx),
    start: since(entry.start),
    heard: since(entry.heard),
    frame: since(entry.frame),
    card: since(entry.card),
    build: typeof entry.build === 'number' ? Math.round(entry.build * 10) / 10 : null,
    soundMinusFrame: typeof entry.heard === 'number' && typeof entry.frame === 'number' ? Math.round(entry.heard - entry.frame) : null,
  };
}

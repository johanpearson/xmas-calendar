// Sound. Everything is synthesised with the Web Audio API (oscillators, noise, filters
// and envelopes): no audio files, no dependencies.
//
// The top of this file is pure logic (notes, melodies, the mixer rules) so node --test
// can import it; nothing here touches window or AudioContext at import time.

import { renderVoice, catSpec } from './voice.js';
import { TOMTE_JINGLE, MELODIES, MELODY_KEYS, MIX_GAP, toSong, themeSong, songFor, nextChoice, parseMusicChoice } from './melodies.js';
import { noteSfx } from './latency.js';

// --- Notes and melodies ---

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const REST = 'R';

/** "A4" -> 440, "C#5"/"Db5" -> 554.37... Rests ("R") give null. Throws on anything else. */
export function noteToFrequency(name) {
  if (name === REST) return null;
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(String(name));
  if (!match) throw new Error(`Unknown note "${name}"`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const midi = (Number(octave) + 1) * 12 + SEMITONES[letter] + shift;
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * One voice of a melody, [[note, beats], ...], to timed events in seconds:
 * [{ note, freq, time, duration }]. Rests only move time on.
 */
export function voiceToEvents(voice, bpm) {
  const beat = 60 / bpm;
  const events = [];
  let time = 0;
  for (const [note, beats] of voice) {
    const duration = beats * beat;
    const freq = noteToFrequency(note);
    if (freq !== null) events.push({ note, freq, time, duration });
    time += duration;
  }
  return events;
}

/** Length of a voice in seconds (until its last note or rest ends). */
export function voiceSeconds(voice, bpm) {
  return (voice.reduce((sum, [, beats]) => sum + beats, 0) * 60) / bpm;
}

/** All voices of a song as one list of events sorted by time. Each event has its voice index. */
export function songToEvents(song, bpm = song.bpm) {
  return song.voices
    .flatMap((voice, index) => voiceToEvents(voice, bpm).map((e) => ({ ...e, voice: index })))
    .sort((a, b) => a.time - b.time || a.voice - b.voice);
}

export function songSeconds(song, bpm = song.bpm) {
  return Math.max(...song.voices.map((voice) => voiceSeconds(voice, bpm)));
}

// Tomten's jingle (the melodies themselves are data in melodies.js).
export const JINGLE = toSong(TOMTE_JINGLE);

// The door's theme song plays once and never for longer than this (seconds).
export const THEME_MAX_SECONDS = 20;

// --- Effects ---

// Every effect with its name in the dev panel. The door effects are the ones made for
// the "sound" field in days.json, the type effects are what doors without one get (from
// their opening animation) and the global ones belong to the app's own events.
export const EFFECT_LABELS = {
  bells: 'Bjällror',
  twinkle: 'Tindrande glitter',
  cat: 'Katt som jamar',
  sneak: 'Smygande staccato',
  camera: 'Kamera med blixt',
  paper: 'Pappersprassel',
  candy: 'Godisklirr',
  chime: 'Mjukt ding',
  splat: 'Lågt plask',
  pop: 'Korkpopp med bubblor',
  mystery: 'Mystisk stigande ton',
  popcorn: 'Popcorn',
  glogg: 'Glögg som hälls upp',
  bingo: 'Rasslande bingokulor',
  unwrap: 'Paket som öppnas',
  sparkle: 'Pling och arpeggio',
  gift: 'Pop och glitter',
  search: 'Sökarsvep och ding',
  sleigh: 'Släde som sveper förbi',
  knock: 'Knack (låst lucka)',
  fanfare: 'Fanfar (jakt)',
  click: 'Klick (Nästa)',
};

export const DOOR_EFFECTS = ['bells', 'twinkle', 'cat', 'sneak', 'camera', 'paper', 'candy', 'chime', 'splat', 'pop', 'mystery', 'popcorn', 'glogg', 'bingo', 'unwrap'];
export const TYPE_EFFECTS = ['sparkle', 'gift', 'search'];
export const GLOBAL_EFFECTS = ['sleigh', 'knock', 'fanfare', 'click'];
export const EFFECTS = [...DOOR_EFFECTS, ...TYPE_EFFECTS, ...GLOBAL_EFFECTS];

export const isEffect = (name) => EFFECTS.includes(name);

// The opening animation (themes.js / the "animation" field in days.json) -> its sound,
// for doors without a "sound" of their own.
const ANIMATION_SOUNDS = {
  sparkle: 'sparkle',
  ribbon: 'sparkle',
  snowburst: 'sparkle',
  gift: 'gift',
  confetti: 'gift',
  bells: 'bells',
  magnifier: 'search',
};

export function soundForAnimation(animation) {
  return ANIMATION_SOUNDS[animation] ?? 'sparkle';
}

/** A door's opening sound: its own "sound" if that is a known effect, else its animation's. */
export function soundForDoor(day, animation) {
  return isEffect(day?.sound) ? day.sound : soundForAnimation(animation);
}

// A treasure hunt ends with a fanfare when its door opens, after the door's own sound.
export const FANFARE_DELAY = 1.1;
export const fanfareFor = (day) => day?.type === 'jakt';

// --- Mixer rules ---

export const MASTER_GAIN = 0.25;
export const MUSIC_GAIN = 0.8; // relative to the master: the background music, clearly audible but below the effects
export const RESUME_GAP = 1.5; // seconds of quiet before the music comes back after a pause

/**
 * Pausing: `pauses` maps what pauses the background music (a theme song, Tomten) to
 * when it ends, on the AudioContext's clock. Returns when the music may start again,
 * or null when nothing pauses it now.
 */
export function pausedUntil(pauses, now) {
  const ends = [...pauses.values()].filter((end) => end > now);
  return ends.length ? Math.max(...ends) + RESUME_GAP : null;
}

/** A stored on/off value ("on" | "off") to a boolean, `fallback` for anything else. */
export function parseToggle(value, fallback) {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return fallback;
}

/**
 * What the engine should do for a given state.
 *  soundOn   the sound button (off means completely silent, music included)
 *  musicOn   the music menu is on something other than "Av"
 *  unlocked  a user gesture has allowed audio
 *  visible   the page is in the foreground
 * Returns { master, running, effects, music }: the master gain, whether the AudioContext
 * should run, and whether effects and music may play.
 */
export function mixFor({ soundOn, musicOn, unlocked, visible }) {
  const running = Boolean(soundOn && unlocked && visible);
  return {
    master: soundOn ? MASTER_GAIN : 0,
    running,
    effects: running,
    music: running && Boolean(musicOn),
  };
}

// --- Scheduling (milestone 14) ---
//
// An effect is started on the audio clock, a hair ahead (LOOKAHEAD) so the audio thread
// never gets a start time that has already passed, and never with setTimeout. A running
// context is never awaited; a suspended one is asked to resume and the sound waits on
// its clock (which stands still until then). A prerendered buffer is one
// AudioBufferSourceNode; without one the effect is synthesised on the spot (fallback).

export const LOOKAHEAD = 0.005; // seconds
export const DUCK_RAMP = 0.08; // seconds: the background music fades this fast for a theme song or Tomten

/** What playing needs: { resume } a context that is not running, { source } 'buffer' or 'live'. */
export function planPlayback({ state, hasBuffer }) {
  return { resume: state !== 'running', source: hasBuffer ? 'buffer' : 'live' };
}

/** When an effect starts on the audio clock: now (ctx.currentTime) + LOOKAHEAD + delay (seconds). */
export function effectStartTime({ now, delay = 0 }) {
  return now + LOOKAHEAD + Math.max(0, delay);
}

/**
 * Starts one effect on ctx, synchronously: { buffer } plays as a buffer source, else
 * live(dest, at) synthesises it. Everything goes through its own gain into dest, so the
 * returned handle can stop it ({ at, source, stop(fade) }).
 */
export function startEffect(ctx, { buffer = null, dest, delay = 0, live }) {
  const plan = planPlayback({ state: ctx.state, hasBuffer: Boolean(buffer) });
  if (plan.resume) Promise.resolve(ctx.resume?.()).catch(() => {}); // never awaited
  const at = effectStartTime({ now: ctx.currentTime, delay });
  const out = ctx.createGain();
  out.connect(dest);
  let src = null;
  if (plan.source === 'buffer') {
    src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    src.start(at);
    src.onended = () => out.disconnect();
  } else live(out, at);
  return {
    at,
    source: plan.source,
    stop(fade = 0.04) {
      try {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + fade);
        src?.stop(t + fade + 0.01);
      } catch {
        // Already stopped or the context is gone.
      }
    },
  };
}

// Prerendering: low sample rates keep the buffers small (an effect of 1.5 s in stereo
// at 22050 Hz is about 260 kB); the sleigh bells get a little more for their shimmer.
export const RENDER_RATE = 22050;
export const RENDER_RATES = { bells: 32000, sleigh: 32000 };
export const MAX_THEME_BUFFERS = 2; // theme songs are long (up to 20 s): only the latest ones are kept

/**
 * The order in which sounds are prerendered: today's door first, then the app's own
 * effects, the doors already unlocked (newest first), Tomten's sleigh and jingle and
 * last the theme songs (today's first). doors: [{ date, effect, fanfare, music }].
 * Locked doors are left out. Keys: "effect:<name>", "jingle", "theme:<melody>".
 */
export function prerenderOrder(doors, today) {
  const unlocked = doors.filter((d) => d.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const todays = unlocked.filter((d) => d.date === today);
  const effectsOf = (d) => [d.effect, d.fanfare && 'fanfare'].filter(Boolean).map((name) => `effect:${name}`);
  const keys = [
    ...todays.flatMap(effectsOf),
    'effect:knock',
    'effect:chime',
    'effect:click',
    ...unlocked.flatMap(effectsOf),
    'effect:sleigh',
    'jingle',
    ...unlocked.filter((d) => d.music).map((d) => `theme:${d.music}`),
  ];
  return [...new Set(keys)];
}

/**
 * The sounds prerendered already before the first tap: today's door only. Elin's first
 * tap of the day is usually on that door, and without its buffer the sound would be
 * synthesised during the tap. (An offline context needs no user gesture.)
 */
export function startupKeys(doors, today) {
  return prerenderOrder(doors.filter((d) => d.date === today), today).filter((key) => key.startsWith('effect:') && !['effect:knock', 'effect:chime', 'effect:click'].includes(key));
}

// --- The engine (browser only) ---
//
// Signal path: effects -> fx bus ┐
//              jingle -> its own gain ┼-> master (0.25, 0 when off) -> speakers
//              music -> music bus ────┘
// The AudioContext is created on the first user gesture (autoplay rules) and only while
// the sound is on, suspended while the page is hidden or the sound is off, and every
// entry point swallows errors: sound is a bonus and must never break the calendar.

const MUSIC_GAP = 6; // seconds of silence before one chosen song plays again (the mix: MIX_GAP)
const JINGLE_DELAY = 1.4; // Tomten's entrance: the sleigh passes by, then his jingle starts
// User gestures. pointerdown comes first, so the context exists (and wakes up) before the
// door's own pointerdown handler plays anything. On a phone's very first touch it is not
// yet a user activation: the context then starts on pointerup or touchend of that tap.
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

const engine = {
  prefs: null,
  ctx: null,
  master: null,
  fx: null,
  musicBus: null,
  noise: new Map(), // sample rate -> a second of white noise
  bells: new Map(), // sample rate -> the sleigh bell bank
  soundOn: true,
  musicChoice: 'off', // the music menu: "off", "mix" or a melody key
  unlocked: false,
  visible: true,
  pendingJingle: false, // Tomten appeared before the first tap: play his jingle on it
  jingle: null, // { gain }
  theme: null, // { key, gain, end, timer }
  pauses: new Map(), // what pauses the music -> when it ends (see pausedUntil)
  buffers: new Map(), // prerendered sounds: key (see prerenderOrder) -> AudioBuffer
  renderPlan: () => [], // the keys to prerender, in order (set by the app)
  startupPlan: () => [], // the few allowed before the first tap
  rendering: false,
  renderFailed: new Set(),
  music: { bus: null, until: 0, timer: null, current: null, previous: null, paused: false },
  listeners: new Set(),
};

const AudioContextClass = () => globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
const OfflineContextClass = () => globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext ?? null;

// The context the synthesis building blocks build on: the live one, or an offline one
// while a sound is being prerendered (see renderOffline).
let building = null;
const ac = () => building ?? engine.ctx;

export function audioSupported() {
  return AudioContextClass() !== null;
}

// Runs fn and swallows anything it throws (no Web Audio, a closed context, ...).
function safely(fn) {
  try {
    return fn();
  } catch (err) {
    console.warn('Sound failed', err);
    return undefined;
  }
}

const state = () => ({
  soundOn: engine.soundOn,
  musicOn: engine.musicChoice !== 'off',
  unlocked: engine.unlocked,
  visible: engine.visible,
});

const notify = () => {
  for (const listener of engine.listeners) safely(listener);
};

function bus(gain, destination) {
  const node = engine.ctx.createGain();
  node.gain.value = gain;
  node.connect(destination);
  return node;
}

// Creates the context and the buses. Only ever called from a user gesture.
function ensureContext() {
  if (engine.ctx) return true;
  const Ctor = AudioContextClass();
  if (!Ctor) return false;
  const ctx = new Ctor({ latencyHint: 'interactive' });
  engine.ctx = ctx;
  // A limiter last in the chain, so overlapping sounds never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 4;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);
  engine.master = bus(MASTER_GAIN, limiter); // only ever created with the sound on
  engine.fx = bus(1, engine.master);
  engine.musicBus = bus(MUSIC_GAIN, engine.master);
  // Older iOS only unlocks output once something has played inside the gesture.
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start(0);
  pumpRenders(); // prerender in idle moments from now on
  ctx.addEventListener?.('statechange', () => {
    if (ctx.state === 'running') flushPending();
  });
  return true;
}

function setGain(node, value, seconds = 0.08) {
  const t = engine.ctx.currentTime;
  node.gain.cancelScheduledValues(t);
  node.gain.setValueAtTime(node.gain.value, t);
  node.gain.linearRampToValueAtTime(value, t + seconds);
}

// Applies mixFor() to the context, the master gain and the music.
function apply() {
  const mix = mixFor(state());
  const { ctx } = engine;
  if (ctx) {
    setGain(engine.master, mix.master);
    if (mix.running && ctx.state !== 'running') ctx.resume().then(flushPending, () => {});
    else if (!mix.running && ctx.state === 'running') ctx.suspend().catch(() => {});
    else if (mix.running) flushPending();
  }
  if (engine.soundOn && engine.musicChoice !== 'off' && engine.unlocked) {
    if (mix.music) startMusic();
    else clearTimeout(engine.music.timer); // hidden: the suspended context holds the music
  } else stopMusic();
  notify();
}

function flushPending() {
  if (!engine.pendingJingle || !mixFor(state()).effects) return;
  engine.pendingJingle = false;
  playJingle();
}

// Allows audio after a user gesture. Does nothing while the sound is off, so a muted
// calendar never creates an AudioContext at all.
function unlock() {
  if (!engine.soundOn) return;
  if (!ensureContext()) return;
  if (engine.unlocked && engine.ctx.state === 'running') return;
  engine.unlocked = true;
  apply();
}

/**
 * Starts the sound system with the saved settings and today's date (for the mix):
 * { getSoundOn, setSoundOn, getMusicChoice, setMusicChoice, today }.
 */
export function initAudio(prefs) {
  safely(() => {
    engine.prefs = prefs;
    engine.soundOn = prefs.getSoundOn();
    engine.musicChoice = parseMusicChoice(prefs.getMusicChoice());
    engine.visible = document.visibilityState !== 'hidden';
    if (!audioSupported()) return;
    const onGesture = (e) => {
      if (e.key !== 'Escape') safely(unlock); // Esc is no user activation
    };
    for (const type of GESTURES) document.addEventListener(type, onGesture, { capture: true, passive: true });
    // On the window in the capture phase: runs before the app's own visibilitychange work,
    // so the context is already waking up while the calendar refreshes.
    const onVisibility = () =>
      safely(() => {
        engine.visible = document.visibilityState !== 'hidden';
        apply();
      });
    window.addEventListener('visibilitychange', onVisibility, { capture: true });
    window.addEventListener('pageshow', onVisibility);
  });
}

/** Calls listener whenever a setting or the audio state changes. Returns an unsubscribe function. */
export function onAudioChange(listener) {
  engine.listeners.add(listener);
  return () => engine.listeners.delete(listener);
}

export const isSoundOn = () => engine.soundOn;
export const getMusicChoice = () => engine.musicChoice;
export const isMusicOn = () => engine.musicChoice !== 'off';

/** True while the background music waits for a theme song or Tomten to finish. */
export const isMusicPaused = () => Boolean(engine.music.bus && engine.music.paused);

/** The title of the song playing (or last played, in the pause between songs), or null. */
export function nowPlaying() {
  const key = engine.music.bus ? engine.music.current : null;
  return key ? MELODIES[key].title : null;
}

/** The music menu: "Av", "Blandat" and every melody, as { choice, label }. */
export const MUSIC_MENU = [
  { choice: 'off', label: 'Av' },
  { choice: 'mix', label: 'Blandat' },
  ...MELODY_KEYS.map((key) => ({ choice: key, label: MELODIES[key].title })),
];

// Turning the sound off silences everything at once, also sounds already playing.
function silence() {
  engine.pendingJingle = false;
  stopJingle(0.05);
  stopTheme(0.05);
  stopMusic(0.05);
  if (engine.ctx) {
    engine.fx.disconnect();
    engine.fx = bus(1, engine.master);
  }
}

/** The sound button. Call from a click handler: turning it on unlocks audio. */
export function setSound(on) {
  safely(() => {
    engine.soundOn = Boolean(on);
    engine.prefs?.setSoundOn(engine.soundOn);
    if (engine.soundOn) {
      unlock();
      playEffect('click');
    } else silence();
    apply();
  });
}

/**
 * The music menu: "off", "mix" or a melody key (saved). Picking music turns the sound
 * on too (music needs it). A new choice starts at once, also the same one again.
 */
export function setMusicChoice(choice) {
  safely(() => {
    engine.musicChoice = parseMusicChoice(choice);
    engine.prefs?.setMusicChoice(engine.musicChoice);
    stopMusic(0.3);
    if (engine.musicChoice !== 'off') {
      if (!engine.soundOn) {
        engine.soundOn = true;
        engine.prefs?.setSoundOn(true);
      }
      unlock();
    }
    apply();
  });
}

/** "Nästa låt": another song from the mix, or the next one in the list. */
export function nextSong() {
  safely(() => {
    if (engine.musicChoice === 'off') return;
    if (engine.musicChoice === 'mix') {
      stopMusic(0.3);
      apply();
    } else setMusicChoice(nextChoice(engine.musicChoice));
  });
}

// --- Synthesis building blocks ---

const rand = (min, max) => min + Math.random() * (max - min);

// A shared second of white noise for knocks, whooshes and the sleigh bells' shimmer
// (one per sample rate: the live context and the offline renderer differ).
function noiseBuffer() {
  const ctx = ac();
  let buffer = engine.noise.get(ctx.sampleRate);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    engine.noise.set(ctx.sampleRate, buffer);
  }
  return buffer;
}

// An envelope: a soft attack to `peak`, then an exponential decay to silence at t + dur.
function envelope(t, dur, peak, attack) {
  const gain = ac().createGain();
  gain.gain.value = 0; // silent until t, not the default 1
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return gain;
}

// One oscillator through an envelope. freqTo glides the pitch over the note.
function tone(dest, { t, freq, dur, type = 'sine', peak = 0.2, attack = 0.005, freqTo = null }) {
  const ctx = ac();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.frequency.setValueAtTime(freq, t);
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const gain = envelope(t, dur, peak, attack);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  osc.onended = () => gain.disconnect();
}

// Filtered noise through an envelope. `sweep` is a list of [time offset, frequency].
function noise(dest, { t, dur, peak = 0.2, attack = 0.003, filter = 'bandpass', freq = 1000, q = 1, sweep = null }) {
  const ctx = ac();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  // Set right away too: a filter jumping from its default 350 Hz at t clicks loudly.
  biquad.frequency.value = freq;
  biquad.frequency.setValueAtTime(freq, t);
  for (const [offset, f] of sweep ?? []) biquad.frequency.exponentialRampToValueAtTime(f, t + offset);
  const gain = envelope(t, dur, peak, attack);
  src.connect(biquad).connect(gain).connect(dest);
  src.start(t, rand(0, 0.5));
  src.stop(t + dur + 0.05);
  src.onended = () => gain.disconnect();
}

const BELL_BANK_RATE = 32000;

// A small set of single sleigh bell strikes, synthesised once into buffers. Each bell
// has its own inharmonic partials, each doubled a little sharp so it shimmers (beats),
// and starts with the click of its pellet. Playing many of them with slightly different
// speeds, levels and pans sounds like a real shake instead of one tone repeated.
// One bank per sample rate; partials above the rate's Nyquist limit are left out.
function bellBank() {
  const ctx = ac();
  // The live bank is made at most at BELL_BANK_RATE: it may be made during the very first
  // tap (before anything is prerendered), and half the samples take half the time.
  const rate = Math.min(ctx.sampleRate, BELL_BANK_RATE);
  if (engine.bells.has(rate)) return engine.bells.get(rate);
  const length = Math.floor(rate * 0.5);
  const fadeFrom = Math.floor(length * 0.8);
  const PARTIALS = [[1, 1, 0.16], [1.52, 0.65, 0.12], [2.03, 0.5, 0.09], [2.71, 0.35, 0.07], [3.39, 0.22, 0.05], [4.18, 0.14, 0.035]];
  const bank = Array.from({ length: 6 }, () => {
    const base = rand(2400, 3600);
    // Each partial is two sines (the second a little sharp, so they beat) that decay
    // exponentially. Computed by rotation and multiplication per sample rather than
    // Math.sin and Math.exp: several times faster, the same sound.
    const oscs = [];
    for (const [ratio, level, tau] of PARTIALS) {
      if (base * ratio * 1.04 >= rate * 0.45) continue; // above the Nyquist limit
      const w = 2 * Math.PI * base * ratio * rand(0.97, 1.03);
      const phase = rand(0, 2 * Math.PI);
      const beat = rand(1.002, 1.006);
      const decay = Math.exp(-1 / (tau * rand(0.7, 1.3) * rate));
      const amp = level * rand(0.7, 1);
      // [cos, sin, step cos, step sin, amplitude, decay]
      oscs.push([Math.cos(phase), Math.sin(phase), Math.cos(w / rate), Math.sin(w / rate), amp, decay]);
      oscs.push([1, 0, Math.cos((w * beat) / rate), Math.sin((w * beat) / rate), amp * 0.5, decay]);
    }
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    const click = Math.exp(-1 / (0.004 * rate)); // the pellet's click dies in a few ms
    let clickLevel = 0.8;
    let peak = 0;
    for (let i = 0; i < length; i++) {
      let v = 0;
      if (clickLevel > 1e-5) {
        v = (Math.random() * 2 - 1) * clickLevel;
        clickLevel *= click;
      }
      for (const o of oscs) {
        v += o[4] * o[1];
        const c = o[0] * o[2] - o[1] * o[3];
        o[1] = o[1] * o[2] + o[0] * o[3];
        o[0] = c;
        o[4] *= o[5];
      }
      if (i > fadeFrom) v *= (length - i) / (length - fadeFrom);
      data[i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
    for (let i = 0; i < length; i++) data[i] /= peak;
    return buffer;
  });
  engine.bells.set(rate, bank);
  return bank;
}

// One bell from the bank at time t, with a level (0-1), a stereo position (-1 to 1) and
// a playback speed (higher is brighter).
function jingleHit(dest, t, level, pan, rate = rand(0.94, 1.08)) {
  const ctx = ac();
  const bells = bellBank();
  const src = ctx.createBufferSource();
  src.buffer = bells[Math.floor(Math.random() * bells.length)];
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = 0.11 * level;
  src.connect(gain);
  if (ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner).connect(dest);
  } else gain.connect(dest);
  src.start(t);
  src.onended = () => gain.disconnect();
}

// A small bell: a few inharmonic partials, the higher ones dying faster.
function bell(dest, t, freq, { peak = 0.12, dur = 0.6 } = {}) {
  [[1, 1, 1], [2.76, 0.4, 0.55], [5.4, 0.2, 0.3], [8.93, 0.08, 0.18]].forEach(([ratio, level, length]) =>
    tone(dest, { t, freq: freq * ratio, dur: dur * length, peak: peak * level, attack: 0.002 }),
  );
}

// Tiny high plinks scattered over a time window: glitter.
function glitter(dest, t, { count = 8, over = 0.6, peak = 0.035 } = {}) {
  const notes = ['C7', 'D7', 'E7', 'G7', 'A7', 'C8'].map(noteToFrequency);
  for (let i = 0; i < count; i++) {
    const at = t + (over * i) / count + rand(0, over / count);
    tone(dest, { t: at, freq: notes[Math.floor(Math.random() * notes.length)], dur: rand(0.12, 0.25), peak: peak * rand(0.6, 1), attack: 0.002 });
  }
}

// A celesta / music box tine: a triangle and a sine an octave up with a bell-like decay,
// plus a faint inharmonic partial that dies fast, like a struck metal bar.
function musicBoxNote(dest, t, freq, { peak = 0.16, ring = 1.1 } = {}) {
  tone(dest, { t, freq, dur: ring, type: 'triangle', peak, attack: 0.006 });
  tone(dest, { t, freq: freq * 2, dur: ring * 0.5, peak: peak * 0.3, attack: 0.004 });
  tone(dest, { t, freq: freq * 4.2, dur: 0.12, peak: peak * 0.07, attack: 0.002 });
}

// The quiet bass note on a bar's first beat: a warm sine with a soft decay.
function bassNote(dest, t, freq, { peak = 0.07, dur = 1.2 } = {}) {
  tone(dest, { t, freq, dur, peak, attack: 0.02 });
  tone(dest, { t, freq: freq * 2, dur: dur * 0.4, type: 'triangle', peak: peak * 0.25, attack: 0.015 });
}

// Schedules a whole song on `dest` from time t: the melody on the music box, the bass
// note of each bar and, unless the song says otherwise, a soft sleigh bell on the beats
// after the first in each bar. Returns its length in seconds.
function playSong(dest, t, song, bpm = song.bpm, { peak = 0.16 } = {}) {
  const beat = 60 / bpm;
  for (const e of songToEvents(song, bpm)) {
    if (e.voice === 0) {
      const ring = Math.min(1.6, Math.max(0.6, e.duration * 2.4));
      musicBoxNote(dest, t + e.time, e.freq, { peak, ring });
    } else bassNote(dest, t + e.time, e.freq, { peak: peak * 0.45, dur: Math.min(1.8, Math.max(0.5, e.duration)) });
  }
  if (song.bells && song.barStarts) {
    const length = songSeconds(song, bpm);
    for (const start of song.barStarts) {
      for (let b = 1; b < (song.meter ?? 4); b++) {
        const at = t + (start + b) * beat;
        if (at - t >= length - 0.05) break;
        jingleHit(dest, at + rand(0, 0.012), rand(0.12, 0.2), rand(-0.4, 0.4));
      }
    }
  }
  return songSeconds(song, bpm);
}

// --- More building blocks for the effects ---

// A stereo position for whatever is connected to the returned node (-1 left, 1 right).
function pannedTo(dest, pan) {
  const ctx = ac();
  if (!ctx.createStereoPanner) return dest;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  panner.connect(dest);
  return panner;
}

// A gain that rises to `peak`, holds and then fades out: for sounds that sustain.
function sustained(t, dur, peak, attack, release) {
  const gain = ac().createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return gain;
}

// An oscillator into `into` (usually an envelope), with a pitch path (a list of
// [time offset, frequency]) and an optional vibrato ({ rate, depth } in Hz).
function voice(into, { t, dur, type = 'sine', path, vibrato = null }) {
  const ctx = ac();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = path[0][1];
  osc.frequency.setValueAtTime(path[0][1], t);
  for (const [offset, f] of path.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t + offset);
  const stops = [osc];
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.value = vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    stops.push(lfo);
  }
  osc.connect(into);
  for (const node of stops) {
    node.start(t);
    node.stop(t + dur + 0.05);
  }
  osc.onended = () => osc.disconnect();
}

// A biquad filter at a frequency (set right away, see noise()) with an optional sweep.
function filter(type, freq, q, t, sweep = []) {
  const biquad = ac().createBiquadFilter();
  biquad.type = type;
  biquad.Q.value = q;
  biquad.frequency.value = freq;
  biquad.frequency.setValueAtTime(freq, t);
  for (const [offset, f] of sweep) biquad.frequency.exponentialRampToValueAtTime(f, t + offset);
  return biquad;
}

// Paper rustling: many short bursts of band-passed noise at random pitches.
function rustle(dest, t, { over = 0.8, count = 16, peak = 0.12 } = {}) {
  for (let i = 0; i < count; i++) {
    const at = t + (over * i) / count + rand(0, over / count);
    noise(pannedTo(dest, rand(-0.4, 0.4)), {
      t: at,
      dur: rand(0.02, 0.08),
      peak: peak * rand(0.4, 1),
      attack: 0.002,
      freq: rand(2500, 7000),
      q: rand(0.8, 2),
    });
  }
}

// A brass note for the fanfare: two slightly detuned sawtooths through a low-pass filter
// that opens with the attack, like a lip buzz.
function brass(dest, t, freq, dur, peak) {
  const lowpass = filter('lowpass', freq * 1.5, 1.2, t, [[0.04, freq * 6], [dur, freq * 3]]);
  lowpass.connect(dest);
  const gain = sustained(t, dur, peak, 0.025, dur * 0.5);
  gain.connect(lowpass);
  for (const detune of [1, 1.004]) {
    voice(gain, { t, dur, type: 'sawtooth', path: [[0, freq * detune * 0.98], [0.03, freq * detune]] });
  }
}

// The cat is rendered in JavaScript (voice.js), which takes a few tens of milliseconds:
// it is normally played from the prerendered buffer (see prerender), this is the fallback.
const catSamples = (rate) => renderVoice(catSpec(), { rate });

// Plays samples rendered in JavaScript (voice.js) at time t and level `level`.
function playRendered(dest, t, samples, level) {
  const ctx = ac();
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = level;
  src.connect(gain).connect(dest);
  src.start(t);
  src.onended = () => gain.disconnect();
}

// --- The effects. Each takes the destination and a start time; all end within 2 s. ---

const SOUNDS = {
  // Sleigh bells: four humanised shakes of many small bells, then a few settling.
  bells(dest, t) {
    const accents = [0.7, 0.5, 0.65, 1];
    let shake = 0;
    accents.forEach((accent, i) => {
      const at = Math.max(t, t + shake + rand(-0.012, 0.012)); // never before t
      const sway = rand(-0.5, 0.5);
      // Most bells strike right at the start of the shake, a few trail behind.
      for (let j = 0; j < 14; j++) {
        jingleHit(dest, at + 0.07 * Math.random() ** 1.7, accent * rand(0.3, 1), sway + rand(-0.3, 0.3));
      }
      // The pellets rattling inside: a short breathy "chsh".
      noise(dest, { t: at, dur: 0.09, peak: 0.05 * accent, attack: 0.004, q: 0.7, freq: 7500 });
      shake += [0.16, 0.15, 0.19][i] ?? 0;
    });
    // The bells settle after the last shake.
    const end = t + shake + 0.06;
    for (let j = 0; j < 10; j++) {
      const k = j / 10;
      jingleHit(dest, end + 0.45 * k + rand(0, 0.03), 0.45 * (1 - k) * rand(0.5, 1), rand(-0.6, 0.6));
    }
  },

  // A sleigh passing by from left to right: shakes that swell and fade, a touch higher
  // on the way in and lower on the way out, over the hiss of the runners in the snow.
  sleigh(dest, t) {
    const shakes = 11;
    for (let i = 0; i < shakes; i++) {
      const k = i / (shakes - 1);
      const at = t + i * 0.12 + rand(0, 0.015);
      const pan = -0.9 + 1.8 * k;
      const level = 0.3 + 0.7 * Math.sin(Math.PI * k);
      const rate = 1.07 - 0.14 * k;
      for (let j = 0; j < 7; j++) {
        jingleHit(dest, at + 0.05 * Math.random() ** 1.5, level * rand(0.4, 1), pan + rand(-0.15, 0.15), rate * rand(0.97, 1.03));
      }
    }
    const runners = pannedTo(dest, -0.9);
    runners.pan?.linearRampToValueAtTime(0.9, t + 1.4);
    noise(runners, { t, dur: 1.5, peak: 0.035, attack: 0.6, freq: 2200, q: 0.6 });
  },






  // Two dull knocks: the door is locked.
  knock(dest, t) {
    [0, 0.17].forEach((offset, i) => {
      const at = t + offset;
      tone(dest, { t: at, freq: 190, freqTo: 90, dur: 0.16, peak: 0.45 - i * 0.08, attack: 0.002 });
      tone(dest, { t: at, freq: 430, freqTo: 300, dur: 0.05, type: 'triangle', peak: 0.1, attack: 0.001 });
      noise(dest, { t: at, dur: 0.035, peak: 0.14, filter: 'lowpass', freq: 700 });
    });
  },

  // A short fanfare: G C E and a long G, the last one with its chord.
  fanfare(dest, t) {
    [['G4', 0, 0.12], ['C5', 0.12, 0.12], ['E5', 0.24, 0.12], ['G5', 0.36, 0.75]].forEach(([note, offset, dur]) =>
      brass(dest, t + offset, noteToFrequency(note), dur, 0.09),
    );
    for (const note of ['C5', 'E5']) brass(dest, t + 0.36, noteToFrequency(note), 0.75, 0.04);
    glitter(dest, t + 0.4, { count: 6, over: 0.5, peak: 0.03 });
  },






  // A pling, then a glittering arpeggio upwards (ledtrad, rim).
  sparkle(dest, t) {
    bell(dest, t, noteToFrequency('C6'), { peak: 0.16, dur: 0.9 });
    ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'].forEach((note, i) =>
      tone(dest, { t: t + 0.14 + i * 0.065, freq: noteToFrequency(note), dur: 0.45, type: 'triangle', peak: 0.09 - i * 0.008, attack: 0.004 }),
    );
    glitter(dest, t + 0.45, { count: 7, over: 0.6 });
  },

  // A soft pop (a quick downward blip), then glitter (litet).
  gift(dest, t) {
    tone(dest, { t, freq: 620, freqTo: 150, dur: 0.12, peak: 0.3, attack: 0.003 });
    noise(dest, { t, dur: 0.05, peak: 0.08, filter: 'lowpass', freq: 1800 });
    glitter(dest, t + 0.1, { count: 9, over: 0.7, peak: 0.04 });
  },

  // A searching whoosh, zigzagging like the magnifier, then a ding: found it! (jakt)
  search(dest, t) {
    noise(dest, { t, dur: 0.78, peak: 0.16, attack: 0.12, q: 5, freq: 500, sweep: [[0.24, 2200], [0.46, 800], [0.7, 2600]] });
    bell(dest, t + 0.8, noteToFrequency('E6'), { peak: 0.18, dur: 0.62 });
  },

  // Twinkling stars: quick high notes rising, each with a tremble, over a faint shimmer.
  twinkle(dest, t) {
    ['E6', 'B6', 'G6', 'D7', 'B6', 'E7', 'G7'].forEach((note, i) => {
      const at = t + i * 0.09 + rand(0, 0.02);
      const freq = noteToFrequency(note);
      tone(pannedTo(dest, rand(-0.6, 0.6)), { t: at, freq, dur: 0.5, peak: 0.07, attack: 0.003 });
      tone(dest, { t: at, freq: freq * 1.006, dur: 0.35, type: 'triangle', peak: 0.025, attack: 0.003 });
    });
    tone(dest, { t, freq: 4186, dur: 1.1, peak: 0.012, attack: 0.3 });
    tone(dest, { t, freq: 4197, dur: 1.1, peak: 0.012, attack: 0.3 });
    glitter(dest, t + 0.6, { count: 6, over: 0.6, peak: 0.03 });
  },

  // A cat's "mjau", rendered by the voice synthesiser in voice.js.
  cat(dest, t) {
    playRendered(dest, t, catSamples(ac().sampleRate), 0.16);
  },



  // Tiptoeing: quiet staccato plucks in a minor key, each with a soft footstep.
  sneak(dest, t) {
    ['A3', 'C4', 'E4', 'C4', 'A3', 'R', 'E4', 'D#4'].forEach((note, i) => {
      if (note === 'R') return;
      const at = t + i * 0.15;
      const freq = noteToFrequency(note);
      tone(dest, { t: at, freq, dur: 0.09, type: 'triangle', peak: 0.22, attack: 0.003 });
      tone(dest, { t: at, freq: freq * 2, dur: 0.05, peak: 0.05, attack: 0.002 });
      noise(dest, { t: at, dur: 0.03, peak: 0.04, filter: 'lowpass', freq: 600 });
    });
  },

  // A camera: the shutter's click-clack and a flash pling, then the flash recharging.
  camera(dest, t) {
    noise(dest, { t, dur: 0.02, peak: 0.4, filter: 'highpass', freq: 2500, attack: 0.001 });
    tone(dest, { t, freq: 1400, freqTo: 900, dur: 0.03, type: 'square', peak: 0.04, attack: 0.001 });
    noise(dest, { t: t + 0.07, dur: 0.03, peak: 0.3, q: 1.5, freq: 1800, attack: 0.001 });
    bell(dest, t + 0.12, noteToFrequency('E7'), { peak: 0.06, dur: 0.4 });
    tone(dest, { t: t + 0.3, freq: 1500, freqTo: 7000, dur: 1.1, peak: 0.02, attack: 0.5 });
  },

  // Rustling paper: unfolding a letter.
  paper(dest, t) {
    rustle(dest, t, { over: 0.9, count: 18, peak: 0.24 });
    noise(dest, { t, dur: 1, peak: 0.03, attack: 0.2, filter: 'highpass', freq: 3000, q: 0.5 });
  },

  // Lots of little clinks: sweets in a bowl.
  candy(dest, t) {
    for (let i = 0; i < 14; i++) {
      const at = t + 0.85 * (i / 14) ** 1.3 + rand(0, 0.03);
      const freq = rand(2600, 4200);
      const out = pannedTo(dest, rand(-0.7, 0.7));
      tone(out, { t: at, freq, dur: rand(0.07, 0.16), peak: rand(0.07, 0.13), attack: 0.001 });
      tone(out, { t: at, freq: freq * 2.7, dur: 0.05, peak: 0.02, attack: 0.001 });
    }
  },

  // A soft ding, like a little bell on the table.
  chime(dest, t) {
    bell(dest, t, noteToFrequency('A5'), { peak: 0.13, dur: 1.7 });
    tone(dest, { t, freq: noteToFrequency('A4'), dur: 1.2, peak: 0.04, attack: 0.01 });
    bell(dest, t + 0.02, noteToFrequency('E6'), { peak: 0.035, dur: 1.2 });
  },

  // A low splash: noise through a low-pass filter sweeping down, a thump, then drips.
  splat(dest, t) {
    noise(dest, { t, dur: 0.45, peak: 0.35, attack: 0.004, filter: 'lowpass', freq: 4000, q: 1.5, sweep: [[0.06, 1200], [0.42, 180]] });
    tone(dest, { t, freq: 140, freqTo: 50, dur: 0.25, peak: 0.35, attack: 0.003 });
    [0.5, 0.72, 0.9].forEach((offset, i) =>
      tone(dest, { t: t + offset, freq: 700 + i * 150, freqTo: 1300 + i * 200, dur: 0.06, peak: 0.05, attack: 0.002 }),
    );
  },

  // A cork popping, then fizzing bubbles.
  pop(dest, t) {
    noise(dest, { t, dur: 0.03, peak: 0.4, freq: 1500, q: 1, attack: 0.001 });
    tone(dest, { t, freq: 900, freqTo: 250, dur: 0.07, peak: 0.3, attack: 0.001 });
    noise(dest, { t: t + 0.05, dur: 1.3, peak: 0.07, attack: 0.05, filter: 'highpass', freq: 5000, q: 0.7 });
    for (let i = 0; i < 16; i++) {
      const freq = rand(1800, 3500);
      tone(pannedTo(dest, rand(-0.5, 0.5)), { t: t + 0.1 + rand(0, 1.1) * (i / 16), freq, freqTo: freq * 1.5, dur: 0.03, peak: 0.05, attack: 0.002 });
    }
  },

  // A mysterious rising tone: two voices gliding up with a growing vibrato through an
  // opening filter, and a whole-tone scale twinkling above.
  mystery(dest, t) {
    const dur = 1.7;
    const lowpass = filter('lowpass', 500, 2, t, [[1.4, 3000]]);
    lowpass.connect(dest);
    const path = [[0, 220], [1.5, 659]];
    const sine = sustained(t, dur, 0.08, 0.4, 0.4);
    const triangle = sustained(t, dur, 0.045, 0.5, 0.4);
    sine.connect(lowpass);
    triangle.connect(lowpass);
    voice(sine, { t, dur, path, vibrato: { rate: 5, depth: 6 } });
    voice(triangle, { t, dur, type: 'triangle', path: path.map(([o, f]) => [o, f * 1.008]) });
    ['C6', 'D6', 'E6', 'F#6', 'G#6', 'A#6'].forEach((note, i) =>
      tone(dest, { t: t + 0.3 + i * 0.2, freq: noteToFrequency(note), dur: 0.4, type: 'triangle', peak: 0.03, attack: 0.004 }),
    );
  },

  // Popcorn: pops at random, sparse, then many, then a few late ones.
  popcorn(dest, t) {
    const times = Array.from({ length: 13 }, () => 1.4 * Math.sin((Math.PI / 2) * Math.random()) ** 1.5).sort((a, b) => a - b);
    for (const offset of times) {
      const at = t + offset;
      const out = pannedTo(dest, rand(-0.7, 0.7));
      noise(out, { t: at, dur: 0.025, peak: rand(0.15, 0.3), freq: rand(800, 2500), q: 2, attack: 0.001 });
      const freq = rand(300, 700);
      tone(out, { t: at, freq, freqTo: freq * 0.5, dur: 0.035, peak: 0.12, attack: 0.001 });
    }
  },

  // Mulled wine poured into a cup (a filling, rising gurgle) with bubbles gliding up.
  glogg(dest, t) {
    noise(dest, { t, dur: 1.05, peak: 0.2, attack: 0.08, q: 3, freq: 500, sweep: [[0.3, 900], [0.95, 1400]] });
    for (let i = 0; i < 14; i++) {
      const freq = rand(250, 500);
      tone(dest, { t: t + 0.1 + (1.2 * i) / 14 + rand(0, 0.05), freq, freqTo: freq * 2.2, dur: rand(0.04, 0.09), peak: 0.12, attack: 0.003 });
    }
  },

  // Bingo balls rattling in the drum, then a ding.
  bingo(dest, t) {
    for (let i = 0; i < 28; i++) {
      const at = t + rand(0, 1.05);
      const out = pannedTo(dest, rand(-0.5, 0.5));
      noise(out, { t: at, dur: 0.015, peak: rand(0.05, 0.15), freq: rand(1800, 4000), q: 4, attack: 0.001 });
      tone(out, { t: at, freq: rand(900, 1600), dur: 0.03, type: 'triangle', peak: 0.04, attack: 0.001 });
    }
    bell(dest, t + 1.15, noteToFrequency('G6'), { peak: 0.12, dur: 0.6 });
  },

  // Unwrapping a present: rustling paper, then a pling.
  unwrap(dest, t) {
    rustle(dest, t, { over: 0.6, count: 12, peak: 0.22 });
    bell(dest, t + 0.7, noteToFrequency('E6'), { peak: 0.12, dur: 0.8 });
    bell(dest, t + 0.82, noteToFrequency('G6'), { peak: 0.1, dur: 0.8 });
    glitter(dest, t + 0.85, { count: 6, over: 0.5, peak: 0.03 });
  },

  // A tiny click for "Nästa".
  click(dest, t) {
    noise(dest, { t, dur: 0.025, peak: 0.08, filter: 'highpass', freq: 3000, attack: 0.001 });
    tone(dest, { t, freq: 1900, dur: 0.035, peak: 0.06, attack: 0.001 });
  },
};

const ready = () => engine.ctx && mixFor(state()).effects;

/**
 * Plays one of EFFECTS, `delay` seconds from now on the audio clock: from its prerendered
 * buffer when it is ready, else synthesised on the spot. Silent (and harmless) before the
 * first tap, while hidden or when off. Returns a handle with stop(), or null.
 */
export function playEffect(name, delay = 0) {
  return (
    safely(() => {
      if (!ready() || !SOUNDS[name]) return null;
      const calledAt = performance.now();
      const { ctx } = engine;
      const handle = startEffect(ctx, {
        buffer: engine.buffers.get(`effect:${name}`) ?? null,
        dest: engine.fx,
        delay,
        live: (dest, at) => SOUNDS[name](dest, at),
      });
      noteSfx({ name, source: handle.source, calledAt, at: handle.at, ...clockInfo(ctx) });
      return handle;
    }) ?? null
  );
}

// The audio clock and its latencies, for the dev panel's latency log.
function clockInfo(ctx) {
  return {
    state: ctx.state,
    currentTime: ctx.currentTime,
    baseLatency: ctx.baseLatency,
    outputLatency: ctx.outputLatency,
  };
}

/** "none" before the first tap, else the AudioContext's state (dev panel). */
export const audioState = () => engine.ctx?.state ?? 'none';

/** The sound effects by name: sfx.play('cat'). */
export const sfx = { play: playEffect, names: EFFECTS, labels: EFFECT_LABELS };

/** The sound that goes with an opening animation (see soundForAnimation). */
export function playForAnimation(animation) {
  return playEffect(soundForAnimation(animation));
}

/** A door opens: its own sound or its animation's, and a fanfare for a treasure hunt. Returns the handles. */
export function playForDoor(day, animation) {
  const handles = [playEffect(soundForDoor(day, animation))];
  if (fanfareFor(day)) handles.push(playEffect('fanfare', FANFARE_DELAY));
  return handles.filter(Boolean);
}

// --- Prerendering ---
//
// Each sound in the app's plan (see prerenderOrder and setPrerenderPlan) is rendered once
// into an AudioBuffer with an OfflineAudioContext, one sound per idle moment, and kept.
// Playing it is then a single buffer source: no node graphs or noise built per play.

const idle = (fn) =>
  globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 50);

// Seconds to render for a key, the sample rate, the channels and how to build it at time t
// on dest. The songs are long and only their soft bells are panned: mono halves them.
function renderSpec(key) {
  const [kind, name] = key.split(':');
  if (kind === 'effect' && SOUNDS[name]) return { seconds: 2.4, rate: RENDER_RATES[name] ?? RENDER_RATE, build: (dest, t) => SOUNDS[name](dest, t) };
  if (kind === 'jingle') return { seconds: songSeconds(JINGLE) + 1.8, rate: RENDER_RATE, channels: 1, build: (dest, t) => playSong(dest, t, JINGLE) };
  if (kind === 'theme' && MELODIES[name]) {
    return { seconds: themeSeconds(MELODIES[name]) + 1.8, rate: RENDER_RATE, channels: 1, build: (dest, t) => themeGraph(dest, t, MELODIES[name]) };
  }
  return null;
}

// Old Safari's offline context answers with an event instead of a promise.
function startRendering(offline) {
  return new Promise((resolve, reject) => {
    offline.oncomplete = (e) => resolve(e.renderedBuffer);
    const promise = offline.startRendering();
    promise?.then?.(resolve, reject);
  });
}

async function renderOffline(key) {
  const spec = renderSpec(key);
  const Offline = OfflineContextClass();
  if (!spec || !Offline) throw new Error(`Cannot prerender ${key}`);
  const offline = new Offline(spec.channels ?? 2, Math.ceil(spec.seconds * spec.rate), spec.rate);
  building = offline;
  try {
    spec.build(offline.destination, 0);
  } finally {
    building = null;
  }
  return trimmed(await startRendering(offline));
}

// The rendered sound without its silent tail, in mono when both channels are the same.
function trimmed(buffer) {
  const channels = [...Array(buffer.numberOfChannels).keys()].map((c) => buffer.getChannelData(c));
  let end = 0;
  for (const data of channels) {
    for (let i = data.length - 1; i > end; i--) {
      if (Math.abs(data[i]) > 1e-4) {
        end = i;
        break;
      }
    }
  }
  const length = Math.max(1, Math.min(buffer.length, end + Math.ceil(buffer.sampleRate * 0.02)));
  const mono = channels.length === 1 || channels[0].every((v, i) => v === channels[1][i]);
  const numberOfChannels = mono ? 1 : channels.length;
  const { sampleRate } = buffer;
  // Before the first tap there is no live context to make buffers with.
  let out;
  if (engine.ctx) out = engine.ctx.createBuffer(numberOfChannels, length, sampleRate);
  else if (typeof AudioBuffer === 'function') out = new AudioBuffer({ numberOfChannels, length, sampleRate });
  else return buffer;
  (mono ? channels.slice(0, 1) : channels).forEach((data, c) => out.getChannelData(c).set(data.subarray(0, length)));
  return out;
}

function store(key, buffer) {
  engine.buffers.set(key, buffer);
  // Theme songs are long: keep only the latest few.
  const themes = [...engine.buffers.keys()].filter((k) => k.startsWith('theme:'));
  for (const old of themes.slice(0, Math.max(0, themes.length - MAX_THEME_BUFFERS))) engine.buffers.delete(old);
}

// Renders the next sound in the plan that is not ready yet, one at a time, in idle moments.
function pumpRenders() {
  if (engine.rendering || !OfflineContextClass()) return;
  const plan = engine.ctx ? engine.renderPlan : engine.startupPlan;
  const key = safely(plan)?.find((k) => !engine.buffers.has(k) && !engine.renderFailed.has(k) && renderSpec(k));
  if (!key) return;
  engine.rendering = true;
  idle(async () => {
    try {
      store(key, await renderOffline(key));
    } catch (err) {
      engine.renderFailed.add(key); // played live from now on
      console.warn('Prerendering failed', key, err);
    } finally {
      engine.rendering = false;
      pumpRenders();
    }
  });
}

/**
 * The app's lists of sounds to prerender, as functions returning keys in order: plan
 * after the first tap (see prerenderOrder), startup before it (see startupKeys). Asked
 * again after each render, so a new day or a simulated date changes the order. Theme
 * songs beyond MAX_THEME_BUFFERS push out the oldest.
 */
export function setPrerenderPlan(plan, startup = () => []) {
  engine.renderPlan = plan;
  engine.startupPlan = startup;
  safely(pumpRenders);
}

/** Which sounds are prerendered (dev panel): keys and the memory they take in bytes. */
export function prerendered() {
  return [...engine.buffers].map(([key, b]) => ({ key, seconds: b.duration, bytes: b.length * b.numberOfChannels * 4, rate: b.sampleRate }));
}

// Plays a prerendered buffer on dest at time t.
function playBuffer(dest, buffer, t) {
  const src = engine.ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  src.start(t);
}

// --- Tomten's jingle ---

// --- Pausing: the music stops for a theme song or Tomten, and comes back after ---

// Cuts the song that is playing (it fades out) and keeps the music waiting until
// whatever paused it has ended. Then the next song starts from the beginning: the next
// one in the mix, or the chosen song again.
function applyPause() {
  const { ctx, music } = engine;
  if (!ctx) return;
  const now = ctx.currentTime;
  const until = pausedUntil(engine.pauses, now);
  if (until !== null) {
    if (music.bus && !music.paused) {
      release(music.bus, DUCK_RAMP); // quick, and on its own gain: effects never wait for it
      music.bus = bus(1, engine.musicBus);
      music.current = null;
    }
    music.paused = Boolean(music.bus);
    music.until = until;
  } else if (music.paused) {
    music.paused = false;
    music.until = Math.min(music.until, now + RESUME_GAP);
  }
  notify();
}

function pauseMusic(name, end) {
  engine.pauses.set(name, end);
  applyPause();
}

function resumeMusic(name) {
  if (engine.pauses.delete(name)) applyPause();
}

// Fades out a song's own gain and lets it go.
function release(node, fade) {
  setGain(node, 0, fade);
  setTimeout(() => safely(() => node.disconnect()), (fade + 0.1) * 1000);
}

function stopJingle(fade = 0.25) {
  const { jingle } = engine;
  if (!jingle) return;
  engine.jingle = null;
  release(jingle.gain, fade);
  resumeMusic('jingle');
}

/** Plays Tomten's jingle (Jingle Bells on a music box, about 7 s). The music pauses meanwhile. */
export function playJingle(delay = 0) {
  safely(() => {
    if (!ready()) return;
    stopJingle(0.05);
    const t = effectStartTime({ now: engine.ctx.currentTime, delay });
    const gain = bus(1, engine.master);
    const buffer = engine.buffers.get('jingle');
    if (buffer) playBuffer(gain, buffer, t);
    else playSong(gain, t, JINGLE);
    const length = songSeconds(JINGLE);
    engine.jingle = { gain };
    pauseMusic('jingle', t + length);
  });
}

// --- A door's theme song ---

const THEME_DELAY = 1; // after the door's own sound has had its moment

function stopTheme(fade = 0.4) {
  const { theme } = engine;
  if (!theme) return;
  engine.theme = null;
  clearTimeout(theme.timer);
  release(theme.gain, fade);
  resumeMusic('theme');
}

/**
 * Plays a melody from melodies.js once: its theme excerpt, cut at THEME_MAX_SECONDS
 * with a fade, or with { full: true } (dev mode) all of it. The background music pauses
 * meanwhile. Unknown keys, and the same song while it is still playing, do nothing.
 */
export function playTheme(key, { full = false, delay = THEME_DELAY } = {}) {
  safely(() => {
    const melody = MELODIES[key];
    if (!ready() || !melody) return;
    const now = engine.ctx.currentTime;
    if (engine.theme?.key === key && engine.theme.full === full && engine.theme.end > now) return;
    stopTheme(0.1);
    const t = effectStartTime({ now, delay });
    const gain = bus(1, engine.master);
    const buffer = full ? null : engine.buffers.get(`theme:${key}`);
    let end;
    if (full) end = t + playSong(gain, t, toSong(melody));
    else if (buffer) {
      playBuffer(gain, buffer, t);
      end = t + themeSeconds(melody);
    } else end = t + themeGraph(gain, t, melody);
    const timer = setTimeout(() => safely(() => engine.theme?.gain === gain && stopTheme(0.1)), (end - now + 1.6) * 1000);
    engine.theme = { key, full, gain, end, timer };
    pauseMusic('theme', end);
  });
}

/** How long a melody's theme plays: its excerpt, never longer than THEME_MAX_SECONDS. */
export function themeSeconds(melody) {
  return Math.min(songSeconds(themeSong(melody)), THEME_MAX_SECONDS);
}

// A theme song on dest from time t, cut with a fade at THEME_MAX_SECONDS. Returns its length.
function themeGraph(dest, t, melody) {
  const gain = ac().createGain();
  gain.connect(dest);
  const length = playSong(gain, t, themeSong(melody));
  if (length <= THEME_MAX_SECONDS) return length;
  const end = t + THEME_MAX_SECONDS;
  gain.gain.setValueAtTime(1, end - 1.5);
  gain.gain.linearRampToValueAtTime(0, end);
  return THEME_MAX_SECONDS;
}

/** The door's "music", if it has one. */
export function playThemeFor(day) {
  if (day?.music) playTheme(day.music);
}

/** Stops a theme song (dev mode). */
export function stopThemeSong() {
  safely(() => stopTheme());
}

/**
 * Tomten pops up: his sleigh and his jingle. Before the first tap the jingle waits for
 * it. The background music pauses for as long as he is on screen, not just the jingle.
 */
export function tomteArrives() {
  safely(() => {
    pauseMusic('tomte', Infinity);
    if (ready()) {
      playEffect('sleigh');
      playJingle(JINGLE_DELAY);
    } else if (engine.soundOn) engine.pendingJingle = true;
  });
}

/** Tomten leaves: the jingle fades out and the background music comes back. */
export function tomteLeaves() {
  safely(() => {
    engine.pendingJingle = false;
    stopJingle();
    resumeMusic('tomte');
  });
}

// --- Background music: the menu's choice on the music box, with a pause between songs ---

function startMusic() {
  const { music } = engine;
  if (!music.bus) {
    music.bus = bus(1, engine.musicBus);
    music.until = 0;
    music.paused = false;
    applyPause(); // a theme song or Tomten may be on right now
  }
  clearTimeout(music.timer);
  musicTick();
}

// Schedules the next round shortly before it is due. The rounds are timed on the
// AudioContext's clock, which stands still while it is suspended (hidden page).
function musicTick() {
  safely(() => {
    const { music, ctx } = engine;
    if (!music.bus) return;
    if (music.paused && pausedUntil(engine.pauses, ctx.currentTime) === null) applyPause();
    if (ctx.state === 'running' && mixFor(state()).music && !music.paused && ctx.currentTime >= music.until - 1.5) {
      const key = songFor(engine.musicChoice, music.previous, engine.prefs?.today?.() ?? '');
      if (key) {
        const start = Math.max(ctx.currentTime + 0.15, music.until);
        const length = playSong(music.bus, start, toSong(MELODIES[key]), undefined, { peak: 0.14 });
        music.until = start + length + (engine.musicChoice === 'mix' ? MIX_GAP : MUSIC_GAP);
        music.current = key;
        music.previous = key;
        notify();
      }
    }
    music.timer = setTimeout(musicTick, 1000);
  });
}

function stopMusic(fade = 0.5) {
  const { music } = engine;
  clearTimeout(music.timer);
  if (!music.bus) return;
  const old = music.bus;
  music.bus = null;
  music.current = null;
  music.paused = false;
  release(old, fade);
}

// --- Dev mode ---

/** Plays every effect in turn, 2.2 s apart. Calls onEach(name) as each one starts. */
export function playAllEffects(onEach = () => {}) {
  EFFECTS.forEach((name, i) =>
    setTimeout(() => {
      onEach(name);
      playEffect(name);
    }, i * 2200),
  );
}

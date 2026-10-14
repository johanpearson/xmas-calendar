// Sound. Everything is synthesised with the Web Audio API (oscillators, noise, filters
// and envelopes): no audio files, no dependencies.
//
// The top of this file is pure logic (notes, melodies, the mixer rules) so node --test
// can import it; nothing here touches window or AudioContext at import time.

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

// "Jingle Bells" (James Lord Pierpont, 1857, public domain): the chorus with its final
// ending, in C major, written for a music box. Beats are quarter notes.
export const JINGLE_BELLS = {
  title: 'Jingle Bells',
  bpm: 270, // the jingle: about 7 s
  calmBpm: 132, // background music: a calmer music box, about 14.5 s per round
  voices: [
    // Melody: "Jingle bells, jingle bells, jingle all the way,
    // oh what fun it is to ride in a one-horse open sleigh."
    [
      ['E5', 1], ['E5', 1], ['E5', 2],
      ['E5', 1], ['E5', 1], ['E5', 2],
      ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5],
      ['E5', 4],
      ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5],
      ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
      ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1],
      ['C5', 4],
    ],
    // Accompaniment: root and fifth on the half notes (C C C C F C G C).
    [
      ['C4', 2], ['G4', 2],
      ['C4', 2], ['G4', 2],
      ['C4', 2], ['G4', 2],
      ['C4', 2], ['G4', 2],
      ['F4', 2], ['A4', 2],
      ['C4', 2], ['G4', 2],
      ['G3', 2], ['B3', 2],
      ['C4', 4],
    ],
  ],
};

// --- Effects ---

// The opening animation (themes.js / the "animation" field in days.json) -> its sound.
const ANIMATION_SOUNDS = {
  sparkle: 'chime',
  ribbon: 'chime',
  gift: 'pop',
  confetti: 'pop',
  bells: 'sleighbells',
  magnifier: 'search',
  snowburst: 'chime',
};

export const EFFECTS = ['sleighbells', 'chime', 'pop', 'search', 'locked', 'click'];

export function soundForAnimation(animation) {
  return ANIMATION_SOUNDS[animation] ?? 'chime';
}

// --- Mixer rules ---

export const MASTER_GAIN = 0.25;
export const MUSIC_GAIN = 0.32; // relative to the master: the music sits well below the effects

/** A stored on/off value ("on" | "off") to a boolean, `fallback` for anything else. */
export function parseToggle(value, fallback) {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return fallback;
}

/**
 * What the engine should do for a given state.
 *  soundOn   the sound button (off means completely silent, music included)
 *  musicOn   the music button
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

// --- The engine (browser only) ---
//
// Signal path: effects -> fx bus ┐
//              jingle -> its own gain ┼-> master (0.25, 0 when off) -> speakers
//              music -> music bus ────┘
// The AudioContext is created on the first user gesture (autoplay rules) and only while
// the sound is on, suspended while the page is hidden or the sound is off, and every
// entry point swallows errors: sound is a bonus and must never break the calendar.

const MUSIC_GAP = 6; // seconds of silence between rounds of background music
const JINGLE_DELAY = 0.35; // after the sleigh bells of Tomten's entrance
// Events that count as user activation (pointerup covers touch, click comes after a mouse press).
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];

const engine = {
  prefs: null,
  ctx: null,
  master: null,
  fx: null,
  musicBus: null,
  noise: null,
  soundOn: true,
  musicOn: false,
  unlocked: false,
  visible: true,
  pendingJingle: false, // Tomten appeared before the first tap: play his jingle on it
  jingle: null, // { gain, end }
  music: { bus: null, until: 0, timer: null },
  listeners: new Set(),
};

const AudioContextClass = () => globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;

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
  musicOn: engine.musicOn,
  unlocked: engine.unlocked,
  visible: engine.visible,
});

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
  engine.master = bus(0, ctx.destination);
  engine.fx = bus(1, engine.master);
  engine.musicBus = bus(MUSIC_GAIN, engine.master);
  // Older iOS only unlocks output once something has played inside the gesture.
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start(0);
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
  if (engine.soundOn && engine.musicOn && engine.unlocked) {
    if (mix.music) startMusic();
    else clearTimeout(engine.music.timer); // hidden: the suspended context holds the music
  } else stopMusic();
  for (const listener of engine.listeners) safely(listener);
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

/** Starts the sound system with the saved settings: { getSoundOn, setSoundOn, getMusicOn, setMusicOn }. */
export function initAudio(prefs) {
  safely(() => {
    engine.prefs = prefs;
    engine.soundOn = prefs.getSoundOn();
    engine.musicOn = prefs.getMusicOn();
    engine.visible = document.visibilityState !== 'hidden';
    if (!audioSupported()) return;
    const onGesture = (e) => {
      if (e.key !== 'Escape') safely(unlock); // Esc is no user activation
    };
    for (const type of GESTURES) document.addEventListener(type, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () =>
      safely(() => {
        engine.visible = document.visibilityState !== 'hidden';
        apply();
      }),
    );
  });
}

/** Calls listener whenever a setting or the audio state changes. Returns an unsubscribe function. */
export function onAudioChange(listener) {
  engine.listeners.add(listener);
  return () => engine.listeners.delete(listener);
}

export const isSoundOn = () => engine.soundOn;
export const isMusicOn = () => engine.musicOn;

// Turning the sound off silences everything at once, also sounds already playing.
function silence() {
  engine.pendingJingle = false;
  stopJingle(0.05);
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

/** The music button. Turning music on turns the sound on too (music needs it). */
export function setMusic(on) {
  safely(() => {
    engine.musicOn = Boolean(on);
    engine.prefs?.setMusicOn(engine.musicOn);
    if (engine.musicOn && !engine.soundOn) {
      engine.soundOn = true;
      engine.prefs?.setSoundOn(true);
    }
    if (engine.musicOn) unlock();
    apply();
  });
}

// --- Synthesis building blocks ---

const rand = (min, max) => min + Math.random() * (max - min);

// A shared second of white noise for knocks, whooshes and the sleigh bells' shimmer.
function noiseBuffer() {
  if (!engine.noise) {
    const { ctx } = engine;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    engine.noise = buffer;
  }
  return engine.noise;
}

// An envelope: a soft attack to `peak`, then an exponential decay to silence at t + dur.
function envelope(t, dur, peak, attack) {
  const gain = engine.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return gain;
}

// One oscillator through an envelope. freqTo glides the pitch over the note.
function tone(dest, { t, freq, dur, type = 'sine', peak = 0.2, attack = 0.005, freqTo = null }) {
  const { ctx } = engine;
  const osc = ctx.createOscillator();
  osc.type = type;
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
  const { ctx } = engine;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(freq, t);
  for (const [offset, f] of sweep ?? []) biquad.frequency.exponentialRampToValueAtTime(f, t + offset);
  const gain = envelope(t, dur, peak, attack);
  src.connect(biquad).connect(gain).connect(dest);
  src.start(t, rand(0, 0.5));
  src.stop(t + dur + 0.05);
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

// A music box tine: a triangle with a soft attack and a long ring, plus a quiet octave.
function musicBoxNote(dest, t, freq, { peak = 0.16, ring = 1.1 } = {}) {
  tone(dest, { t, freq, dur: ring, type: 'triangle', peak, attack: 0.012 });
  tone(dest, { t, freq: freq * 2, dur: ring * 0.45, peak: peak * 0.22, attack: 0.008 });
}

// Schedules a whole song on `dest` from time t. Returns its length in seconds.
function playSong(dest, t, song, bpm, { peak = 0.16 } = {}) {
  for (const e of songToEvents(song, bpm)) {
    const ring = Math.min(1.4, Math.max(0.5, e.duration * 2.2));
    musicBoxNote(dest, t + e.time, e.freq, { peak: e.voice === 0 ? peak : peak * 0.5, ring });
  }
  return songSeconds(song, bpm);
}

// --- The effects. Each takes the destination and a start time; all end within 1.5 s. ---

const SOUNDS = {
  // Sleigh bells: four shakes of tiny metallic hits and a hiss of shimmer.
  sleighbells(dest, t) {
    [0, 0.17, 0.34, 0.56].forEach((shake, i) => {
      const last = i === 3;
      for (let j = 0; j < 7; j++) {
        const at = t + shake + rand(0, 0.06);
        const base = rand(2300, 3400);
        const dur = last ? rand(0.2, 0.4) : rand(0.08, 0.16);
        [1, 1.48, 2.11].forEach((ratio, k) =>
          tone(dest, { t: at, freq: base * ratio, dur, peak: 0.045 / (k + 1), attack: 0.001 }),
        );
      }
      noise(dest, { t: t + shake, dur: last ? 0.3 : 0.12, peak: 0.07, filter: 'highpass', freq: 6000 });
    });
  },

  // A pling, then a glittering arpeggio upwards.
  chime(dest, t) {
    bell(dest, t, noteToFrequency('C6'), { peak: 0.16, dur: 0.9 });
    ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'].forEach((note, i) =>
      tone(dest, { t: t + 0.14 + i * 0.065, freq: noteToFrequency(note), dur: 0.45, type: 'triangle', peak: 0.09 - i * 0.008, attack: 0.004 }),
    );
    glitter(dest, t + 0.45, { count: 7, over: 0.6 });
  },

  // A soft pop (a quick downward blip), then glitter.
  pop(dest, t) {
    tone(dest, { t, freq: 620, freqTo: 150, dur: 0.12, peak: 0.45, attack: 0.003 });
    noise(dest, { t, dur: 0.05, peak: 0.08, filter: 'lowpass', freq: 1800 });
    glitter(dest, t + 0.1, { count: 9, over: 0.7, peak: 0.04 });
  },

  // A searching whoosh, zigzagging like the magnifier, then a ding: found it!
  search(dest, t) {
    noise(dest, {
      t,
      dur: 0.78,
      peak: 0.16,
      attack: 0.12,
      q: 5,
      freq: 500,
      sweep: [[0.24, 2200], [0.46, 800], [0.7, 2600]],
    });
    bell(dest, t + 0.8, noteToFrequency('E6'), { peak: 0.18, dur: 0.62 });
  },

  // A low, dull "tonk": the door won't budge.
  locked(dest, t) {
    tone(dest, { t, freq: 150, freqTo: 110, dur: 0.3, peak: 0.6, attack: 0.003 });
    tone(dest, { t, freq: 310, freqTo: 240, dur: 0.12, type: 'triangle', peak: 0.12, attack: 0.002 });
    noise(dest, { t, dur: 0.04, peak: 0.12, filter: 'lowpass', freq: 900 });
  },

  // A tiny click for "Nästa".
  click(dest, t) {
    noise(dest, { t, dur: 0.025, peak: 0.12, filter: 'highpass', freq: 3000, attack: 0.001 });
    tone(dest, { t, freq: 1900, dur: 0.035, peak: 0.06, attack: 0.001 });
  },
};

const ready = () => engine.ctx && mixFor(state()).effects;

/** Plays one of EFFECTS. Silent (and harmless) before the first tap, while hidden or when off. */
export function playEffect(name) {
  safely(() => {
    if (!ready() || !SOUNDS[name]) return;
    SOUNDS[name](engine.fx, engine.ctx.currentTime + 0.01);
  });
}

/** The sound that goes with an opening animation (see soundForAnimation). */
export function playForAnimation(animation) {
  playEffect(soundForAnimation(animation));
}

// --- Tomten's jingle ---

function stopJingle(fade = 0.25) {
  const { jingle } = engine;
  if (!jingle) return;
  engine.jingle = null;
  setGain(jingle.gain, 0, fade);
  setTimeout(() => safely(() => jingle.gain.disconnect()), (fade + 0.1) * 1000);
  setGain(engine.musicBus, MUSIC_GAIN, 0.6);
}

/** Plays Tomten's jingle (Jingle Bells on a music box, about 7 s). Ducks the music meanwhile. */
export function playJingle(delay = 0) {
  safely(() => {
    if (!ready()) return;
    stopJingle(0.05);
    const t = engine.ctx.currentTime + 0.03 + delay;
    const gain = bus(1, engine.master);
    const length = playSong(gain, t, JINGLE_BELLS, JINGLE_BELLS.bpm);
    engine.jingle = { gain };
    // Duck the background music under the jingle, then bring it back.
    const music = engine.musicBus.gain;
    music.cancelScheduledValues(engine.ctx.currentTime);
    music.setTargetAtTime(MUSIC_GAIN * 0.15, engine.ctx.currentTime, 0.1);
    music.setTargetAtTime(MUSIC_GAIN, t + length + 0.5, 0.4);
  });
}

/** Tomten pops up: sleigh bells and his jingle. Before the first tap both wait for it. */
export function tomteArrives() {
  safely(() => {
    if (ready()) {
      playEffect('sleighbells');
      playJingle(JINGLE_DELAY);
    } else if (engine.soundOn) engine.pendingJingle = true;
  });
}

/** Tomten leaves: the jingle fades out. */
export function tomteLeaves() {
  safely(() => {
    engine.pendingJingle = false;
    stopJingle();
  });
}

// --- Background music: the jingle's melody, calmer, with a pause between rounds ---

function startMusic() {
  const { music } = engine;
  if (!music.bus) {
    music.bus = bus(1, engine.musicBus);
    music.until = 0;
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
    if (ctx.state === 'running' && mixFor(state()).music && ctx.currentTime >= music.until - 1.5) {
      const start = Math.max(ctx.currentTime + 0.15, music.until);
      const length = playSong(music.bus, start, JINGLE_BELLS, JINGLE_BELLS.calmBpm, { peak: 0.14 });
      music.until = start + length + MUSIC_GAP;
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
  setGain(old, 0, fade);
  setTimeout(() => safely(() => old.disconnect()), (fade + 0.1) * 1000);
}

// --- Dev mode ---

/** Plays every effect in turn, 1.6 s apart. Calls onEach(name) as each one starts. */
export function playAllEffects(onEach = () => {}) {
  EFFECTS.forEach((name, i) =>
    setTimeout(() => {
      onEach(name);
      playEffect(name);
    }, i * 1600),
  );
}

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

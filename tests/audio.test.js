import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REST,
  noteToFrequency,
  voiceToEvents,
  voiceSeconds,
  songToEvents,
  songSeconds,
  JINGLE,
  EFFECTS,
  soundForAnimation,
  soundForDoor,
  fanfareFor,
  FANFARE_DELAY,
  isEffect,
  EFFECT_LABELS,
  sfx,
  parseToggle,
  mixFor,
  MASTER_GAIN,
} from '../js/audio.js';
import { ANIMATIONS, TYPE_ANIMATIONS } from '../js/themes.js';

const close = (actual, expected, epsilon = 0.01) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not close to ${expected}`);

test('notes to frequencies (equal temperament, A4 = 440 Hz)', () => {
  assert.equal(noteToFrequency('A4'), 440);
  assert.equal(noteToFrequency('A5'), 880);
  assert.equal(noteToFrequency('A3'), 220);
  close(noteToFrequency('C4'), 261.63);
  close(noteToFrequency('E5'), 659.26);
  close(noteToFrequency('G3'), 196.0);
  close(noteToFrequency('B3'), 246.94);
});

test('sharps and flats', () => {
  close(noteToFrequency('C#5'), 554.37);
  assert.equal(noteToFrequency('C#5'), noteToFrequency('Db5'));
  assert.equal(noteToFrequency('B#3'), noteToFrequency('C4'));
  assert.equal(noteToFrequency('Cb4'), noteToFrequency('B3'));
});

test('a rest has no frequency, unknown notes throw', () => {
  assert.equal(noteToFrequency(REST), null);
  for (const bad of ['H4', 'c4', 'A', 'A#', 'A44', '', 'Ax4', null, undefined]) {
    assert.throws(() => noteToFrequency(bad), /Unknown note/, String(bad));
  }
});

test('a voice becomes timed events; rests move time on', () => {
  // 120 bpm: one beat is 0.5 s.
  const events = voiceToEvents([['C4', 1], [REST, 1], ['E4', 2], ['G4', 0.5]], 120);
  assert.deepEqual(
    events.map(({ note, time, duration }) => [note, time, duration]),
    [['C4', 0, 0.5], ['E4', 1, 1], ['G4', 2, 0.25]],
  );
  close(events[1].freq, 329.63);
  assert.equal(voiceSeconds([['C4', 1], [REST, 1], ['E4', 2], ['G4', 0.5]], 120), 2.25);
});

test('the tempo scales every event', () => {
  const voice = [['C4', 1], ['D4', 1]];
  assert.equal(voiceToEvents(voice, 60)[1].time, 1);
  assert.equal(voiceToEvents(voice, 240)[1].time, 0.25);
  assert.equal(voiceSeconds(voice, 60), 2);
});

test('songs merge their voices in time order', () => {
  const song = { bpm: 60, voices: [[['E5', 1], ['G5', 1]], [['C4', 2]]] };
  const events = songToEvents(song);
  assert.deepEqual(events.map((e) => [e.note, e.time, e.voice]), [['E5', 0, 0], ['C4', 0, 1], ['G5', 1, 0]]);
  assert.equal(songSeconds(song), 2);
  assert.equal(songSeconds(song, 120), 1);
});

test('the jingle is a valid melody of 5 to 8 seconds', () => {
  const events = songToEvents(JINGLE);
  assert.ok(events.length > 20);
  for (const e of events) assert.ok(e.freq > 100 && e.freq < 2000, `${e.note} is out of range`);
  const seconds = songSeconds(JINGLE);
  assert.ok(seconds >= 5 && seconds <= 8, `the jingle is ${seconds} s`);
  // Every voice is as long as the melody, so the bass ends with it.
  for (const voice of JINGLE.voices) close(voiceSeconds(voice, JINGLE.bpm), seconds);
});

test('the jingle starts with "jingle bells" (E E E)', () => {
  const melody = voiceToEvents(JINGLE.voices[0], JINGLE.bpm);
  assert.deepEqual(melody.slice(0, 3).map((e) => e.note), ['E5', 'E5', 'E5']);
  assert.equal(melody.at(-1).note, 'C5'); // ends on the tonic
});

test('every opening animation has a sound, unknown ones fall back', () => {
  for (const name of ANIMATIONS) assert.ok(EFFECTS.includes(soundForAnimation(name)), name);
  assert.equal(soundForAnimation(TYPE_ANIMATIONS.uppdrag), 'bells');
  assert.equal(soundForAnimation(TYPE_ANIMATIONS.ledtrad), 'sparkle');
  assert.equal(soundForAnimation(TYPE_ANIMATIONS.rim), 'sparkle');
  assert.equal(soundForAnimation(TYPE_ANIMATIONS.litet), 'gift');
  assert.equal(soundForAnimation(TYPE_ANIMATIONS.jakt), 'search');
  assert.equal(soundForAnimation('nope'), 'sparkle');
  assert.equal(soundForAnimation(undefined), 'sparkle');
});

test('a door\'s own "sound" wins over its type\'s, unknown names fall back', () => {
  assert.equal(soundForDoor({ type: 'litet', sound: 'cat' }, 'gift'), 'cat');
  assert.equal(soundForDoor({ type: 'litet' }, 'gift'), 'gift');
  assert.equal(soundForDoor({ type: 'litet', sound: 'nope' }, 'gift'), 'gift');
  assert.equal(soundForDoor(undefined, 'bells'), 'bells');
});

test('a treasure hunt gets a fanfare after its own sound', () => {
  assert.equal(fanfareFor({ type: 'jakt' }), true);
  assert.equal(fanfareFor({ type: 'litet' }), false);
  assert.ok(FANFARE_DELAY > 0.5 && FANFARE_DELAY < 2);
});

test('the effects: every one asked for exists and has a Swedish label', () => {
  const asked = ['ho', 'sleigh', 'knock', 'fanfare', 'door', 'bells', 'twinkle', 'cat', 'sneak', 'camera', 'paper', 'candy', 'chime', 'splat', 'pop', 'mystery', 'popcorn', 'glogg', 'bingo', 'unwrap'];
  for (const name of asked) assert.ok(isEffect(name), name);
  assert.equal(new Set(EFFECTS).size, EFFECTS.length);
  for (const name of EFFECTS) assert.equal(typeof EFFECT_LABELS[name], 'string', name);
  assert.deepEqual(Object.keys(EFFECT_LABELS).sort(), [...EFFECTS].sort());
  assert.deepEqual(sfx.names, EFFECTS);
  assert.equal(typeof sfx.play, 'function');
  assert.equal(isEffect('locked'), false); // the old "tonk" is now "knock"
});

test('stored toggles: "on"/"off", anything else is the default', () => {
  assert.equal(parseToggle('on', false), true);
  assert.equal(parseToggle('off', true), false);
  for (const value of [null, undefined, '', 'true', '1', 'ON']) {
    assert.equal(parseToggle(value, true), true);
    assert.equal(parseToggle(value, false), false);
  }
});

const base = { soundOn: true, musicOn: false, unlocked: true, visible: true };

test('mixer: sound on plays effects at the low default volume', () => {
  assert.deepEqual(mixFor(base), { master: MASTER_GAIN, running: true, effects: true, music: false });
  assert.ok(MASTER_GAIN > 0.15 && MASTER_GAIN <= 0.3);
});

test('mixer: before the first tap nothing plays', () => {
  const mix = mixFor({ ...base, unlocked: false, musicOn: true });
  assert.equal(mix.running, false);
  assert.equal(mix.effects, false);
  assert.equal(mix.music, false);
});

test('mixer: sound off is completely silent, music included', () => {
  const mix = mixFor({ ...base, soundOn: false, musicOn: true });
  assert.deepEqual(mix, { master: 0, running: false, effects: false, music: false });
});

test('mixer: music only with its own button on', () => {
  assert.equal(mixFor(base).music, false);
  assert.equal(mixFor({ ...base, musicOn: true }).music, true);
});

test('mixer: a hidden page suspends everything, showing it again resumes', () => {
  const hidden = mixFor({ ...base, musicOn: true, visible: false });
  assert.equal(hidden.running, false);
  assert.equal(hidden.effects, false);
  assert.equal(hidden.music, false);
  assert.equal(hidden.master, MASTER_GAIN); // the setting itself is untouched
  assert.equal(mixFor({ ...base, musicOn: true }).music, true);
});

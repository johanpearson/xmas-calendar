import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MELODIES,
  MELODY_KEYS,
  TOMTE_JINGLE,
  parseBars,
  parseBass,
  barsOf,
  toSong,
  themeSong,
  MIX_FROM,
  mixPool,
  nextInMix,
  parseMusicChoice,
  songFor,
  nextChoice,
} from '../js/melodies.js';
import { noteToFrequency, songSeconds, songToEvents, THEME_MAX_SECONDS } from '../js/audio.js';

const ALL = [...Object.entries(MELODIES), ['tomte-jingle', TOMTE_JINGLE]];

test('the notation: bars, notes, default length, fractions and rests', () => {
  assert.deepEqual(parseBars(' E5 C5:1.5 | D5:2 R:1/2 |'), [[['E5', 1], ['C5', 1.5]], [['D5', 2], ['R', 0.5]]]);
  assert.deepEqual(parseBass(' C3  G2 R '), ['C3', 'G2', 'R']);
  for (const bad of ['C5:0', 'C5:-1', 'C5:x', 'C5:1/0']) assert.throws(() => parseBars(bad), /bad length/, bad);
});

test('the seven melodies of the menu are there, jingle-bells first', () => {
  assert.deepEqual(MELODY_KEYS, [
    'jingle-bells',
    'tusen-juleljus',
    'hej-tomtegubbar',
    'deck-the-halls',
    'we-wish-you',
    'stilla-natt',
    'santa-lucia',
  ]);
  for (const [key, m] of Object.entries(MELODIES)) {
    assert.equal(typeof m.title, 'string', key);
    assert.ok(m.title.length > 0, key);
  }
});

for (const [key, melody] of ALL) {
  test(`${key}: valid notes and positive lengths`, () => {
    const { bars } = barsOf(melody);
    for (const [i, bar] of bars.entries()) {
      for (const [note, beats] of bar.notes) {
        assert.doesNotThrow(() => noteToFrequency(note), `${key} bar ${i + 1}: ${note}`);
        assert.ok(beats > 0, `${key} bar ${i + 1}: ${note} has length ${beats}`);
      }
    }
    for (const note of parseBass(melody.bass)) {
      assert.doesNotThrow(() => noteToFrequency(note), `${key} bass: ${note}`);
    }
    // Within a music box's range: no rumble, no whistle.
    for (const e of songToEvents(toSong(melody))) {
      assert.ok(e.freq > 60 && e.freq < 2000, `${key}: ${e.note} is out of range`);
    }
  });

  test(`${key}: every bar is full (bar lines in the right place), one bass note per bar`, () => {
    const { bars } = barsOf(melody);
    const meter = melody.meter;
    assert.ok(Number.isInteger(meter) && meter >= 2 && meter <= 12, `${key}: meter ${meter}`);
    const close = (a, b) => Math.abs(a - b) < 1e-9;
    bars.forEach((bar, i) => {
      const edge = i === 0 || i === bars.length - 1; // a pickup, or a short last bar
      if (edge) assert.ok(bar.beats <= meter + 1e-9, `${key} bar ${i + 1} has ${bar.beats} beats`);
      else assert.ok(close(bar.beats, meter), `${key} bar ${i + 1} has ${bar.beats} beats, not ${meter}`);
    });
    if (bars[0].beats < meter && bars.length > 1) {
      // A pickup and the last bar make up one bar together.
      assert.ok(bars[0].beats + bars.at(-1).beats <= meter + 1e-9, `${key}: pickup and last bar are too long`);
    }
    assert.equal(parseBass(melody.bass).length, bars.length, `${key}: bass notes per bar`);
  });

  test(`${key}: a reasonable length and tempo`, () => {
    assert.ok(melody.bpm >= 40 && melody.bpm <= 300, `${key}: ${melody.bpm} bpm`);
    const seconds = songSeconds(toSong(melody));
    assert.ok(seconds >= 5 && seconds <= 75, `${key} is ${seconds.toFixed(1)} s`);
    const notes = toSong(melody).voices[0].filter(([note]) => note !== 'R');
    assert.ok(notes.length >= 16, `${key} has only ${notes.length} notes`);
  });
}

test('every theme song fits in about 20 seconds and ends on a full bar', () => {
  assert.ok(THEME_MAX_SECONDS >= 18 && THEME_MAX_SECONDS <= 22);
  for (const [key, melody] of Object.entries(MELODIES)) {
    const song = themeSong(melody);
    const seconds = songSeconds(song);
    assert.ok(seconds <= THEME_MAX_SECONDS, `${key}: the theme is ${seconds.toFixed(1)} s`);
    assert.ok(seconds >= 8, `${key}: the theme is only ${seconds.toFixed(1)} s`);
    if (melody.theme) {
      const [from, to] = melody.theme;
      const { bars } = barsOf(melody);
      assert.ok(from >= 1 && from <= to && to <= bars.length, `${key}: theme bars ${from}-${to}`);
    }
  }
});

test('a song has a melody and a bass voice of the same length, and bar starts', () => {
  const song = toSong({ bpm: 60, meter: 2, melody: 'C5 | D5 E5 | F5:2', bass: 'R C3 F3' });
  assert.deepEqual(song.voices[0], [['C5', 1], ['D5', 1], ['E5', 1], ['F5', 2]]);
  assert.deepEqual(song.voices[1], [['R', 1], ['C3', 2], ['F3', 2]]);
  assert.deepEqual(song.barStarts, [0, 1, 3]);
  assert.equal(song.bells, true);
  // An excerpt starts at 0 and takes its own bass notes.
  const part = toSong({ bpm: 60, meter: 2, melody: 'C5 | D5 E5 | F5:2', bass: 'R C3 F3' }, [2, 3]);
  assert.deepEqual(part.voices[1], [['C3', 2], ['F3', 2]]);
  assert.deepEqual(part.barStarts, [0, 2]);
});

test('Tomten\'s jingle is 5 to 8 seconds and starts with "jingle bells" (E E E)', () => {
  const song = toSong(TOMTE_JINGLE);
  const seconds = songSeconds(song);
  assert.ok(seconds >= 5 && seconds <= 8, `${seconds} s`);
  assert.deepEqual(song.voices[0].slice(0, 3).map(([n]) => n), ['E5', 'E5', 'E5']);
  assert.equal(song.voices[0].at(-1)[0], 'C5');
});

// --- Blandat ---

test('santa-lucia only joins the mix from 13 December', () => {
  assert.equal(MIX_FROM['santa-lucia'], '12-13');
  assert.ok(!mixPool('2026-11-29').includes('santa-lucia'));
  assert.ok(!mixPool('2026-12-12').includes('santa-lucia'));
  assert.ok(mixPool('2026-12-13').includes('santa-lucia'));
  assert.ok(mixPool('2026-12-24').includes('santa-lucia'));
  // No year in the rule: the same next year.
  assert.ok(!mixPool('2027-12-12').includes('santa-lucia'));
  assert.ok(mixPool('2027-12-13').includes('santa-lucia'));
  // Everything else is always in the mix.
  assert.deepEqual(mixPool('2026-12-01'), MELODY_KEYS.filter((k) => k !== 'santa-lucia'));
  assert.deepEqual(mixPool('2026-12-13'), MELODY_KEYS);
});

test('the mix never plays the same song twice in a row', () => {
  const pool = mixPool('2026-12-20');
  let previous = null;
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const next = nextInMix(pool, previous);
    assert.ok(pool.includes(next));
    assert.notEqual(next, previous);
    seen.add(next);
    previous = next;
  }
  assert.equal(seen.size, pool.length); // and it does get round to all of them
});

test('the mix: edge cases of the random number and the pool', () => {
  const pool = ['a', 'b', 'c'];
  assert.equal(nextInMix(pool, 'a', () => 0), 'b');
  assert.equal(nextInMix(pool, 'a', () => 0.9999), 'c');
  assert.equal(nextInMix(pool, 'c', () => 1), 'b'); // a random() of exactly 1 stays in range
  assert.equal(nextInMix(pool, null, () => 0), 'a');
  assert.equal(nextInMix(['a'], 'a'), 'a'); // a single song repeats rather than stops
  assert.equal(nextInMix([], 'a'), null);
});

test('the stored music choice: off, mix or a melody; the old "on" is the mix', () => {
  assert.equal(parseMusicChoice('mix'), 'mix');
  assert.equal(parseMusicChoice('on'), 'mix');
  assert.equal(parseMusicChoice('stilla-natt'), 'stilla-natt');
  for (const value of ['off', null, undefined, '', 'nope', 'ON']) assert.equal(parseMusicChoice(value), 'off');
});

test('what plays for a menu choice: the mix (respecting the date), one song, or nothing', () => {
  assert.equal(songFor('off', null, '2026-12-13'), null);
  assert.equal(songFor('stilla-natt', 'stilla-natt', '2026-12-01'), 'stilla-natt'); // a chosen song repeats
  assert.equal(songFor('santa-lucia', null, '2026-12-01'), 'santa-lucia'); // picked by hand: any day
  for (let i = 0; i < 300; i++) {
    const early = songFor('mix', 'jingle-bells', '2026-12-12');
    assert.notEqual(early, 'santa-lucia');
    assert.notEqual(early, 'jingle-bells');
  }
  // From Lucia the mix can reach it.
  assert.equal(songFor('mix', null, '2026-12-13', () => 0.9999), 'santa-lucia');
  assert.equal(songFor('nope', null, '2026-12-13'), null);
});

test('"Nästa låt" with one song chosen moves down the list and round again', () => {
  assert.equal(nextChoice('jingle-bells'), 'tusen-juleljus');
  assert.equal(nextChoice(MELODY_KEYS.at(-1)), MELODY_KEYS[0]);
  assert.equal(nextChoice('mix'), 'mix');
});

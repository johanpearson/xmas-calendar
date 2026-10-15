// The melodies: notes as plain data, easy to correct by ear, and the rules for "Blandat".
// Pure logic only (no window, no AudioContext), so node --test can import it.
//
// How a melody is written
//   melody  bars separated by "|". Each note is NAME:BEATS, e.g. "E5:1" (one beat) or
//           "C5:1.5". ":1" may be left out. NAME is a letter, an optional # or b and an
//           octave (A4 = 440 Hz). "R" is a rest. Triplets can be written as fractions: "E5:1/3".
//   meter   beats per bar. Every bar must add up to it, except a shorter first bar
//           (a pickup) and a shorter last bar.
//   bass    one note per bar ("R" for none), played quietly on the bar's first beat.
//   bpm     beats per minute for the menu and the theme song.
//   theme   optional: which bars [from, to] (1-based, inclusive) make up the door's theme
//           song, which should stay under about 20 s. Without it the whole melody plays.
//   bells   optional: false leaves out the soft sleigh-bell layer.
//
// Only traditional melodies, or melodies whose copyright has expired; the README lists
// the source of each. No lyrics are shown anywhere.

export const MELODIES = {
  'jingle-bells': {
    title: 'Jingle Bells',
    bpm: 132,
    meter: 4,
    melody: `
      E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:0.5 | E5:4 |
      F5 F5 F5:1.5 F5:0.5 | F5 E5 E5 E5:0.5 E5:0.5 | E5 D5 D5 E5 | D5:2 G5:2 |
      E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:0.5 | E5:4 |
      F5 F5 F5 F5 | F5 E5 E5 E5:0.5 E5:0.5 | G5 G5 F5 D5 | C5:4`,
    bass: 'C3 C3 C3 C3  F3 C3 G2 G2  C3 C3 C3 C3  F3 C3 G2 C3',
    theme: [9, 16],
  },

  'tusen-juleljus': {
    title: 'Nu tändas tusen juleljus',
    bpm: 108,
    meter: 3,
    melody: `
      G4 |
      C5:2 D5 | E5:2 E5 | F5 E5 D5 | E5:2 G4 |
      C5:2 D5 | E5:2 D5 | C5:3 | R:2 G4 |
      E5:2 F5 | G5:2 G5 | A5 G5 F5 | E5:2 E5 |
      D5:2 E5 | F5:2 D5 | C5:2`,
    bass: 'R  C3 C3 F2 C3  F2 G2 C3 C3  C3 C3 F2 C3  G2 G2 C3',
    theme: [1, 8],
  },

  'hej-tomtegubbar': {
    title: 'Hej tomtegubbar',
    bpm: 168,
    meter: 2,
    melody: `
      C5 C5:0.5 C5:0.5 | E5 C5 | D5 D5:0.5 D5:0.5 | F5 D5 |
      E5:0.5 E5:0.5 G5:0.5 G5:0.5 | F5:0.5 F5:0.5 D5:0.5 B4:0.5 | C5 E5 | C5:2 |
      C5 C5:0.5 C5:0.5 | E5 C5 | D5 D5:0.5 D5:0.5 | F5 D5 |
      E5:0.5 E5:0.5 G5:0.5 G5:0.5 | F5:0.5 F5:0.5 D5:0.5 B4:0.5 | C5 E5 | C5:2`,
    bass: 'C3 C3 G2 G2  C3 G2 C3 C3  C3 C3 G2 G2  C3 G2 C3 C3',
  },

  'deck-the-halls': {
    title: 'Deck the Halls',
    bpm: 132,
    meter: 4,
    melody: `
      G5:1.5 F5:0.5 E5 D5 | C5 D5 E5 C5 | D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5 | C5 B4 C5:2 |
      G5:1.5 F5:0.5 E5 D5 | C5 D5 E5 C5 | D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5 | C5 B4 C5:2 |
      D5:1.5 E5:0.5 F5 D5 | E5:1.5 F5:0.5 G5 D5 | E5:0.5 F#5:0.5 G5 A5:0.5 B5:0.5 C6 | B5 A5 G5:2 |
      G5:1.5 F5:0.5 E5 D5 | C5 D5 E5 C5 | A5:0.5 A5:0.5 A5:0.5 A5:0.5 G5:1.5 F5:0.5 | E5 D5 C5:2`,
    bass: 'C3 C3 G2 C3  C3 C3 G2 C3  G2 C3 D3 G2  C3 C3 F2 C3',
    theme: [1, 8],
  },

  'we-wish-you': {
    title: 'We Wish You a Merry Christmas',
    bpm: 150,
    meter: 3,
    melody: `
      G4 |
      C5 C5:0.5 D5:0.5 C5:0.5 B4:0.5 | A4 A4 A4 | D5 D5:0.5 E5:0.5 D5:0.5 C5:0.5 | B4 G4 G4 |
      E5 E5:0.5 F5:0.5 E5:0.5 D5:0.5 | C5 A4 G4:0.5 G4:0.5 | A4 D5 B4 | C5:2 G4 |
      C5 C5 C5 | B4:2 B4 | C5 B4 A4 | G4:2 D5 |
      E5 D5:0.5 D5:0.5 C5:0.5 C5:0.5 | G5 G4 G4:0.5 G4:0.5 | A4 D5 B4 | C5:2`,
    bass: 'R  C3 F2 D3 G2  E3 F2 G2 C3  C3 G2 A2 G2  C3 E3 G2 C3',
  },

  'stilla-natt': {
    title: 'Stilla natt',
    bpm: 150, // eighth notes: 6/8 counted in eighths
    meter: 6,
    bells: false,
    melody: `
      G5:3 A5:1 G5:2 | E5:6 | G5:3 A5:1 G5:2 | E5:6 |
      D6:4 D6:2 | B5:6 | C6:4 C6:2 | G5:6 |
      A5:4 A5:2 | C6:3 B5:1 A5:2 | G5:3 A5:1 G5:2 | E5:6 |
      A5:4 A5:2 | C6:3 B5:1 A5:2 | G5:3 A5:1 G5:2 | E5:6 |
      D6:4 D6:2 | F6:3 D6:1 B5:2 | C6:6 | E6:6 |
      C6:3 G5:1 E5:2 | G5:3 F5:1 D5:2 | C5:6`,
    bass: 'C3 C3 C3 C3  G2 G2 C3 C3  F2 F2 C3 C3  F2 F2 C3 C3  G2 G2 C3 C3  C3 G2 C3',
    theme: [17, 23],
  },

  'santa-lucia': {
    title: 'Santa Lucia',
    bpm: 112,
    meter: 3,
    melody: `
      G4 G4 C5 | C5:1.5 B4:0.5 B4 | A4 A4 D5 | D5:2 C5 |
      C5 C5 E5 | E5:1.5 D5:0.5 D5 | F5 E5 D5 | C5:3 |
      G5:1.5 F5:0.5 E5 | E5:2 D5 | F5:1.5 E5:0.5 D5 | D5:2 C5 |
      C5:2 A4 | G4:2 E5 | D5:2 B4 | C5:3`,
    bass: 'C3 G2 F2 G2  C3 G2 G2 C3  C3 G2 G2 C3  F2 C3 G2 C3',
    theme: [1, 8],
  },
};

// Tomten's jingle: the chorus of Jingle Bells with its final ending, fast (about 7 s).
export const TOMTE_JINGLE = {
  title: 'Tomtens jingel',
  bpm: 270,
  meter: 4,
  bells: false, // his sleigh bells have just rung
  melody: `
    E5 E5 E5:2 | E5 E5 E5:2 | E5 G5 C5:1.5 D5:0.5 | E5:4 |
    F5 F5 F5:1.5 F5:0.5 | F5 E5 E5 E5:0.5 E5:0.5 | G5 G5 F5 D5 | C5:4`,
  bass: 'C4 C4 C4 C4 F3 C4 G3 C4',
};

/** The melodies in menu order. */
export const MELODY_KEYS = Object.keys(MELODIES);

// --- Reading the notation ---

function parseBeats(text, where) {
  const [num, den] = text.split('/');
  const beats = den === undefined ? Number(num) : Number(num) / Number(den);
  if (!Number.isFinite(beats) || beats <= 0) throw new Error(`${where}: bad length "${text}"`);
  return beats;
}

/** "E5 C5:1.5 | D5:2" -> [[['E5', 1], ['C5', 1.5]], [['D5', 2]]]. Note names are checked elsewhere. */
export function parseBars(text) {
  return String(text)
    .split('|')
    .map((bar) => bar.trim())
    .filter(Boolean)
    .map((bar, i) =>
      bar.split(/\s+/).map((token) => {
        const [note, beats] = token.split(':');
        return [note, beats === undefined ? 1 : parseBeats(beats, `bar ${i + 1}`)];
      }),
    );
}

export const parseBass = (text) => String(text).trim().split(/\s+/).filter(Boolean);

const sum = (notes) => notes.reduce((total, [, beats]) => total + beats, 0);

/** The bars of a melody with their start (in beats), and the melody's total beats. */
export function barsOf(melody) {
  let start = 0;
  const bars = parseBars(melody.melody).map((notes) => {
    const bar = { notes, start, beats: sum(notes) };
    start += bar.beats;
    return bar;
  });
  return { bars, beats: start };
}

/**
 * A melody (or an excerpt of bars [from, to], 1-based) as a song for the player:
 * { title, bpm, meter, bells, voices: [melody, bass], barStarts }, where a voice is
 * [[note, beats], ...] and barStarts are the bars' first beats (for the bell layer).
 */
export function toSong(melody, range = null) {
  const { bars } = barsOf(melody);
  const bass = parseBass(melody.bass ?? '');
  const [from, to] = range ?? [1, bars.length];
  const picked = bars.slice(from - 1, to);
  const offset = picked[0]?.start ?? 0;
  return {
    title: melody.title,
    bpm: melody.bpm,
    meter: melody.meter,
    bells: melody.bells !== false,
    voices: [
      picked.flatMap((bar) => bar.notes),
      picked.map((bar, i) => [bass[from - 1 + i] ?? 'R', bar.beats]),
    ],
    barStarts: picked.map((bar) => bar.start - offset),
  };
}

/** The door's theme song: the melody's `theme` bars, or all of it. */
export const themeSong = (melody) => toSong(melody, melody.theme ?? null);

// --- "Blandat" ---

// Melodies that only join the mix from a day of the year (MM-DD, every year, inclusive).
// Santa Lucia waits for Lucia. They can still be picked one by one in the menu.
export const MIX_FROM = {
  'santa-lucia': '12-13',
};

export const MIX_GAP = 3; // seconds of silence between two songs in the mix

/** The melodies "Blandat" may play on a day ("YYYY-MM-DD"). */
export function mixPool(todayKey) {
  const monthDay = String(todayKey).slice(5);
  return MELODY_KEYS.filter((key) => !MIX_FROM[key] || monthDay >= MIX_FROM[key]);
}

/** The next song in the mix: a random one from the pool, never `previous` twice in a row. */
export function nextInMix(pool, previous, random = Math.random) {
  const choices = pool.length > 1 ? pool.filter((key) => key !== previous) : pool;
  if (choices.length === 0) return null;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

// --- The menu choice ---

/** A stored music choice: "off", "mix" or a melody key. The old "on" means "mix". */
export function parseMusicChoice(value) {
  if (value === 'on' || value === 'mix') return 'mix';
  return MELODIES[value] ? value : 'off';
}

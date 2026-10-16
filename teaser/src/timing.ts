// All times in seconds; keep in sync with the CUES in scripts/make-audio.mjs.
export const FPS = 30;
export const DURATION_S = 34;
export const TOTAL_FRAMES = FPS * DURATION_S;
export const f = (s: number) => Math.round(s * FPS);

export const SCENES = {
  intro: [0, 3],
  house: [3, 8],
  candles: [8, 13],
  grid: [13, 20],
  montage: [20, 25],
  title: [25, 31],
  date: [31, 34],
} as const;

// candle-lighting moments, seconds (audio bells land on the same instants)
export const CANDLE_TIMES = [8.9, 9.9, 10.9, 11.9];

// Texts (Swedish). Change here to re-word the film.
export const TEXT = {
  intro: 'Det finns en tid på året...',
  house: '...då allt blir lite mjukare.',
  candles: 'Fyra söndagar. Fyra ljus.',
  grid: 'En ny lucka varje dag.',
  hoho: 'Ho ho ho...',
  title: 'Adventskalendern 2026',
  to: 'Till Elin',
  from: 'Från Johan',
  date: 'Första luckan öppnas 29\u00a0november.',
};

// All times in seconds; keep in sync with the CUES in scripts/make-audio.mjs.
export const FPS = 30;
export const DURATION_S = 36;
export const TOTAL_FRAMES = FPS * DURATION_S;
export const f = (s: number) => Math.round(s * FPS);

// The intro was lengthened by 2 s (manuscript 0-3 s -> 0-5 s); every later scene is shifted by SHIFT.
export const SHIFT = 2;
export const SCENES = {
  intro: [0, 3 + SHIFT],
  house: [3 + SHIFT, 8 + SHIFT],
  candles: [8 + SHIFT, 13 + SHIFT],
  grid: [13 + SHIFT, 20 + SHIFT],
  montage: [20 + SHIFT, 25 + SHIFT],
  title: [25 + SHIFT, 31 + SHIFT],
  date: [31 + SHIFT, 34 + SHIFT],
} as const;

// candle-lighting moments, seconds (audio bells land on the same instants)
export const CANDLE_TIMES = [8.9, 9.9, 10.9, 11.9].map((t) => t + SHIFT);

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

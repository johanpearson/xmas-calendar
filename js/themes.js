// Pure logic for how doors look. No DOM: everything here is testable with `node --test`.

import { isChristmasEve } from './dates.js';

// Door themes. Each one has its own small icon (see icons.js).
export const THEMES = ['red', 'green', 'gingerbread', 'candy', 'gold', 'plaid', 'frost'];

export const THEME_ICONS = {
  red: 'gift',
  green: 'bauble',
  gingerbread: 'gingerbread',
  candy: 'stocking',
  gold: 'star',
  plaid: 'heart',
  frost: 'bun',
};

// The grid has 4 columns on phones and 6 on wider screens. Doors this far apart in the
// list end up next to each other (left/right or above/below) in one of the layouts.
export const GRID_COLUMNS = [4, 6];

// FNV-1a: a small, stable string hash.
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32: a tiny seeded PRNG, so the "random" layout is the same on every visit.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Assigns a theme to each door in grid order. Deterministic for the same dates, looks
 * hand placed (themes are drawn from shuffled decks, so they are spread evenly) and
 * never gives two neighbouring doors the same theme in any of the grid layouts.
 * Returns an array of theme names, one per date key.
 */
export function assignThemes(dateKeys, columns = GRID_COLUMNS) {
  const random = seededRandom(hashString(dateKeys.join('|')));
  const offsets = [1, ...columns];
  const result = [];
  let deck = [];
  for (let i = 0; i < dateKeys.length; i++) {
    const taken = new Set(offsets.map((o) => result[i - o]));
    if (deck.every((t) => taken.has(t))) deck = [...deck, ...shuffled(THEMES, random)];
    const pick = deck.findIndex((t) => !taken.has(t));
    result.push(deck[pick]);
    deck.splice(pick, 1);
  }
  return result;
}

/**
 * The look of a door: Christmas Eve is a present, every other door gets its assigned theme.
 */
export function doorLook(dateKey, theme) {
  if (isChristmasEve(dateKey)) return { kind: 'christmas' };
  return { kind: 'theme', theme, icon: THEME_ICONS[theme] };
}

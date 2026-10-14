import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES,
  THEME_ICONS,
  GRID_COLUMNS,
  ANIMATIONS,
  TYPE_ANIMATIONS,
  assignThemes,
  doorLook,
  hashString,
  animationFor,
} from '../js/themes.js';

const december = (year) =>
  Array.from({ length: 24 }, (_, i) => `${year}-12-${String(i + 1).padStart(2, '0')}`);

test('there are 6 to 8 themes, each with its own icon', () => {
  assert.ok(THEMES.length >= 6 && THEMES.length <= 8);
  const icons = THEMES.map((t) => THEME_ICONS[t]);
  assert.ok(icons.every(Boolean));
  assert.equal(new Set(icons).size, THEMES.length);
});

test('hashString is stable', () => {
  assert.equal(hashString('2026-12-01'), hashString('2026-12-01'));
  assert.notEqual(hashString('2026-12-01'), hashString('2026-12-02'));
});

test('assignThemes is deterministic', () => {
  assert.deepEqual(assignThemes(december(2026)), assignThemes(december(2026)));
});

test('neighbours never share a theme in any grid layout', () => {
  for (const year of [2026, 2027, 2028, 2030]) {
    const themes = assignThemes(december(year));
    assert.equal(themes.length, 24);
    for (const cols of GRID_COLUMNS) {
      themes.forEach((theme, i) => {
        const sameRow = Math.floor(i / cols) === Math.floor((i + 1) / cols);
        if (sameRow && i + 1 < themes.length) assert.notEqual(theme, themes[i + 1], `${year} ${i} right (${cols})`);
        if (i + cols < themes.length) assert.notEqual(theme, themes[i + cols], `${year} ${i} below (${cols})`);
      });
    }
  }
});

test('themes are spread out and all used', () => {
  const themes = assignThemes(december(2026));
  const counts = THEMES.map((t) => themes.filter((x) => x === t).length);
  assert.ok(Math.min(...counts) >= 2, `counts ${counts}`);
  assert.ok(Math.max(...counts) <= 5, `counts ${counts}`);
});

test('assignThemes handles short and empty lists', () => {
  assert.deepEqual(assignThemes([]), []);
  assert.equal(assignThemes(['2026-12-01']).length, 1);
});

test('doorLook: advent Sundays get candles', () => {
  assert.deepEqual(doorLook('2026-11-29', 'red'), { kind: 'advent', advent: 1 });
  assert.deepEqual(doorLook('2026-12-06', 'red'), { kind: 'advent', advent: 2 });
  assert.deepEqual(doorLook('2026-12-13', 'red'), { kind: 'advent', advent: 3 });
  assert.deepEqual(doorLook('2026-12-20', 'red'), { kind: 'advent', advent: 4 });
  // When Christmas Eve is the fourth advent, the present wins.
  assert.deepEqual(doorLook('2023-12-24', 'red'), { kind: 'christmas' });
});

test('doorLook: Christmas Eve is a present, other days use their theme', () => {
  assert.deepEqual(doorLook('2026-12-24', 'red'), { kind: 'christmas' });
  assert.deepEqual(doorLook('2027-12-24', 'red'), { kind: 'christmas' });
  assert.deepEqual(doorLook('2026-12-03', 'gold'), { kind: 'theme', theme: 'gold', icon: 'star' });
});

test('animationFor uses the type default unless the day overrides it', () => {
  assert.equal(animationFor({ type: 'ledtrad' }), 'sparkle');
  assert.equal(animationFor({ type: 'litet' }), 'gift');
  assert.equal(animationFor({ type: 'uppdrag' }), 'bells');
  assert.equal(animationFor({ type: 'rim' }), 'ribbon');
  assert.equal(animationFor({ type: 'jakt' }), 'magnifier');
  assert.equal(animationFor({ type: 'okänd' }), 'sparkle');
  assert.equal(animationFor({ type: 'rim', animation: 'snowburst' }), 'snowburst');
  assert.equal(animationFor({ type: 'rim', animation: 'fireworks' }), 'ribbon');
  for (const name of Object.values(TYPE_ANIMATIONS)) assert.ok(ANIMATIONS.includes(name));
});

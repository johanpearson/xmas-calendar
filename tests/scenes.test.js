// js/scenes.js: the registry and how it fits content/days.json. Drawing, cleanup and timers
// are tested in a real browser in tests/e2e/scenes.spec.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENES, SCENE_KEYS, HOME_SCENE_KEYS, isScene, homeSceneFor } from '../js/scenes.js';

const { days } = JSON.parse(readFileSync(new URL('../content/days.json', import.meta.url), 'utf8'));

test('every scene in days.json is in the registry', () => {
  for (const d of days) {
    if ('scene' in d) assert.ok(isScene(d.scene), `${d.date}: unknown scene ${JSON.stringify(d.scene)} (see SCENES in js/scenes.js)`);
  }
});

test('every scene has a label and a render function', () => {
  assert.ok(SCENE_KEYS.length > 0);
  for (const key of SCENE_KEYS) {
    assert.equal(typeof SCENES[key].label, 'string', key);
    assert.ok(SCENES[key].label.length > 0, key);
    assert.equal(typeof SCENES[key].render, 'function', key);
  }
});

test('the scenes on the main screen are the advent Sundays, Lucia, the cat and Christmas', () => {
  assert.deepEqual([...HOME_SCENE_KEYS].sort(), ['advent1', 'advent2', 'advent4', 'cat', 'christmas', 'lucia']);
});

test('isScene only knows the registry, not inherited names', () => {
  assert.ok(isScene('lucia'));
  assert.ok(!isScene('nope'));
  assert.ok(!isScene('toString'));
  assert.ok(!isScene(undefined));
});

test('homeSceneFor: only on the door\'s own date and only for main-screen scenes', () => {
  const list = [
    { date: '2026-12-12', scene: 'party' },
    { date: '2026-12-13', scene: 'lucia' },
    { date: '2026-12-14', scene: 'unknown' },
    { date: '2026-12-15' },
  ];
  assert.equal(homeSceneFor(list, '2026-12-13'), 'lucia');
  assert.equal(homeSceneFor(list, '2026-12-12'), null); // party has no main-screen version
  assert.equal(homeSceneFor(list, '2026-12-14'), null);
  assert.equal(homeSceneFor(list, '2026-12-15'), null);
  assert.equal(homeSceneFor(list, '2026-12-16'), null);
});

test('this year: the main screen shows Lucia on the 13th, Hiro on the 4th and the tree on the 24th', () => {
  assert.equal(homeSceneFor(days, '2026-12-13'), 'lucia');
  assert.equal(homeSceneFor(days, '2026-12-04'), 'cat');
  assert.equal(homeSceneFor(days, '2026-12-24'), 'christmas');
  assert.equal(homeSceneFor(days, '2026-11-29'), 'advent1');
  assert.equal(homeSceneFor(days, '2026-12-05'), null);
});

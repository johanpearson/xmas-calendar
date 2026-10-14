// Tomten: which conversation shows when, question replies and the closing line,
// plus validation of content/tomte.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeTomte,
  isSceneActive,
  currentScene,
  pickStartup,
  emptySeen,
  getWeatherVariant,
  buildScript,
  replyFor,
  closingFor,
  stepHasText,
} from '../js/tomte.js';

const raw = readFileSync(new URL('../content/tomte.json', import.meta.url), 'utf8');

const questions = [
  { id: 'gran', text: 'Gran?', options: [{ label: 'Ja', reply: 'Fint!' }, { label: 'Inte än', reply: 'Dags nu.' }] },
  { id: 'ljus', text: 'Ljus?', options: [{ label: 'Ja', reply: 'Perfekt.' }, { label: 'Inte än', reply: 'Snart.' }] },
];

const fixture = () =>
  normalizeTomte({
    intro: { lines: ['Hej!'] },
    welcome: { lines: ['Välkommen!'] },
    scenes: [
      { id: 'a', from: '2026-12-01', until: '2026-12-03', lines: ['A'] },
      { id: 'b', from: '2026-12-04', until: '2026-12-06', lines: ['B'], questions, closing: { allPositive: 'Bra!', someNegative: 'Kämpa!' } },
      { id: 'c', from: '2026-12-05', until: '2026-12-08', lines: ['C'] },
      {
        id: 'w',
        from: '2026-12-14',
        until: '2026-12-17',
        forecastFor: ['2026-12-19'],
        lines: ['Väder:'],
        weatherVariants: { good: ['Sol'], bad: ['Regn'], unknown: ['Vet inte'] },
      },
    ],
  });

// Seen state with intro and welcome done, so scenes are up.
const afterIntro = () => ({ ...emptySeen(), intro: true, welcome: true });

const start = (todayKey, seen = afterIntro(), standalone = false) =>
  pickStartup({ tomte: fixture(), todayKey, standalone, seen });

// --- Scene window ---

test('a scene is not shown before its first day', () => {
  const scene = fixture().scenes[0];
  assert.equal(isSceneActive(scene, '2026-11-30'), false);
  assert.equal(start('2026-11-30'), null);
});

test('a scene is shown on its first day', () => {
  assert.equal(isSceneActive(fixture().scenes[0], '2026-12-01'), true);
  assert.equal(start('2026-12-01').scene.id, 'a');
});

test('a scene is shown on its last day', () => {
  assert.equal(isSceneActive(fixture().scenes[0], '2026-12-03'), true);
  assert.equal(start('2026-12-03').scene.id, 'a');
});

test('a scene is not shown after its last day', () => {
  assert.equal(isSceneActive(fixture().scenes[0], '2026-12-04'), false);
  assert.notEqual(start('2026-12-04')?.scene.id, 'a');
  assert.equal(start('2026-12-09'), null);
});

// --- Once per scene ---

test('each scene shows only once', () => {
  const first = start('2026-12-02');
  assert.equal(first.kind, 'scene');
  assert.equal(first.scene.id, 'a');
  assert.deepEqual(first.seen.scenes, ['a']);
  assert.equal(start('2026-12-02', first.seen), null);
  assert.equal(start('2026-12-03', first.seen), null);
});

test('when several scenes are possible, the latest from wins and the others are marked seen', () => {
  // b (from 12-04) and c (from 12-05) overlap on 12-05 and 12-06.
  const pick = start('2026-12-05');
  assert.equal(pick.scene.id, 'c');
  assert.deepEqual([...pick.seen.scenes].sort(), ['b', 'c']);
  // b never pops up later, even though its window is still open.
  assert.equal(start('2026-12-06', pick.seen), null);
});

test('an overlapping scene that was already seen does not block the other one', () => {
  const seen = { ...afterIntro(), scenes: ['c'] };
  assert.equal(start('2026-12-05', seen).scene.id, 'b');
});

test('currentScene ignores seen state (used by the dev panel)', () => {
  assert.equal(currentScene(fixture().scenes, '2026-12-05').id, 'c');
  assert.equal(currentScene(fixture().scenes, '2026-11-01'), null);
});

// --- At most one per start, intro and welcome first ---

test('at most one Tomte per start: intro goes before a scene', () => {
  const first = start('2026-12-02', emptySeen());
  assert.equal(first.kind, 'intro');
  assert.deepEqual(first.seen.scenes, [], 'the scene is still waiting');
  const second = start('2026-12-02', first.seen);
  assert.equal(second.kind, 'scene');
  assert.equal(second.scene.id, 'a');
});

test('welcome goes before a scene when installed', () => {
  const seen = { ...emptySeen(), intro: true };
  const first = start('2026-12-02', seen, true);
  assert.equal(first.kind, 'welcome');
  assert.equal(start('2026-12-02', first.seen, true).scene.id, 'a');
});

// --- Intro versus welcome ---

test('intro shows in a browser tab, welcome when installed, each once', () => {
  const browser = start('2026-10-14', emptySeen(), false);
  assert.equal(browser.kind, 'intro');
  assert.deepEqual(browser.seen, { intro: true, welcome: false, scenes: [] });
  assert.equal(start('2026-10-14', browser.seen, false), null);

  const installed = start('2026-10-14', browser.seen, true);
  assert.equal(installed.kind, 'welcome');
  assert.equal(start('2026-10-14', installed.seen, true), null);
});

test('intro and welcome have separate flags', () => {
  // Installed first (e.g. iOS, where the installed app has its own storage): welcome only.
  const installed = start('2026-10-14', emptySeen(), true);
  assert.equal(installed.kind, 'welcome');
  assert.equal(installed.seen.intro, false);
  // The browser tab still gets its intro.
  assert.equal(start('2026-10-14', installed.seen, false).kind, 'intro');
});

test('no intro in standalone and no welcome in a browser tab', () => {
  const seen = { ...emptySeen(), welcome: true };
  assert.equal(start('2026-10-14', seen, true), null);
  const seen2 = { ...emptySeen(), intro: true };
  assert.equal(start('2026-10-14', seen2, false), null);
});

test('missing intro or welcome in the content is skipped', () => {
  const tomte = normalizeTomte({ scenes: [{ id: 'a', from: '2026-12-01', until: '2026-12-03', lines: ['A'] }] });
  assert.equal(pickStartup({ tomte, todayKey: '2026-12-01', standalone: false }).scene.id, 'a');
  assert.equal(pickStartup({ tomte, todayKey: '2026-12-01', standalone: true }).scene.id, 'a');
});

// --- Questions and closing ---

test('each option gives its own reply', () => {
  assert.equal(replyFor(questions[0], 0), 'Fint!');
  assert.equal(replyFor(questions[0], 1), 'Dags nu.');
  assert.equal(replyFor(questions[0], 5), null);
});

test('closing: allPositive only when every answer is the first option', () => {
  const scene = fixture().scenes[1];
  assert.equal(closingFor(scene, { gran: 0, ljus: 0 }), 'Bra!');
  assert.equal(closingFor(scene, { gran: 0, ljus: 1 }), 'Kämpa!');
  assert.equal(closingFor(scene, { gran: 1, ljus: 1 }), 'Kämpa!');
  assert.equal(closingFor(scene, { gran: 0 }), 'Kämpa!', 'an unanswered question is not positive');
});

test('closing is optional', () => {
  const scene = normalizeTomte({
    scenes: [{ id: 'q', from: '2026-12-01', until: '2026-12-01', lines: ['Hej'], questions: [questions[0]] }],
  }).scenes[0];
  assert.equal(closingFor(scene, { gran: 0 }), null);
  assert.deepEqual(buildScript(scene).map((s) => s.kind), ['line', 'question']);

  const onlyPositive = normalizeTomte({
    scenes: [{ id: 'q', from: '2026-12-01', until: '2026-12-01', questions: [questions[0]], closing: { allPositive: 'Ja!' } }],
  }).scenes[0];
  const closing = buildScript(onlyPositive).at(-1);
  assert.equal(closing.kind, 'closing');
  assert.equal(stepHasText(closing, onlyPositive, { gran: 0 }), true);
  assert.equal(stepHasText(closing, onlyPositive, { gran: 1 }), false);
});

test('a scene script: lines, then questions, then closing', () => {
  const steps = buildScript(fixture().scenes[1]);
  assert.deepEqual(
    steps.map((s) => s.kind),
    ['line', 'question', 'question', 'closing'],
  );
  assert.equal(steps[1].question.id, 'gran');
});

// --- Weather ---

test('getWeatherVariant is "unknown" for now', () => {
  assert.equal(getWeatherVariant(['2026-12-19', '2026-12-20']), 'unknown');
  assert.equal(getWeatherVariant([]), 'unknown');
});

test('weather scenes add the chosen variant after their lines', () => {
  const scene = fixture().scenes[3];
  const texts = (weather) => buildScript(scene, { weather }).map((s) => s.text);
  assert.deepEqual(texts(getWeatherVariant(scene.forecastFor)), ['Väder:', 'Vet inte']);
  assert.deepEqual(texts('good'), ['Väder:', 'Sol']);
  assert.deepEqual(texts('storm'), ['Väder:', 'Vet inte'], 'unknown variants fall back to unknown');
});

// --- Validation ---

test('normalizeTomte rejects broken content', () => {
  const scene = { id: 'a', from: '2026-12-01', until: '2026-12-02', lines: ['A'] };
  assert.throws(() => normalizeTomte(null));
  assert.throws(() => normalizeTomte({ scenes: [{ ...scene, from: '2026-12-1' }] }));
  assert.throws(() => normalizeTomte({ scenes: [{ ...scene, from: '2026-12-03' }] }), /ends before/);
  assert.throws(() => normalizeTomte({ scenes: [scene, scene] }), /duplicate/);
  assert.throws(() => normalizeTomte({ scenes: [{ ...scene, lines: [] }] }), /nothing to say/);
  assert.throws(() => normalizeTomte({ scenes: [{ ...scene, questions: [{ id: 'x', text: 'X', options: [] }] }] }));
  assert.throws(() => normalizeTomte({ scenes: [{ ...scene, questions: [{ id: 'x', text: 'X', options: [{ label: 'Ja' }] }] }] }));
  assert.throws(() => normalizeTomte({ intro: { lines: 'Hej' } }));
});

test('normalizeTomte fills in intro button defaults', () => {
  const { name, intro } = normalizeTomte({ intro: { lines: ['Hej'] } });
  assert.equal(name, 'Tomten');
  assert.equal(intro.doneButton, 'Nu kör vi');
  assert.ok(intro.installButton && intro.installHelp);
});

test('content/tomte.json is valid', () => {
  const tomte = normalizeTomte(JSON.parse(raw));
  assert.ok(tomte.intro, 'has an intro');
  assert.ok(tomte.welcome, 'has a welcome');
  assert.ok(tomte.scenes.length > 0, 'has scenes');
  for (const s of tomte.scenes) {
    if (s.weatherVariants) assert.ok(s.weatherVariants.unknown.length > 0, `${s.id} needs unknown weather lines`);
  }
});

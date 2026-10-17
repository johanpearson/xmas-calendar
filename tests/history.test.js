// The history behind "Tidigare repliker" (milestone 16): saving finished conversations,
// their order, answers and weather lines, and the cards built from tomte.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTomte } from '../js/tomte.js';
import { normalizeHistory, recordEntry, historyCards, exampleHistory, WELCOME_ID } from '../js/history.js';
import { formatShortDate } from '../js/dates.js';

const tomte = normalizeTomte(JSON.parse(readFileSync(new URL('../content/tomte.json', import.meta.url), 'utf8')));
const scene = (id) => tomte.scenes.find((s) => s.id === id);

function fakeStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  return data;
}

test('recordEntry saves id, date, answers and variant', () => {
  const { history, added } = recordEntry([], { id: 'v1-uppfoljning', date: '2026-12-03', answers: { gran: 0, ljusstakar: 1 }, variant: null });
  assert.equal(added, true);
  assert.deepEqual(history, [{ id: 'v1-uppfoljning', date: '2026-12-03', answers: { gran: 0, ljusstakar: 1 }, variant: null }]);
});

test('recordEntry never saves the same conversation twice', () => {
  const first = recordEntry([], { id: 'a', date: '2026-12-01', answers: {}, variant: null });
  const again = recordEntry(first.history, { id: 'a', date: '2026-12-09', answers: { x: 1 }, variant: 'bad' });
  assert.equal(again.added, false);
  assert.equal(again.history, first.history);
  assert.equal(again.history[0].date, '2026-12-01');
});

test('recordEntry ignores entries without a valid id or date', () => {
  assert.equal(recordEntry([], { id: '', date: '2026-12-01' }).added, false);
  assert.equal(recordEntry([], { id: 'a', date: 'imorgon' }).added, false);
  assert.equal(recordEntry([], null).added, false);
});

test('normalizeHistory drops broken and duplicate entries and cleans answers and variant', () => {
  const history = normalizeHistory([
    { id: 'a', date: '2026-12-01', answers: { q: 1, bad: 'x', neg: -1 }, variant: 'sunny' },
    { id: 'a', date: '2026-12-02', answers: {}, variant: null },
    { id: 7, date: '2026-12-02' },
    'text',
    { id: 'b', date: '2026-12-02', variant: 'bad' },
  ]);
  assert.deepEqual(history, [
    { id: 'a', date: '2026-12-01', answers: { q: 1 }, variant: null },
    { id: 'b', date: '2026-12-02', answers: {}, variant: 'bad' },
  ]);
  assert.deepEqual(normalizeHistory('nope'), []);
});

test('the intro is not a history id: it has no card even if it were saved', () => {
  const cards = historyCards([{ id: 'intro', date: '2026-12-01', answers: {}, variant: null }], tomte);
  assert.deepEqual(cards, []);
});

test('cards are newest first, and within a day the one played last comes first', () => {
  const history = [
    { id: 'v1-stamning', date: '2026-11-30', answers: {}, variant: null },
    { id: WELCOME_ID, date: '2026-12-03', answers: {}, variant: null },
    { id: 'v1-uppfoljning', date: '2026-12-03', answers: { gran: 0, ljusstakar: 0 }, variant: null },
  ];
  assert.deepEqual(historyCards(history, tomte).map((c) => c.id), ['v1-uppfoljning', WELCOME_ID, 'v1-stamning']);
});

test('a card has the date and Tomten\'s lines from tomte.json', () => {
  const [card] = historyCards([{ id: 'v1-stamning', date: '2026-11-30', answers: {}, variant: null }], tomte);
  assert.equal(card.date, '2026-11-30');
  assert.deepEqual(card.parts, scene('v1-stamning').lines.map((text) => ({ kind: 'line', text })));
});

test('questions show the chosen option, Tomten\'s reply and the closing line', () => {
  const s = scene('v1-uppfoljning');
  const [card] = historyCards([{ id: s.id, date: '2026-12-03', answers: { gran: 1, ljusstakar: 0 }, variant: null }], tomte);
  const questions = card.parts.filter((p) => p.kind === 'question');
  assert.equal(questions.length, s.questions.length);
  assert.equal(questions[0].answer, s.questions[0].options[1].label);
  assert.equal(questions[0].reply, s.questions[0].options[1].reply);
  assert.equal(questions[1].answer, s.questions[1].options[0].label);
  // One answer was not the first option, so the closing is someNegative.
  assert.equal(card.parts.at(-1).text, s.closing.someNegative);
});

test('an unanswered question shows only the question', () => {
  const s = scene('v1-uppfoljning');
  const [card] = historyCards([{ id: s.id, date: '2026-12-03', answers: {}, variant: null }], tomte);
  const question = card.parts.find((p) => p.kind === 'question');
  assert.equal(question.answer, null);
  assert.equal(question.reply, null);
});

test('a weather scene shows the saved variant, not another one', () => {
  const s = tomte.scenes.find((x) => x.weatherVariants);
  for (const variant of ['good', 'bad', 'unknown']) {
    const [card] = historyCards([{ id: s.id, date: s.from, answers: {}, variant }], tomte);
    const texts = card.parts.map((p) => p.text);
    for (const line of s.weatherVariants[variant]) assert.ok(texts.includes(line), `${variant}: missing a line`);
    for (const other of ['good', 'bad', 'unknown'].filter((v) => v !== variant)) {
      for (const line of s.weatherVariants[other]) {
        if (!s.weatherVariants[variant].includes(line)) assert.ok(!texts.includes(line), `${variant} shows a ${other} line`);
      }
    }
  }
});

test('texts come from tomte.json at the time: an edited line shows up, a removed scene is skipped', () => {
  const edited = structuredClone(tomte);
  edited.scenes[0].lines[0] = 'Ny text.';
  const history = [
    { id: edited.scenes[0].id, date: '2026-11-30', answers: {}, variant: null },
    { id: 'finns-inte-mer', date: '2026-12-01', answers: {}, variant: null },
  ];
  const cards = historyCards(history, edited);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].parts[0].text, 'Ny text.');
});

test('only conversations in the history are shown: nothing from later scenes', () => {
  const [card] = historyCards([{ id: 'v1-stamning', date: '2026-11-30', answers: {}, variant: null }], tomte);
  const all = JSON.stringify(historyCards([{ id: 'v1-stamning', date: '2026-11-30', answers: {}, variant: null }], tomte));
  assert.equal(card.id, 'v1-stamning');
  for (const later of tomte.scenes.filter((s) => s.id !== 'v1-stamning')) {
    for (const line of later.lines) assert.ok(!all.includes(line));
  }
  assert.deepEqual(historyCards([], tomte), []);
});

test('exampleHistory covers the welcome and every scene and is valid', () => {
  const history = exampleHistory(tomte);
  assert.equal(history.length, tomte.scenes.length + 1);
  assert.deepEqual(history, normalizeHistory(history));
  assert.equal(historyCards(history, tomte).length, history.length);
});

test('formatShortDate: weekday, day and short month without a period', () => {
  assert.equal(formatShortDate('2026-12-07'), 'mån 7 dec');
  assert.equal(formatShortDate('2026-11-30'), 'mån 30 nov');
});

test('the history is saved in localStorage and read back after a restart', async () => {
  const data = fakeStorage();
  const storage = await import('../js/storage.js');
  assert.deepEqual(storage.getHistory(), []);
  let { history } = recordEntry(storage.getHistory(), { id: 'v1-stamning', date: '2026-11-30', answers: {}, variant: null });
  storage.setHistory(history);
  ({ history } = recordEntry(storage.getHistory(), { id: 'v1-uppfoljning', date: '2026-12-03', answers: { gran: 0 }, variant: null }));
  storage.setHistory(history);
  assert.deepEqual(storage.getHistory().map((e) => e.id), ['v1-stamning', 'v1-uppfoljning']);
  assert.deepEqual(storage.getHistory()[1].answers, { gran: 0 });
  data.set('advent.tomte.history', '{broken');
  assert.deepEqual(storage.getHistory(), []);
});

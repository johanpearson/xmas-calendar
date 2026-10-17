// Pure logic for the history of Tomten's conversations (milestone 16): what to save when
// a scene has been played, and how to turn the saved entries into cards for the history
// sheet. No DOM, no storage; testable with `node --test`.
//
// An entry is { id, date, answers, variant }:
//   id       the scene's id in tomte.json, or "welcome"
//   date     the app's "today" when it was played (a dev date counts)
//   answers  { questionId: optionIndex }
//   variant  the weather variant that was shown ("good", "bad", "unknown"), or null
// The texts are not saved, they are looked up in tomte.json by id when the sheet opens,
// so a text can be corrected later. The intro is never saved.

import { isValidDateKey } from './dates.js';
import { buildScript, closingFor, replyFor, resolveVariant, WEATHER_VARIANTS } from './tomte.js';

export const WELCOME_ID = 'welcome';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeEntry(entry) {
  if (!isPlainObject(entry) || typeof entry.id !== 'string' || entry.id === '' || !isValidDateKey(entry.date)) return null;
  const answers = {};
  if (isPlainObject(entry.answers)) {
    for (const [question, index] of Object.entries(entry.answers)) {
      if (Number.isInteger(index) && index >= 0) answers[question] = index;
    }
  }
  const variant = WEATHER_VARIANTS.includes(entry.variant) ? entry.variant : null;
  return { id: entry.id, date: entry.date, answers, variant };
}

// Whatever came out of storage becomes a clean list (bad entries and duplicate ids dropped).
export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const history = [];
  for (const raw of value) {
    const entry = normalizeEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    history.push(entry);
  }
  return history;
}

/**
 * Adds a finished conversation. Returns { history, added }: an id that is already in the
 * history is not saved twice (`added` false, the history unchanged).
 */
export function recordEntry(history, entry) {
  const clean = normalizeEntry(entry);
  if (!clean || history.some((e) => e.id === clean.id)) return { history, added: false };
  return { history: [...history, clean], added: true };
}

// The scene (or the welcome) an entry points at in tomte.json, or null if it is gone.
function itemFor(tomte, id) {
  if (id === WELCOME_ID) return tomte.welcome ?? null;
  return tomte.scenes.find((scene) => scene.id === id) ?? null;
}

/**
 * Cards for the history sheet, newest first (same date: the one played last first).
 * Each card is { id, date, welcome, parts }, where parts are
 *   { kind: 'line', text }                      something Tomten said
 *   { kind: 'question', text, answer, reply }   the question, the label of the chosen
 *                                               option (null if unanswered) and Tomten's reply
 * Entries whose scene no longer exists in tomte.json are left out.
 */
export function historyCards(history, tomte) {
  const cards = [];
  history.forEach((entry, order) => {
    const item = itemFor(tomte, entry.id);
    if (!item) return;
    const answers = entry.answers;
    const parts = [];
    for (const step of buildScript(item, { weather: entry.variant ?? 'unknown' })) {
      if (step.kind === 'line') parts.push({ kind: 'line', text: step.text });
      else if (step.kind === 'closing') {
        const text = closingFor(item, answers);
        if (text) parts.push({ kind: 'line', text });
      } else {
        const index = answers[step.question.id];
        const option = step.question.options[index];
        parts.push({
          kind: 'question',
          text: step.question.text,
          answer: option?.label ?? null,
          reply: option ? replyFor(step.question, index) : null,
        });
      }
    }
    if (parts.length) cards.push({ id: entry.id, date: entry.date, welcome: entry.id === WELCOME_ID, parts, order });
  });
  cards.sort((a, b) => (a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1));
  return cards.map(({ order, ...card }) => card);
}

/**
 * A made-up history for the dev panel: the welcome and every scene, each on the scene's
 * first day, with the first option answered everywhere and the "good" weather lines.
 */
export function exampleHistory(tomte) {
  const first = tomte.scenes.map((s) => s.from).sort()[0];
  const entries = [];
  if (tomte.welcome && first) entries.push({ id: WELCOME_ID, date: first, answers: {}, variant: null });
  for (const scene of tomte.scenes) {
    const answers = Object.fromEntries((scene.questions ?? []).map((q) => [q.id, 0]));
    entries.push({ id: scene.id, date: scene.from, answers, variant: resolveVariant(scene, 'good') });
  }
  return normalizeHistory(entries);
}

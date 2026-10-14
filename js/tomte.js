// Pure logic for Tomten (the Santa who talks to the recipient). No DOM, no storage:
// everything here is testable with `node --test`. The UI lives in tomte-ui.js and the
// lines in content/tomte.json.

import { isValidDateKey } from './dates.js';

export const WEATHER_VARIANTS = ['good', 'bad', 'unknown'];

const DEFAULT_NAME = 'Tomten';
const DEFAULT_INTRO_BUTTONS = {
  installButton: 'Installera appen',
  installHelp: 'Om knappen inte syns: öppna webbläsarens meny och välj Installera app eller Lägg till på startskärmen.',
  doneButton: 'Nu kör vi',
};

const isText = (value) => typeof value === 'string' && value.trim() !== '';

function textList(value, where) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isText)) throw new Error(`tomte.json: ${where} must be a list of texts`);
  return [...value];
}

function optionalText(value, where) {
  if (value === undefined) return undefined;
  if (!isText(value)) throw new Error(`tomte.json: ${where} must be a text`);
  return value;
}

function normalizeQuestion(q, where) {
  if (!q || !isText(q.id) || !isText(q.text)) throw new Error(`tomte.json: ${where} needs an id and a text`);
  if (!Array.isArray(q.options) || q.options.length === 0) throw new Error(`tomte.json: ${where} needs options`);
  const options = q.options.map((o, i) => {
    if (!o || !isText(o.label) || !isText(o.reply)) {
      throw new Error(`tomte.json: ${where}, option ${i} needs a label and a reply`);
    }
    return { label: o.label, reply: o.reply };
  });
  return { id: q.id, text: q.text, options };
}

function normalizeScene(s, i) {
  const where = `scene ${i}`;
  if (!s || !isText(s.id)) throw new Error(`tomte.json: ${where} needs an id`);
  if (!isValidDateKey(s.from) || !isValidDateKey(s.until)) throw new Error(`tomte.json: ${s.id} has an invalid from/until`);
  if (s.from > s.until) throw new Error(`tomte.json: ${s.id} ends before it starts`);
  const scene = { id: s.id, from: s.from, until: s.until, lines: textList(s.lines, `${s.id}.lines`) };

  if (s.questions !== undefined) {
    if (!Array.isArray(s.questions)) throw new Error(`tomte.json: ${s.id}.questions must be a list`);
    scene.questions = s.questions.map((q, qi) => normalizeQuestion(q, `${s.id}, question ${qi}`));
    const ids = new Set(scene.questions.map((q) => q.id));
    if (ids.size !== scene.questions.length) throw new Error(`tomte.json: ${s.id} has duplicate question ids`);
  }
  if (s.closing !== undefined) {
    scene.closing = {
      allPositive: optionalText(s.closing?.allPositive, `${s.id}.closing.allPositive`),
      someNegative: optionalText(s.closing?.someNegative, `${s.id}.closing.someNegative`),
    };
  }
  if (s.weatherVariants !== undefined) {
    scene.weatherVariants = {};
    for (const name of WEATHER_VARIANTS) {
      scene.weatherVariants[name] = textList(s.weatherVariants?.[name], `${s.id}.weatherVariants.${name}`);
    }
  }
  if (s.forecastFor !== undefined) {
    if (!Array.isArray(s.forecastFor) || !s.forecastFor.every(isValidDateKey)) {
      throw new Error(`tomte.json: ${s.id}.forecastFor must be a list of dates`);
    }
    scene.forecastFor = [...s.forecastFor];
  }
  if (scene.lines.length === 0 && !scene.questions?.length && !scene.weatherVariants) {
    throw new Error(`tomte.json: ${s.id} has nothing to say`);
  }
  return scene;
}

/**
 * Validates content/tomte.json and fills in defaults. Throws on anything that would
 * make Tomten show the wrong thing (bad dates, duplicate ids, missing texts).
 */
export function normalizeTomte(json) {
  if (!json || typeof json !== 'object') throw new Error('tomte.json: not an object');
  const result = { name: optionalText(json.name, 'name') ?? DEFAULT_NAME, scenes: [] };

  if (json.intro !== undefined) {
    result.intro = { lines: textList(json.intro?.lines, 'intro.lines') };
    for (const [key, fallback] of Object.entries(DEFAULT_INTRO_BUTTONS)) {
      result.intro[key] = optionalText(json.intro[key], `intro.${key}`) ?? fallback;
    }
  }
  if (json.welcome !== undefined) result.welcome = { lines: textList(json.welcome?.lines, 'welcome.lines') };

  if (json.scenes !== undefined) {
    if (!Array.isArray(json.scenes)) throw new Error('tomte.json: "scenes" must be a list');
    result.scenes = json.scenes.map(normalizeScene);
    const ids = new Set(result.scenes.map((s) => s.id));
    if (ids.size !== result.scenes.length) throw new Error('tomte.json: duplicate scene ids');
  }
  return result;
}

// --- Which Tomte to show ---

// A scene is active from its first day to its last day, both inclusive.
export function isSceneActive(scene, todayKey) {
  return scene.from <= todayKey && todayKey <= scene.until;
}

// The scene the date points at (latest `from` wins), ignoring what has been seen.
export function currentScene(scenes, todayKey) {
  return pickLatest(scenes.filter((s) => isSceneActive(s, todayKey)));
}

// Latest `from` wins; on a tie, the one listed last.
function pickLatest(scenes) {
  let best = null;
  for (const s of scenes) if (!best || s.from >= best.from) best = s;
  return best;
}

export function emptySeen() {
  return { intro: false, welcome: false, scenes: [] };
}

/**
 * Decides what Tomten shows at app start. At most one thing per start:
 *  1. intro, the first time the app runs in a normal browser tab
 *  2. welcome, the first time it runs installed (standalone)
 *  3. otherwise an active, unseen scene (latest `from` wins)
 * Returns null (nothing to show) or { kind: 'intro' | 'welcome' | 'scene', scene?, seen },
 * where `seen` is the updated seen state to save. Scenes passed over because a later one
 * won are marked seen too, so they never pop up out of order later.
 */
export function pickStartup({ tomte, todayKey, standalone, seen = emptySeen() }) {
  const seenScenes = new Set(seen.scenes);
  if (!standalone && tomte.intro && !seen.intro) {
    return { kind: 'intro', seen: { ...seen, intro: true } };
  }
  if (standalone && tomte.welcome && !seen.welcome) {
    return { kind: 'welcome', seen: { ...seen, welcome: true } };
  }
  const candidates = tomte.scenes.filter((s) => isSceneActive(s, todayKey) && !seenScenes.has(s.id));
  if (candidates.length === 0) return null;
  for (const s of candidates) seenScenes.add(s.id);
  return { kind: 'scene', scene: pickLatest(candidates), seen: { ...seen, scenes: [...seenScenes] } };
}

// --- Scripts: what Tomten says, step by step ---

/**
 * The steps of a conversation. Each step is one of
 *   { kind: 'line', text }
 *   { kind: 'question', question }
 *   { kind: 'closing' }   (resolved with closingFor() once the answers are in)
 * For intro and welcome, pass { lines }. For a scene, weather lines follow its own lines,
 * then the questions, then the closing (if the scene has one).
 */
export function buildScript(item, { weather = 'unknown' } = {}) {
  const steps = (item.lines ?? []).map((text) => ({ kind: 'line', text }));
  if (item.weatherVariants) {
    const variant = item.weatherVariants[weather]?.length ? weather : 'unknown';
    for (const text of item.weatherVariants[variant] ?? []) steps.push({ kind: 'line', text });
  }
  for (const question of item.questions ?? []) steps.push({ kind: 'question', question });
  if (item.questions?.length && item.closing) steps.push({ kind: 'closing' });
  return steps;
}

// The first option counts as the positive answer.
export function isPositive(optionIndex) {
  return optionIndex === 0;
}

export function replyFor(question, optionIndex) {
  return question.options[optionIndex]?.reply ?? null;
}

/**
 * The closing line after the last question: allPositive when every question was answered
 * with its first option, otherwise someNegative. `answers` maps question id to option index.
 * Returns null when the scene has no closing (or not that variant).
 */
export function closingFor(scene, answers = {}) {
  if (!scene.closing || !scene.questions?.length) return null;
  const allPositive = scene.questions.every((q) => isPositive(answers[q.id]));
  return (allPositive ? scene.closing.allPositive : scene.closing.someNegative) ?? null;
}

// True when a step will put something in the bubble (a closing may resolve to nothing).
export function stepHasText(step, scene, answers) {
  return step.kind !== 'closing' || closingFor(scene, answers) !== null;
}

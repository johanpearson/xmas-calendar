// Tomten's UI: an SVG Santa with a speech bubble in a modal dialog. "Nästa" steps through
// the lines, questions get one button per answer. What to show and when is decided in
// tomte.js; the lines come from content/tomte.json and are always set with textContent.

import {
  normalizeTomte,
  pickStartup,
  buildScript,
  replyFor,
  closingFor,
  stepHasText,
} from './tomte.js';
import { getWeatherVariant, provider as weatherProvider } from './weather.js';
import {
  getTomteSeen,
  setTomteSeen,
  getTomteAnswers,
  saveTomteAnswer,
  isDevEnabled,
  getForecastOverride,
  getRandomBag,
  setRandomBag,
} from './storage.js';
import { drawLine, normalizeRandom } from './tomte-random.js';
import { toDateKey } from './dates.js';
import { canInstall, onInstallChange, promptInstall } from './install.js';
import { playEffect, tomteArrives, tomteLeaves, tomteSpeaks } from './audio.js';
import { soundButton } from './audio-ui.js';
import { SANTA_SVG } from './santa-svg.js';

const TOMTE_URL = './content/tomte.json';
const RANDOM_URL = './content/tomte-random.json';
const LAST_BUTTON = 'Hej då!';

let openHistory = () => {}; // replaced by the history sheet

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const btn = el('button', className, text);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

// The random lines for the peeking Santa; throws when the file is missing or unusable.
export async function loadRandom() {
  const res = await fetch(RANDOM_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`tomte-random.json: HTTP ${res.status}`);
  return normalizeRandom(await res.json());
}

export async function loadTomte() {
  const res = await fetch(TOMTE_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`tomte.json: HTTP ${res.status}`);
  return normalizeTomte(await res.json());
}

/**
 * Creates Tomten for the given content. Returns { play, check, isOpen, whenClosed }.
 *  play(kind, scene?)  shows intro, welcome or a scene (dev: ignores dates and seen); a weather
 *                      scene waits for its forecast first (at most FETCH_TIMEOUT_MS)
 *  check(todayKey, standalone)  shows whatever is due at this app start, if anything
 *  talk()  Elin tapped the peeking Santa: a random line from `random`, whenever she likes.
 *          Never shows a scene or says anything about coming doors.
 */
export function createTomte(tomte, { random = [], today = () => toDateKey(new Date()) } = {}) {
  let dialog = null;
  let parts = null;
  let cleanup = null;
  let starting = null; // a scene waiting for its forecast before it shows

  function build() {
    dialog = el('dialog', 'tomte');
    dialog.setAttribute('aria-labelledby', 'tomte-name');
    dialog.setAttribute('aria-describedby', 'tomte-text');

    const close = button('×', 'tomte-close', () => dialog.close());
    close.setAttribute('aria-label', 'Stäng');

    const figure = el('div', 'tomte-figure');
    figure.innerHTML = SANTA_SVG; // constant markup, see above
    const hoho = el('div', 'tomte-hoho');
    hoho.setAttribute('aria-hidden', 'true');
    hoho.append(el('span', null, 'Ho'), el('span', null, 'ho'), el('span', null, 'ho!'));
    figure.append(hoho);

    const bubble = el('div', 'tomte-bubble');
    const name = el('p', 'tomte-name', tomte.name);
    name.id = 'tomte-name';
    const text = el('p', 'tomte-text');
    text.id = 'tomte-text';
    text.setAttribute('aria-live', 'polite');
    const extra = el('div', 'tomte-extra');
    const actions = el('div', 'tomte-actions');
    // Attribution for the forecast, shown under weather scenes only.
    const credit = el('p', 'tomte-credit');
    const creditLink = el('a', null, weatherProvider.attribution);
    creditLink.href = weatherProvider.attributionUrl;
    creditLink.target = '_blank';
    creditLink.rel = 'noopener noreferrer';
    credit.append(creditLink);
    credit.hidden = true;
    bubble.append(name, text, extra, actions, credit);
    const speaker = soundButton();
    if (speaker) bubble.append(speaker);

    dialog.append(close, figure, bubble);
    // No backdrop close: a stray tap shouldn't cut Tomten off mid-sentence. × and Esc close.
    dialog.addEventListener('close', () => {
      tomteLeaves();
      dialog.classList.remove('is-peek');
      cleanup?.();
      cleanup = null;
    });
    document.body.append(dialog);
    parts = { figure, text, extra, actions, credit };
  }

  // Runs a conversation: steps from buildScript(), finished with the `last` button label.
  function run(steps, { scene = null, last = LAST_BUTTON, onLastStep = null } = {}) {
    if (!dialog) build();
    cleanup?.();
    cleanup = null;
    parts.credit.hidden = !scene?.weatherVariants;
    const answers = scene ? { ...getTomteAnswers(scene.id) } : {};
    let index = -1;

    const hasMore = () => steps.slice(index + 1).some((s) => stepHasText(s, scene, answers));

    function say(text, buttons) {
      parts.text.textContent = text;
      parts.actions.replaceChildren(...buttons);
      parts.extra.replaceChildren();
      buttons[0]?.focus();
    }

    function nextButton() {
      if (hasMore()) {
        return button('Nästa', 'btn btn-primary', () => {
          playEffect('click');
          next();
        });
      }
      return button(last, 'btn btn-primary', () => dialog.close());
    }

    function next() {
      index++;
      const step = steps[index];
      if (!step) {
        dialog.close();
        return;
      }
      if (step.kind === 'line') say(step.text, [nextButton()]);
      else if (step.kind === 'closing') {
        const text = closingFor(scene, answers);
        if (text === null) {
          next();
          return;
        }
        say(text, [nextButton()]);
      } else {
        const { question } = step;
        const options = question.options.map((option, i) =>
          button(option.label, i === 0 ? 'btn btn-primary' : 'btn btn-secondary', () => {
            answers[question.id] = i;
            if (scene) saveTomteAnswer(scene.id, question.id, i);
            say(replyFor(question, i), [nextButton()]);
          }),
        );
        say(question.text, options);
      }
      if (!hasMore() && step.kind !== 'question') cleanup = onLastStep?.(parts.extra) ?? null;
    }

    // Restart the entrance (bounce and "ho ho ho") each time Tomten appears.
    dialog.classList.remove('is-hohoho');
    void dialog.offsetWidth;
    dialog.classList.add('is-hohoho');
    if (!dialog.open) dialog.showModal();
    // Sleigh bells and the jingle. Before the first tap they wait for it (the intro's "Nästa").
    tomteArrives();
    next();
  }

  // A random line from the lottery (tomte-random.js), "En till" for the next one. Uses the
  // same dialog and bubble as the scenes, but only says "ho" (no sleigh or jingle).
  function talk() {
    if (random.length === 0 || starting) return;
    if (!dialog) build();
    cleanup?.();
    cleanup = null;
    parts.credit.hidden = true;
    parts.extra.replaceChildren();

    function drawNext() {
      const { line, bag } = drawLine(random, getRandomBag());
      setRandomBag(bag);
      parts.text.textContent = line;
    }

    const again = button('En till', 'btn btn-primary', () => {
      playEffect('click');
      drawNext();
    });
    const earlier = button('Tidigare repliker', 'btn btn-secondary', () => openHistory());
    const bye = button('Hejdå', 'btn btn-secondary', () => dialog.close());
    parts.actions.replaceChildren(again, earlier, bye);

    dialog.classList.remove('is-hohoho', 'is-peek');
    void dialog.offsetWidth;
    dialog.classList.add('is-hohoho', 'is-peek');
    if (!dialog.open) dialog.showModal();
    tomteSpeaks();
    drawNext();
    again.focus();
  }

  // The intro's last line also offers installing: the browser's prompt when Chrome has
  // offered one, otherwise a short how-to. Updates if the prompt turns up while open.
  function installExtra(container) {
    let installed = false;
    const render = () => {
      if (installed) container.replaceChildren();
      else if (canInstall()) {
        container.replaceChildren(
          button(tomte.intro.installButton, 'btn btn-secondary tomte-install', async () => {
            installed = (await promptInstall()) === 'accepted';
            render();
          }),
        );
      } else container.replaceChildren(el('p', 'tomte-help', tomte.intro.installHelp));
    };
    render();
    return onInstallChange(render);
  }

  // Weather scenes look up the forecast first (at most a few seconds, never throws).
  // In dev mode the "Prognos" setting can force a variant.
  async function weatherFor(scene) {
    const override = isDevEnabled() ? getForecastOverride() : null;
    return getWeatherVariant(scene.forecastFor ?? [], { override });
  }

  // Resolves once the conversation is showing.
  async function play(kind, scene = null) {
    if (kind === 'intro' && tomte.intro) {
      run(buildScript(tomte.intro), { last: tomte.intro.doneButton, onLastStep: installExtra });
    } else if (kind === 'welcome' && tomte.welcome) {
      run(buildScript(tomte.welcome));
    } else if (kind === 'scene' && scene) {
      if (!scene.weatherVariants) {
        run(buildScript(scene), { scene });
        return;
      }
      const ready = weatherFor(scene);
      starting = ready;
      const weather = await ready;
      if (starting !== ready) return; // another conversation started meanwhile
      starting = null;
      run(buildScript(scene, { weather }), { scene });
    }
  }

  // Shows what is due now (at most one thing) and remembers it as seen right away,
  // so closing early or reloading never shows it again.
  function check(todayKey, standalone) {
    if (dialog?.open || starting) return;
    const pick = pickStartup({ tomte, todayKey, standalone, seen: getTomteSeen() });
    if (!pick) return;
    setTomteSeen(pick.seen);
    return play(pick.kind, pick.scene);
  }

  // Resolves once no conversation is showing.
  async function whenClosed() {
    while (starting || dialog?.open) {
      if (starting) await starting;
      else await new Promise((resolve) => dialog.addEventListener('close', resolve, { once: true }));
    }
  }

  return { play, check, talk, whenClosed, isOpen: () => Boolean(starting || dialog?.open) };
}

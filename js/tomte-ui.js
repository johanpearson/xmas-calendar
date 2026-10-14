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
} from './storage.js';
import { canInstall, onInstallChange, promptInstall } from './install.js';
import { playEffect, tomteArrives, tomteLeaves } from './audio.js';
import { soundButton } from './audio-ui.js';

const TOMTE_URL = './content/tomte.json';
const LAST_BUTTON = 'Hej då!';

// Constant, authored markup (never content from tomte.json). The hat is the same one as
// on the page title and uses its classes (hat-body, hat-ball, ...) and colours.
const SANTA_SVG = `
  <svg class="tomte-svg" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
    <path class="tomte-coat" d="M10 132c3-20 16-31 36-33h28c20 2 33 13 36 33z"/>
    <path class="tomte-coat-fur" d="M52 99h16v33H52z"/>
    <circle class="tomte-face" cx="60" cy="70" r="23"/>
    <circle class="tomte-cheek" cx="45" cy="76" r="4.5"/>
    <circle class="tomte-cheek" cx="75" cy="76" r="4.5"/>
    <path class="tomte-beard" d="M35 72c-2 26 9 40 25 42 16-2 27-16 25-42-5 9-13 13-25 13s-20-4-25-13z"/>
    <ellipse class="tomte-mouth" cx="60" cy="92" rx="4.5" ry="3"/>
    <path class="tomte-moustache" d="M60 84c-4-6-13-7-17-2 3 1 5 4 9 4 4 0 6-1 8-2zm0 0c4-6 13-7 17-2-3 1-5 4-9 4-4 0-6-1-8-2z"/>
    <circle class="tomte-nose" cx="60" cy="78" r="4.2"/>
    <g class="tomte-eyes">
      <ellipse cx="51" cy="68" rx="2.4" ry="2.8"/>
      <ellipse cx="69" cy="68" rx="2.4" ry="2.8"/>
    </g>
    <path class="tomte-brow" d="M46 62.5q5-3 9 0M65 62.5q5-3 9 0"/>
    <g transform="translate(25 3) scale(1.06)">
      <path class="hat-body" d="M9 47C12 25 28 8 48 6c10-1 18 5 21 15-6-5-11-5-14 0-3 6-1 16 3 26z"/>
      <path class="hat-shade" d="M48 6c10-1 18 5 21 15-6-5-11-5-14 0-3 6-1 16 3 26H46c-4-12-3-30 2-41z"/>
      <g class="hat-ball"><circle cx="70" cy="27" r="7"/></g>
      <rect class="hat-fur" x="3" y="43" width="60" height="15" rx="7.5"/>
    </g>
  </svg>`;

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
 */
export function createTomte(tomte) {
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

  return { play, check, whenClosed, isOpen: () => Boolean(starting || dialog?.open) };
}

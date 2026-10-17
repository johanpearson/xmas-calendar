// The Santa who peeks up from the bottom edge of the main screen (milestone 16). A small
// button with his hat and eyes, on the left or right (random at each app start), that
// blinks every 8-15 s and wiggles his hat every 30-45 s. Tapping it is up to the caller.
// He is hidden by CSS while any dialog is open (intro, scene, door card, history).

import { SANTA_SVG } from './santa-svg.js';

export const PEEK_LABEL = 'Tomten, tryck för att prata';
export const BLINK_EVERY_MS = [8000, 15000];
export const WIGGLE_EVERY_MS = [30000, 45000];
const ANIMATION_MS = { blink: 320, wiggle: 1100 };

export const pickSide = (rng = Math.random) => (rng() < 0.5 ? 'left' : 'right');
export const delayBetween = ([min, max], rng = Math.random) => min + rng() * (max - min);

/**
 * Creates the peeking Santa and adds it to the page.
 *  onTap()          called when he is tapped
 *  reducedMotion()  true: no blinking or wiggling
 * Returns { node, side, setReady(ready), force(on) }. He shows when ready (the intro and
 * any scene are done) or when forced (dev panel).
 */
export function createPeek({ onTap, reducedMotion = () => false }) {
  const node = document.createElement('button');
  node.type = 'button';
  const side = pickSide();
  node.className = `peek peek-${side}`;
  node.dataset.side = side;
  node.setAttribute('aria-label', PEEK_LABEL);
  node.hidden = true;
  node.innerHTML = SANTA_SVG; // constant markup from santa-svg.js
  node.addEventListener('click', () => onTap());

  let ready = false;
  let forced = false;
  const timers = new Set();

  // Plays a one-off animation by toggling a class, then removes it again.
  function play(name) {
    node.classList.add(`is-${name}`);
    const t = setTimeout(() => {
      timers.delete(t);
      node.classList.remove(`is-${name}`);
    }, ANIMATION_MS[name]);
    timers.add(t);
  }

  // A self-rescheduling timer; skips the animation while the page is hidden.
  function every(range, name) {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!node.hidden && !document.hidden && !reducedMotion()) play(name);
      every(range, name);
    }, delayBetween(range));
    timers.add(t);
  }

  function render() {
    const visible = ready || forced;
    node.hidden = !visible;
    document.body.classList.toggle('has-peek', visible);
  }

  document.body.append(node);
  if (!reducedMotion()) {
    every(BLINK_EVERY_MS, 'blink');
    every(WIGGLE_EVERY_MS, 'wiggle');
  }

  return {
    node,
    side,
    setReady(value) {
      ready = value;
      render();
    },
    force(on = true) {
      forced = on;
      render();
    },
  };
}

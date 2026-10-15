// Opening animations. Each one runs in a temporary full screen overlay with a copy of
// the door, a prop (letter, present, bells) and particles, all animated with the Web
// Animations API on transform and opacity only, so it stays smooth on mid-range phones.
// A tap or key press skips it. The overlay, and with it every particle, is removed
// from the DOM when the animation ends.

import { icon } from './icons.js';
import { noteFrame } from './latency.js';

// The card's entrance after each animation (see .card[data-reveal] in style.css).
const REVEALS = {
  sparkle: 'letter',
  gift: 'pop',
  bells: 'rise',
  ribbon: 'pop',
  magnifier: 'glint',
  confetti: 'pop',
  snowburst: 'pop',
};

const VIBRATIONS = {
  sparkle: [12],
  gift: [10, 60, 18],
  bells: [14, 90, 14],
  ribbon: [10, 50, 10, 50, 16],
  magnifier: [8, 40, 8, 40, 20],
  confetti: [16],
  snowburst: [10],
};

const CONFETTI_COLORS = ['#e8c36a', '#d7263d', '#2f9e5b', '#fff6dc', '#ff9f43', '#7fb4e8'];

// --- Props (constant, authored markup) ---

const PROPS = {
  letter: `<svg viewBox="0 0 64 48" aria-hidden="true">
    <rect x="2" y="4" width="60" height="40" rx="3" fill="#fbf5e9" stroke="#c9a24d" stroke-width="2"/>
    <path d="M2 7l30 21 30-21" fill="none" stroke="#c9a24d" stroke-width="2"/>
    <circle cx="32" cy="28" r="7.5" fill="#c4252f"/>
    <path d="M28.5 28h7M32 24.5v7" stroke="#f3d48a" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  box: (body, ribbon) => `<svg viewBox="0 0 64 40" aria-hidden="true">
    <rect x="6" y="0" width="52" height="38" rx="3" fill="${body}"/>
    <rect x="6" y="0" width="52" height="6" fill="#0002"/>
    <rect x="28" y="0" width="8" height="38" fill="${ribbon}"/></svg>`,
  lid: (body, ribbon) => `<svg viewBox="0 0 64 16" aria-hidden="true">
    <rect x="2" y="1" width="60" height="14" rx="3" fill="${body}"/>
    <rect x="28" y="1" width="8" height="14" fill="${ribbon}"/></svg>`,
  // One loop of a bow; the right one is mirrored.
  loop: (color, stroke, mirrored) => `<svg viewBox="0 0 32 24" aria-hidden="true">
    <path d="M30 20C24 6 4 0 4 10c0 8 14 10 26 10z" fill="${color}" stroke="${stroke}" stroke-width="2"
      stroke-linejoin="round"${mirrored ? ' transform="translate(32 0) scale(-1 1)"' : ''}/></svg>`,
  knot: (color, stroke) => `<svg viewBox="0 0 20 20" aria-hidden="true">
    <ellipse cx="10" cy="10" rx="7" ry="6" fill="${color}" stroke="${stroke}" stroke-width="2"/></svg>`,
  // A note with hidden writing, searched with the magnifier.
  note: `<svg viewBox="0 0 64 80" aria-hidden="true">
    <path d="M4 4h46l10 10v62H4z" fill="#fbf5e9" stroke="#c9a24d" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 4v10h10" fill="#efe3c6" stroke="#c9a24d" stroke-width="2" stroke-linejoin="round"/>
    <g stroke="#c9b48a" stroke-width="2.4" stroke-linecap="round">
      <path d="M12 22h30M12 31h40M12 40h36M12 49h40M12 58h24"/></g>
    <path d="M44 62l3 6 6-10" fill="none" stroke="#d7263d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  magnifier: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M40 40l17 17" stroke="#5b2d0e" stroke-width="10" stroke-linecap="round"/>
    <path d="M40 40l17 17" stroke="#b8642a" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="26" cy="26" r="19" fill="#dff1ff" fill-opacity=".35"/>
    <circle cx="26" cy="26" r="19" fill="none" stroke="#e8b93c" stroke-width="5"/>
    <path d="M14 20a13 13 0 0 1 9-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`,
  bell: `<svg viewBox="0 0 48 52" aria-hidden="true">
    <path d="M24 2a3 3 0 0 1 3 3v1.5A13 13 0 0 1 37 19v11l5 8H6l5-8V19A13 13 0 0 1 21 6.5V5a3 3 0 0 1 3-3z"
      fill="#f0c04a" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round"/>
    <path d="M15 20a9 9 0 0 1 6-8" fill="none" stroke="#fff6cc" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="9" y="32" width="30" height="3.5" rx="1.75" fill="#d7263d"/>
    <circle cx="24" cy="44" r="5" fill="#8a5a00"/></svg>`,
};

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// --- Building blocks ---

// A copy of the door at the same spot, with the leaf about to swing open.
function ghostDoor(layer, door, rect) {
  const ghost = document.createElement('div');
  const keep = [...door.classList].filter((c) => !c.startsWith('is-') || c === 'is-special');
  ghost.className = [...keep, 'fx-door'].join(' ');
  if (door.dataset.theme) ghost.dataset.theme = door.dataset.theme;
  for (const child of door.children) {
    if (!child.classList.contains('door-badge')) ghost.append(child.cloneNode(true));
  }
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  layer.append(ghost);
  return ghost;
}

function swingLeaf(ghost, { wide = false } = {}) {
  const leaf = ghost.querySelector('.door-leaf');
  const open = ghost.classList.contains('is-special') ? -80 : -72;
  const frames = wide
    ? [{ transform: 'rotateY(0)' }, { transform: 'rotateY(-112deg)', offset: 0.55 }, { transform: `rotateY(${open}deg)` }]
    : [{ transform: 'rotateY(0)' }, { transform: `rotateY(${open - 8}deg)`, offset: 0.7 }, { transform: `rotateY(${open}deg)` }];
  leaf?.animate(frames, { duration: wide ? 640 : 460, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
}

// Places a prop centred on the stage and flies it in from the door.
function prop(stage, className, html, from, { delay = 120, duration = 400, scaleFrom = 0.35 } = {}) {
  const node = el('div', `fx-prop ${className}`, html);
  stage.append(node);
  node.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(${scaleFrom}) rotate(-12deg)`, opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform: 'translate(0, 0) scale(1) rotate(0)', opacity: 1 },
    ],
    { duration, delay, easing: 'cubic-bezier(.2,.8,.3,1.15)', fill: 'both' },
  );
  return node;
}

function fadeOut(node, delay, duration = 150) {
  node.animate([{ opacity: 1 }, { opacity: 0 }], { delay, duration, fill: 'forwards' });
}

/**
 * A burst of particles from (x, y) on the stage.
 * kinds: particle classes (star, sparkle, confetti, heart, glitter, snow).
 */
function burst(stage, { x = 0, y = 0, count, kinds, delay = 0, duration = 600, distance = [60, 150], gravity = 0, spread = 360, direction = -90 }) {
  for (let i = 0; i < count; i++) {
    const kind = pick(kinds);
    const p = el('span', `fx-p fx-p-${kind}`);
    if (kind === 'confetti') p.style.background = pick(CONFETTI_COLORS);
    stage.append(p);
    const angle = ((direction + rand(-spread / 2, spread / 2)) * Math.PI) / 180;
    const dist = rand(distance[0], distance[1]);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const spin = rand(-260, 260);
    const scale = rand(0.6, 1.15);
    p.animate(
      [
        { transform: `translate(${x}px, ${y}px) rotate(0) scale(.2)`, opacity: 1 },
        { transform: `translate(${x + dx * 0.75}px, ${y + dy * 0.75}px) rotate(${spin * 0.6}deg) scale(${scale})`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x + dx}px, ${y + dy + gravity}px) rotate(${spin}deg) scale(${scale * 0.8})`, opacity: 0 },
      ],
      { duration: duration * rand(0.8, 1.1), delay: delay + rand(0, 90), easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'both' },
    );
  }
}

// --- The animations. Each returns its total length in ms. ---

const ANIMATIONS = {
  // ledtrad: sparkles and stars, a letter flies out (the card then unfolds like one).
  sparkle({ stage, ghost, from }) {
    swingLeaf(ghost);
    const letter = prop(stage, 'fx-letter', PROPS.letter, from, { delay: 140, duration: 420 });
    burst(stage, { count: 16, kinds: ['sparkle', 'star', 'glitter'], delay: 120, duration: 520, distance: [20, 70], ...from });
    burst(stage, { count: 22, kinds: ['star', 'sparkle', 'glitter'], delay: 520, duration: 480, distance: [70, 160] });
    fadeOut(letter, 860, 140);
    return 1000;
  },

  // litet: a small present, the lid lifts off and confetti flies.
  gift({ stage, ghost, from }) {
    swingLeaf(ghost);
    const gift = prop(stage, 'fx-gift', '', from, { delay: 100, duration: 400 });
    const box = el('div', 'fx-gift-box', PROPS.box('#2f8f55', '#e8c36a'));
    const lid = el('div', 'fx-gift-lid', PROPS.lid('#3aa866', '#e8c36a'));
    const bow = el('div', 'fx-gift-bow');
    bow.append(icon('bow'));
    lid.append(bow);
    gift.append(box, lid);
    lid.animate(
      [
        { transform: 'translate(0, 0) rotate(0)' },
        { transform: 'translate(-6px, -54px) rotate(-24deg)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-14px, -70px) rotate(-34deg)', opacity: 0 },
      ],
      { delay: 520, duration: 340, easing: 'cubic-bezier(.2,.9,.4,1)', fill: 'both' },
    );
    burst(stage, { count: 30, kinds: ['confetti'], delay: 560, duration: 440, distance: [90, 190], gravity: 70, spread: 160 });
    fadeOut(gift, 880, 120);
    return 1000;
  },

  // uppdrag: the door swings wide in 3D with light behind it, rays, bells pop up.
  bells({ layer, stage, ghost, rect }) {
    swingLeaf(ghost, { wide: true });
    const light = el('div', 'fx-light');
    Object.assign(light.style, { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px` });
    layer.insertBefore(light, ghost.nextSibling);
    light.animate(
      [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.6)', opacity: 1, offset: 0.4 }, { transform: 'scale(2.4)', opacity: 0 }],
      { delay: 40, duration: 760, easing: 'ease-out', fill: 'both' },
    );
    const rays = el('div', 'fx-rays');
    stage.append(rays);
    rays.animate(
      [{ transform: 'rotate(0) scale(.3)', opacity: 0 }, { opacity: 0.9, offset: 0.35 }, { transform: 'rotate(50deg) scale(1.25)', opacity: 0 }],
      { delay: 220, duration: 780, easing: 'ease-out', fill: 'both' },
    );
    [-1, 1].forEach((side, i) => {
      const bell = el('div', 'fx-bell', PROPS.bell);
      stage.append(bell);
      bell.animate(
        [
          { transform: `translate(${side * 10}px, 30px) scale(0) rotate(0)`, opacity: 0 },
          { transform: `translate(${side * 34}px, -14px) scale(1.2) rotate(${side * -18}deg)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${side * 30}px, -8px) scale(1) rotate(${side * 20}deg)`, offset: 0.5 },
          { transform: `translate(${side * 30}px, -8px) scale(1) rotate(${side * -14}deg)`, offset: 0.7 },
          { transform: `translate(${side * 30}px, -8px) scale(1) rotate(${side * 8}deg)`, opacity: 1, offset: 0.88 },
          { transform: `translate(${side * 30}px, -8px) scale(.9) rotate(0)`, opacity: 0 },
        ],
        { delay: 280 + i * 60, duration: 700, easing: 'ease-in-out', fill: 'both' },
      );
    });
    burst(stage, { count: 14, kinds: ['sparkle', 'glitter'], delay: 360, duration: 520, distance: [60, 130] });
    return 1050;
  },

  // rim: the bow unties, the present opens, glitter and hearts.
  ribbon({ stage, ghost, from }) {
    swingLeaf(ghost);
    const gift = prop(stage, 'fx-gift fx-gift-rim', '', from, { delay: 100, duration: 360 });
    const box = el('div', 'fx-gift-box', PROPS.box('#fbf5e9', '#d7263d'));
    const lid = el('div', 'fx-gift-lid', PROPS.lid('#fffaf0', '#d7263d'));
    const loopL = el('div', 'fx-loop fx-loop-l', PROPS.loop('#e33a4f', '#9a1b25', false));
    const loopR = el('div', 'fx-loop fx-loop-r', PROPS.loop('#e33a4f', '#9a1b25', true));
    const knot = el('div', 'fx-knot', PROPS.knot('#d7263d', '#9a1b25'));
    lid.append(loopL, loopR, knot);
    gift.append(box, lid);
    // side: -1 for the left loop, 1 for the right. The loops flop outwards and slide off.
    const untie = (node, side) =>
      node.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${side * 10}px, -6px) rotate(${side * 30}deg) scale(1.1, .7)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${side * 34}px, 22px) rotate(${side * 70}deg) scale(.6, .3)`, opacity: 0 },
        ],
        { delay: 460, duration: 260, easing: 'ease-in', fill: 'both' },
      );
    untie(loopL, -1);
    untie(loopR, 1);
    fadeOut(knot, 560, 120);
    lid.animate(
      [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translate(10px, -48px) rotate(18deg)', opacity: 1, offset: 0.7 }, { transform: 'translate(18px, -60px) rotate(26deg)', opacity: 0 }],
      { delay: 680, duration: 260, easing: 'cubic-bezier(.2,.9,.4,1)', fill: 'both' },
    );
    burst(stage, { count: 14, kinds: ['heart'], delay: 720, duration: 420, distance: [70, 150], spread: 150 });
    burst(stage, { count: 18, kinds: ['glitter', 'sparkle'], delay: 700, duration: 420, distance: [50, 150] });
    fadeOut(gift, 960, 140);
    return 1100;
  },

  // jakt: a note flies out, a magnifier sweeps over it in a zigzag, then it glitters.
  magnifier({ stage, ghost, from }) {
    swingLeaf(ghost);
    const note = prop(stage, 'fx-note', PROPS.note, from, { delay: 100, duration: 360 });
    const glass = el('div', 'fx-prop fx-magnifier', PROPS.magnifier);
    stage.append(glass);
    // Lens centre path over the note (the lens sits in the top left of the svg).
    glass.animate(
      [
        { transform: 'translate(-90px, -70px) rotate(-20deg) scale(.6)', opacity: 0 },
        { transform: 'translate(-34px, -38px) rotate(-8deg) scale(1)', opacity: 1, offset: 0.18 },
        { transform: 'translate(22px, -22px) rotate(6deg) scale(1)', offset: 0.4 },
        { transform: 'translate(-30px, 4px) rotate(-6deg) scale(1)', offset: 0.62 },
        { transform: 'translate(20px, 26px) rotate(8deg) scale(1.05)', opacity: 1, offset: 0.84 },
        { transform: 'translate(70px, 60px) rotate(20deg) scale(.7)', opacity: 0 },
      ],
      { delay: 300, duration: 640, easing: 'ease-in-out', fill: 'both' },
    );
    // Little glints where the lens passes.
    burst(stage, { x: -34, y: -38, count: 4, kinds: ['glitter'], delay: 420, duration: 300, distance: [8, 24] });
    burst(stage, { x: 22, y: -22, count: 4, kinds: ['glitter'], delay: 560, duration: 300, distance: [8, 24] });
    burst(stage, { x: -30, y: 4, count: 4, kinds: ['glitter'], delay: 700, duration: 300, distance: [8, 24] });
    // Found it: the note glitters as the card takes over.
    note.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], {
      delay: 820,
      duration: 240,
      fill: 'both',
    });
    burst(stage, { count: 26, kinds: ['glitter', 'sparkle', 'star'], delay: 860, duration: 300, distance: [40, 140] });
    fadeOut(note, 960, 120);
    return 1100;
  },

  confetti({ stage, ghost, from }) {
    swingLeaf(ghost);
    burst(stage, { ...from, count: 36, kinds: ['confetti'], delay: 180, duration: 760, distance: [90, 220], gravity: 90, spread: 140 });
    return 980;
  },

  snowburst({ stage, ghost, from }) {
    swingLeaf(ghost);
    burst(stage, { ...from, count: 40, kinds: ['snow', 'snow', 'glitter'], delay: 140, duration: 900, distance: [80, 220], gravity: 50 });
    return 1080;
  },
};

export function revealFor(name) {
  return REVEALS[name] ?? 'pop';
}

function vibrate(name) {
  try {
    navigator.vibrate?.(VIBRATIONS[name] ?? [12]);
  } catch {
    // Not supported or not allowed: stay silent.
  }
}

/**
 * Plays an opening animation over `door`. Resolves with { skipped, aborted } when it has
 * ended (or was skipped by a tap or key press, or aborted through `signal`) and the
 * overlay has been removed.
 */
export function playOpening(door, name, { haptics = true, signal = null } = {}) {
  const run = ANIMATIONS[name] ?? ANIMATIONS.sparkle;
  const rect = door.getBoundingClientRect();
  const stageX = window.innerWidth / 2;
  const stageY = window.innerHeight * 0.45;

  const layer = el('div', 'fx');
  layer.setAttribute('aria-hidden', 'true');
  // Dims the page to the same shade as the card's backdrop, so the hand-over is seamless.
  const dim = el('div', 'fx-dim');
  layer.append(dim);
  dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'both' });
  const ghost = ghostDoor(layer, door, rect);
  const stage = el('div', 'fx-stage');
  Object.assign(stage.style, { left: `${stageX}px`, top: `${stageY}px` });
  layer.append(stage);
  document.body.append(layer);
  door.classList.add('is-fx-hidden');
  requestAnimationFrame(noteFrame); // the frame that first draws the overlay (dev latency log)

  // The door centre relative to the stage, where props and some bursts start.
  const from = { x: rect.left + rect.width / 2 - stageX, y: rect.top + rect.height / 2 - stageY };
  const total = run({ layer, stage, ghost, rect, from });
  if (haptics) vibrate(name);

  return new Promise((resolve) => {
    let done = false;
    const finish = (skipped, aborted = false) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      layer.removeEventListener('click', onSkip);
      layer.removeEventListener('pointerdown', onPress);
      document.removeEventListener('keydown', onKey, true);
      signal?.removeEventListener('abort', onAbort);
      for (const a of layer.getAnimations({ subtree: true })) a.cancel();
      layer.remove();
      door.classList.remove('is-fx-hidden');
      resolve({ skipped, aborted });
    };
    const onAbort = () => finish(true, true);
    // Skip on click, not pointerdown: the rest of the tap must land on the overlay,
    // or its click would hit the card's backdrop and close the card at once. Only a tap
    // that starts on the overlay skips: the door opens on pointerdown, so the click of
    // that same tap often lands on the overlay too and must not skip the animation.
    let pressed = false;
    const onPress = () => (pressed = true);
    const onSkip = () => {
      if (pressed) finish(true);
    };
    const onKey = (e) => {
      // Swallow the key so Enter/Space doesn't re-activate the focused door.
      e.preventDefault();
      e.stopPropagation();
      finish(true);
    };
    const timer = setTimeout(() => finish(false), total);
    layer.addEventListener('pointerdown', onPress);
    layer.addEventListener('click', onSkip);
    document.addEventListener('keydown', onKey, true);
    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) onAbort();
  });
}

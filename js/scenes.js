// Day scenes: a small animated picture per door (the "scene" field in days.json).
//
// Every scene is inline SVG built here and animated by CSS (css/scenes.css). A scene has a
// short entrance (at most about 3 s) and then a calm loop. The loop pauses while the tab is
// hidden, and reduced motion gives a still picture: every animation is switched off, and
// the elements' own (unanimated) state is the scene's end state.
//
// SCENES[key].render(container, { date, reducedMotion, small }) draws the scene and returns a
// cleanup function that removes every node and listener it added. `small` is the version
// for the main screen, drawn without its background (only scenes with `home: true`).
//
// Nothing here touches the DOM until render() is called, so node --test can import it.

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 150;

// --- Building blocks ---

function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  node.append(...children.flat(Infinity).filter(Boolean));
  return node;
}
const g = (attrs, ...children) => el('g', attrs, ...children);

// CSS custom properties for an element's animation: vars({ in: 1.2 }) -> "--in:1.2s".
// Numbers are seconds unless the key is in UNITLESS or ends in deg/px already.
const UNITLESS = new Set(['o', 's']);
function vars(values) {
  return Object.entries(values)
    .map(([k, v]) => `--${k}:${typeof v === 'number' && !UNITLESS.has(k) ? `${round(v)}s` : v}`)
    .join(';');
}
const round = (n) => Math.round(n * 100) / 100;

// Wraps a node in an entrance animation (a class from scenes.css) starting after `delay` s.
const enter = (cls, delay, ...children) => g({ class: cls, style: vars({ in: delay }) }, ...children);

// A small deterministic random generator, so a scene looks the same every time for a day.
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let instances = 0;

// Per render: random numbers, <defs> and ids that are unique in the document (a scene in
// the card and one on the main screen can be on screen together).
function createContext(key, date, small) {
  const rand = seeded(`${key}|${date}`);
  const defs = el('defs');
  const prefix = `sc${++instances}`;
  const cache = new Map();
  let n = 0;
  const id = (name) => `${prefix}-${name}-${++n}`;
  const once = (cacheKey, make) => {
    if (!cache.has(cacheKey)) cache.set(cacheKey, make());
    return cache.get(cacheKey);
  };
  return {
    small,
    rand,
    defs,
    id,
    between: (a, b) => a + rand() * (b - a),
    pick: (list) => list[Math.floor(rand() * list.length)],
    // Vertical gradient through the given colours, as a fill value.
    linear: (...colors) =>
      once(`l:${colors}`, () => {
        const gid = id('lin');
        defs.append(
          el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
            colors.map((c, i) => el('stop', { offset: round(i / (colors.length - 1)), 'stop-color': c }))),
        );
        return `url(#${gid})`;
      }),
    // A soft round glow: the colour in the middle, transparent at the edge.
    glow: (color, opacity = 0.8) =>
      once(`r:${color}:${opacity}`, () => {
        const gid = id('glow');
        defs.append(
          el('radialGradient', { id: gid },
            el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': opacity }),
            el('stop', { offset: 0.45, 'stop-color': color, 'stop-opacity': opacity * 0.35 }),
            el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 })),
        );
        return `url(#${gid})`;
      }),
  };
}

// --- Shared pieces ---

const sky = (ctx, top = '#0a1630', bottom = '#24457a') =>
  el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear(top, bottom) });

// Twinkling stars. With `from`/`to` they fade in at random times in that range.
function starField(ctx, count, { top = 4, bottom = 90, left = 4, right = W - 4, from = null, to = from } = {}) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const r = round(ctx.between(0.5, 1.4));
    const dot = el('circle', {
      cx: round(ctx.between(left, right)),
      cy: round(ctx.between(top, bottom)),
      r,
      fill: r > 1.2 ? '#fff3c4' : '#fff',
      class: 'sc-twinkle',
      style: vars({ dur: ctx.between(2, 4.5), ph: -ctx.between(0, 4) }),
    });
    stars.push(from == null ? dot : enter('sc-fade', ctx.between(from, to), dot));
  }
  return g({}, stars);
}

function starPoints(cx, cy, outer, inner, points = 5) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

// A candle flame with its halo. `y` is the top of the wick. delay: when it lights (null: lit).
function flame(ctx, x, y, { delay = null, scale = 1, halo = 13 } = {}) {
  const lit = (cls, node) => (delay == null ? node : enter(cls, delay, node));
  return g({ transform: `translate(${round(x)} ${round(y)}) scale(${scale})` },
    lit('sc-fade', el('circle', {
      class: 'sc-breathe', cx: 0, cy: -6, r: halo, fill: ctx.glow('#ffc65a', 0.7),
      style: vars({ ph: -ctx.between(0, 3) }),
    })),
    lit('sc-ignite', g({ class: 'sc-flicker', style: vars({ ph: -ctx.between(0, 1.4) }) },
      el('path', { d: 'M0 0C-3.6-2.6-3.8-7.4 0-13 3.8-7.4 3.6-2.6 0 0z', fill: '#ffab33' }),
      el('path', { d: 'M0-1C-1.8-2.6-1.9-5.6 0-8.4 1.9-5.6 1.8-2.6 0-1z', fill: '#fff4c2' }))));
}

function candle(ctx, x, base, { h = 40, w = 10, color = '#f5efe3', lit = true, delay = null } = {}) {
  const top = base - h;
  return g({},
    el('rect', { x: round(x - w / 2), y: round(top), width: w, height: h, rx: 1.6, fill: color }),
    el('rect', { x: round(x - w / 2 + 1), y: round(top + 1), width: round(w * 0.28), height: h - 2, rx: 1, fill: '#fff', opacity: 0.4 }),
    el('path', { d: `M${round(x)} ${round(top)}v-3.5`, stroke: '#3a2a1a', 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
    lit && flame(ctx, x, top - 2.5, { delay }));
}

// A pine tree: three tiers and a trunk, its foot at (cx, base).
function pine(cx, base, h, { fill = '#1f6b3a', shade = '#17532d', snow = null } = {}) {
  const w = h * 0.72;
  const tier = (top, bottom, half) => [
    el('polygon', { points: `${round(cx)},${round(top)} ${round(cx + half)},${round(bottom)} ${round(cx - half)},${round(bottom)}`, fill }),
    el('polygon', { points: `${round(cx)},${round(top)} ${round(cx + half)},${round(bottom)} ${round(cx)},${round(bottom)}`, fill: shade }),
    snow && el('polygon', {
      points: `${round(cx)},${round(top)} ${round(cx + half * 0.32)},${round(top + (bottom - top) * 0.32)} ${round(cx)},${round(top + (bottom - top) * 0.24)} ${round(cx - half * 0.32)},${round(top + (bottom - top) * 0.32)}`,
      fill: snow,
    }),
  ];
  const top = base - h;
  return g({},
    el('rect', { x: round(cx - h * 0.05), y: round(base - h * 0.1), width: round(h * 0.1), height: round(h * 0.1), fill: '#5a3a22' }),
    tier(top, top + h * 0.45, w * 0.32),
    tier(top + h * 0.22, top + h * 0.7, w * 0.42),
    tier(top + h * 0.45, base - h * 0.08, w * 0.5));
}

// Falling particles (snow, candy, confetti). make(i) draws one at the origin.
function falling(ctx, count, make, { dur = [6, 10], drift = 14, spin = 0, left = 0, right = W } = {}) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(g({ transform: `translate(${round(ctx.between(left, right))} 0)` },
      g({
        class: 'sc-fall',
        style: vars({
          dur: ctx.between(...dur),
          ph: -ctx.between(0, dur[1]),
          dx: `${round(ctx.between(-drift, drift))}px`,
          rot: `${round(spin ? ctx.between(-spin, spin) : 0)}deg`,
          y: `${round(ctx.between(8, H - 12))}px`,
          r0: `${round(spin ? ctx.between(-180, 180) : 0)}deg`,
        }),
      }, make(i))));
  }
  return g({}, items);
}

// Rising particles (bubbles, hearts, lanterns). make(i) draws one at the origin.
function rising(ctx, count, make, { dur = [8, 14], drift = 16, left = 10, right = W - 10, opacity = [0.6, 1] } = {}) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(g({ transform: `translate(${round(ctx.between(left, right))} 0)` },
      g({
        class: 'sc-up',
        style: vars({
          dur: ctx.between(...dur),
          ph: -ctx.between(0, dur[1]),
          dx: `${round(ctx.between(-drift, drift))}px`,
          y: `${round(ctx.between(10, H - 20))}px`,
          o: round(ctx.between(...opacity)),
        }),
      }, make(i))));
  }
  return g({}, items);
}

const snowGround = (ctx, y = 128) =>
  el('path', { d: `M-10 ${y}C60 ${y - 10} 120 ${y - 6} 170 ${y - 2}S280 ${y - 12} 330 ${y - 4}V${H + 10}H-10z`, fill: ctx.linear('#eef4fb', '#c9d6e8') });

function snowflakes(ctx, count, opts = {}) {
  return falling(ctx, count, () => el('circle', { r: round(ctx.between(0.8, 2.4)), fill: '#fff', opacity: round(ctx.between(0.55, 0.95)) }), { dur: [7, 12], ...opts });
}

// --- Advent: a candlestick in the window, 1 to 4 candles burning ---

function adventStand(ctx, lit) {
  const cx = 160;
  const top = 114;
  const candles = [];
  for (let i = 0; i < 4; i++) {
    // The first candle has burned the most Sundays, so it is the shortest.
    const h = i < lit ? 44 - 6 * (lit - 1 - i) : 44;
    candles.push(candle(ctx, cx - 54 + i * 36, top + 2, { h, w: 11, lit: i < lit, delay: 0.9 + i * 0.45 }));
  }
  const moss = [];
  for (let i = 0; i < 11; i++) {
    moss.push(el('ellipse', { cx: round(cx - 78 + i * 15.6), cy: top + 1, rx: 9, ry: 4, fill: i % 2 ? '#2f6a3a' : '#3d7d44' }));
  }
  for (let i = 0; i < 9; i++) {
    moss.push(el('circle', { cx: round(cx - 74 + ctx.between(0, 148)), cy: round(top + ctx.between(-2, 2)), r: 2, fill: '#d32f3a' }));
  }
  return g({},
    enter('sc-fade-slow', 0.8, el('ellipse', {
      class: 'sc-breathe', cx, cy: 78, rx: 70 + lit * 14, ry: 46 + lit * 6, fill: ctx.glow('#ffc65a', 0.3 + lit * 0.1),
    })),
    enter('sc-rise', 0.1,
      candles,
      el('rect', { x: cx - 82, y: top, width: 164, height: 12, rx: 6, fill: '#7a4a26' }),
      el('rect', { x: cx - 82, y: top, width: 164, height: 4, rx: 2, fill: '#9c6438' }),
      moss));
}

// The window frame around a view (forest or stars), with a sill for the candlestick.
function adventWindow(ctx, view) {
  const clip = ctx.id('win');
  ctx.defs.append(el('clipPath', { id: clip }, el('rect', { x: 40, y: 8, width: 240, height: 106 })));
  return g({},
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear('#2a1a22', '#3d2530') }),
    g({ 'clip-path': `url(#${clip})` }, view),
    el('path', { d: 'M160 8V114M40 60H280', stroke: '#e9dcc4', 'stroke-width': 5 }),
    el('rect', { x: 36, y: 4, width: 248, height: 114, fill: 'none', stroke: '#e9dcc4', 'stroke-width': 8 }),
    el('rect', { x: 20, y: 118, width: 280, height: 40, fill: ctx.linear('#d9c3a0', '#b8996f') }));
}

function advent(lit, forest) {
  return (ctx) => {
    if (ctx.small) return [adventStand(ctx, lit)];
    const view = [sky(ctx, '#071029', '#1d3a6b'), starField(ctx, 16, { top: 10, bottom: 70, left: 42, right: 278 })];
    if (forest) {
      view.push(
        [70, 104, 132, 186, 222, 262].map((x, i) => pine(x, 112, 46 + (i % 3) * 12, { fill: '#163a4c', shade: '#112f3e', snow: '#dfe8f3' })),
        el('path', { d: 'M30 104C90 96 150 100 200 98S270 94 300 100V120H30z', fill: '#e4ecf6' }),
        snowflakes(ctx, 18, { left: 40, right: 280 }),
      );
    } else {
      view.push(el('circle', { cx: 236, cy: 34, r: 10, fill: '#fff6d8', opacity: 0.9 }));
    }
    return [adventWindow(ctx, view), adventStand(ctx, lit)];
  };
}

// --- Lucia: Lucia and her maids glide in, the glow fades up and her three candles light ---

function luciaFigure(ctx, x, { lucia = false, hair = '#e8c170', scale = 1 } = {}) {
  const parts = [
    el('ellipse', { cx: 0, cy: -55, rx: 8.5, ry: 13, fill: hair }),
    el('path', { d: 'M-7-50C-10-48-11-44-12-38L-17 0H17L12-38C11-44 10-48 7-50z', fill: '#fbfcff', stroke: '#c3cde0', 'stroke-width': 0.8 }),
    el('path', { d: 'M-3-33C-1-28 3-28 5-31', stroke: '#dfe5f0', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
    el('circle', { cx: 0, cy: -58, r: 7, fill: '#f3cfae' }),
    el('path', { d: 'M-7.5-58C-7-66 7-66 7.5-58 5-62-5-62-7.5-58z', fill: hair }),
    el('circle', { cx: -3.2, cy: -56, r: 1.4, fill: '#f2a7a0', opacity: 0.7 }),
    el('circle', { cx: 3.2, cy: -56, r: 1.4, fill: '#f2a7a0', opacity: 0.7 }),
  ];
  if (lucia) {
    parts.push(
      el('path', { d: 'M-11.6-33H11.6L11.9-29H-11.9z', fill: '#c4252f' }),
      el('path', { d: 'M2-30L6-13 8.6-14 4.6-30z', fill: '#c4252f' }),
      el('ellipse', { cx: 0, cy: -64, rx: 8.8, ry: 2.6, fill: '#2f6a3a' }),
      el('circle', { cx: -6, cy: -63.5, r: 1.1, fill: '#d32f3a' }),
      el('circle', { cx: 6, cy: -63.5, r: 1.1, fill: '#d32f3a' }),
      [-5, 0, 5].map((cx, i) => [
        el('rect', { x: cx - 1.2, y: -74, width: 2.4, height: 9, fill: '#fff' }),
        flame(ctx, cx, -74.5, { delay: 1.6 + i * 0.4, scale: 0.55, halo: 11 }),
      ]),
    );
  } else {
    parts.push(
      el('path', { d: 'M-7-63L-5-67.5-3-63 0-68.5 3-63 5-67.5 7-63', fill: 'none', stroke: '#e3e9f5', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
      el('rect', { x: 1, y: -45, width: 3, height: 14, fill: '#fff' }),
      el('circle', { cx: 2.5, cy: -30, r: 2.2, fill: '#f3cfae' }),
      flame(ctx, 2.5, -45.5, { scale: 0.6, halo: 10 }),
    );
  }
  return g({ transform: `translate(${x} 136) scale(${scale})` }, parts);
}

function lucia(ctx) {
  const procession = enter('sc-glide', 0.1,
    luciaFigure(ctx, 84, { hair: '#8a5a33', scale: 0.86 }),
    luciaFigure(ctx, 126, { hair: '#d9a35b', scale: 0.88 }),
    luciaFigure(ctx, 168, { hair: '#e8c170', scale: 0.9 }),
    luciaFigure(ctx, 214, { lucia: true }));
  const glow = enter('sc-fade-slow', 0.2, el('ellipse', { class: 'sc-breathe', cx: 150, cy: 100, rx: 140, ry: 70, fill: ctx.glow('#ffd27a', 0.55) }));
  if (ctx.small) return [glow, procession];
  return [sky(ctx, '#0b1430', '#2a3f73'), starField(ctx, 22, { bottom: 80 }), glow, snowGround(ctx, 132), procession];
}

// --- Christmas trees ---

const LIGHT_COLORS = ['#ff5a5f', '#ffd166', '#7fd3ff', '#ffffff', '#ff9f43'];
// Light positions along three garlands on the tree below (centred on x 160).
const TREE_LIGHTS = [
  [154, 46], [163, 50], [171, 54],
  [140, 72], [150, 76], [161, 79], [172, 77], [183, 73],
  [128, 102], [140, 106], [152, 108], [165, 108], [178, 106], [191, 102],
];

function christmasTree(ctx, { grow = false, lightsFrom = null, starAt = null } = {}) {
  const tree = pine(160, 126, 104, { fill: '#1f6b3a', shade: '#185a30', snow: '#e7f0f8' });
  const garlands = el('path', {
    d: 'M150 44Q162 54 176 50M134 70Q160 84 188 70M122 100Q160 114 198 100',
    fill: 'none', stroke: '#e8c36a', 'stroke-width': 1.3, opacity: 0.8,
  });
  const lights = TREE_LIGHTS.map(([x, y], i) => {
    const bulb = el('circle', {
      cx: x, cy: y, r: 2.6, fill: LIGHT_COLORS[i % LIGHT_COLORS.length], class: 'sc-twinkle',
      style: vars({ dur: ctx.between(1.4, 2.8), ph: -ctx.between(0, 3) }),
    });
    return lightsFrom == null ? bulb : enter('sc-pop', lightsFrom + i * 0.1, bulb);
  });
  const star = g({},
    el('circle', { class: 'sc-breathe', cx: 160, cy: 22, r: 16, fill: ctx.glow('#ffe08a', 0.8) }),
    el('polygon', { points: starPoints(160, 22, 9, 3.8), fill: '#ffd34d', stroke: '#c9971f', 'stroke-width': 0.6 }));
  const body = g({}, tree, garlands, lights, starAt == null ? star : enter('sc-pop', starAt, star));
  return grow ? enter('sc-grow', 0.1, body) : body;
}

function present(x, y, w, h, color, ribbon) {
  return g({},
    el('rect', { x, y, width: w, height: h, rx: 1.5, fill: color }),
    el('rect', { x: x + w / 2 - 1.6, y, width: 3.2, height: h, fill: ribbon }),
    el('rect', { x, y: y + h * 0.35, width: w, height: 3, fill: ribbon }),
    el('path', { d: `M${x + w / 2} ${y}c-5-6-9-1-4 0 M${x + w / 2} ${y}c5-6 9-1 4 0`, fill: 'none', stroke: ribbon, 'stroke-width': 2, 'stroke-linecap': 'round' }));
}

function christmas(ctx) {
  const presents = [
    present(110, 114, 24, 20, '#c4252f', '#ffd166'),
    present(134, 122, 18, 13, '#2f7fd1', '#ffffff'),
    present(170, 120, 22, 15, '#e8c36a', '#c4252f'),
    present(194, 112, 18, 22, '#23673f', '#ffd166'),
  ].map((box, i) => enter('sc-drop', 0.6 + i * 0.3, box));
  const scene = [
    enter('sc-fade-slow', 0, el('ellipse', { class: 'sc-breathe', cx: 160, cy: 76, rx: 110, ry: 74, fill: ctx.glow('#ffcf6b', 0.45) })),
    enter('sc-rise', 0, christmasTree(ctx, { starAt: 1.8 })),
    presents,
  ];
  if (ctx.small) return scene;
  return [sky(ctx, '#0b1430', '#30366e'), starField(ctx, 20, { bottom: 80 }), snowGround(ctx, 130), scene];
}

// --- Hiro, a ginger cat, peeks up from the bottom and swishes his tail ---

function cat(ctx) {
  const fur = '#d9772b';
  const dark = '#a8521a';
  const pale = '#f3c08a';
  const stripes = (d) => el('path', { d, fill: 'none', stroke: dark, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  const hiro = enter('sc-peek', 0.3,
    g({ class: 'sc-wag' },
      el('path', { d: 'M222 150C248 142 236 112 254 98', fill: 'none', stroke: fur, 'stroke-width': 9, 'stroke-linecap': 'round' }),
      el('path', { d: 'M236 136l7 3M241 120l7 1M247 107l6-1', stroke: dark, 'stroke-width': 2.4, 'stroke-linecap': 'round' })),
    el('ellipse', { cx: 180, cy: 170, rx: 50, ry: 44, fill: fur }),
    el('ellipse', { cx: 180, cy: 150, rx: 18, ry: 20, fill: pale }),
    stripes('M140 150q6 4 4 12M222 150q-6 4-4 12M146 136q5 3 4 9M214 136q-5 3-4 9'),
    g({ class: 'sc-twitch' }, el('polygon', { points: '157,94 161,64 177,82', fill: fur })),
    el('polygon', { points: '183,82 199,64 203,94', fill: fur }),
    el('ellipse', { cx: 180, cy: 104, rx: 29, ry: 24, fill: fur }),
    el('polygon', { points: '161,89 163.5,73 171,83', fill: '#f2a7a0' }),
    el('polygon', { points: '189,83 196.5,73 199,89', fill: '#f2a7a0' }),
    stripes('M180 82v8M173 83l2 6M187 83l-2 6M152 100h7M152 106h6M208 100h-7M208 106h-6'),
    el('ellipse', { cx: 180, cy: 113, rx: 11, ry: 7.5, fill: pale }),
    g({ class: 'sc-blink' },
      el('ellipse', { cx: 169, cy: 101, rx: 4.6, ry: 5.6, fill: '#9fd36a' }),
      el('ellipse', { cx: 191, cy: 101, rx: 4.6, ry: 5.6, fill: '#9fd36a' }),
      el('ellipse', { cx: 169, cy: 101, rx: 1.3, ry: 4.6, fill: '#1b1b1b' }),
      el('ellipse', { cx: 191, cy: 101, rx: 1.3, ry: 4.6, fill: '#1b1b1b' })),
    el('path', { d: 'M177.6 109h4.8l-2.4 2.8z', fill: '#c9707e' }),
    el('path', { d: 'M168 113l-20-3M168 116l-20 2M192 113l20-3M192 116l20 2', stroke: '#fff3e6', 'stroke-width': 0.7, opacity: 0.85 }));
  if (ctx.small) return [hiro];
  return [
    sky(ctx, '#0a1330', '#283f70'),
    starField(ctx, 16, { bottom: 70 }),
    el('path', { d: 'M76 22a14 14 0 1 0 12 22a11 11 0 1 1 -12-22z', fill: '#fff3c4' }),
    el('circle', { cx: 74, cy: 34, r: 26, fill: ctx.glow('#fff3c4', 0.25) }),
    snowGround(ctx, 136),
    g({ transform: 'translate(0 -12)' }, hiro), // a little higher, clear of the fade into the paper
  ];
}

// --- Registry ---

// home: shown small on the main screen on the door's date. view: the part of the picture
// the small version shows, and where it sits in its box.
const DEFINITIONS = {
  advent1: { label: '1:a advent: ljusstake med ett ljus', home: true, view: '74 40 172 88', draw: advent(1, false) },
  advent2: { label: '2:a advent: ljusstake med två ljus', home: true, view: '74 40 172 88', draw: advent(2, false) },
  advent4: { label: '4:e advent: fyra ljus och snöig skog', home: true, view: '74 40 172 88', draw: advent(4, true) },
  lucia: { label: 'Lucia med tärnor', home: true, view: '40 34 220 104', draw: lucia },
  cat: { label: 'Hiro tittar upp', home: true, view: '120 58 150 92', align: 'xMaxYMax meet', draw: cat },
  christmas: { label: 'Julgran med paket', home: true, view: '92 4 136 134', draw: christmas },
};

function makeRender(key, def) {
  return function render(container, { date = '', reducedMotion = false, small = false } = {}) {
    const mini = Boolean(small && def.home);
    const ctx = createContext(key, date, mini);
    const root = document.createElement('div');
    root.className = `sc sc-${key}${mini ? ' sc-small' : ''}${reducedMotion ? ' is-still' : ''}`;
    root.setAttribute('aria-hidden', 'true');
    root.dataset.scene = key;
    const svg = el('svg', {
      viewBox: mini ? def.view : `0 0 ${W} ${H}`,
      preserveAspectRatio: mini ? (def.align ?? 'xMidYMax meet') : 'xMidYMid slice',
      focusable: 'false',
    });
    const content = def.draw(ctx);
    svg.append(ctx.defs, ...[content].flat(Infinity).filter(Boolean));
    root.append(svg);
    container.append(root);

    // The loop pauses while the tab is hidden (see .sc.is-paused in scenes.css).
    const onVisibility = () => root.classList.toggle('is-paused', document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    let cleaned = false;
    return function cleanup() {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    };
  };
}

/** Every scene by key: { label, home, render(container, { date, reducedMotion, small }) }. */
export const SCENES = Object.freeze(
  Object.fromEntries(
    Object.entries(DEFINITIONS).map(([key, def]) => [
      key,
      Object.freeze({ label: def.label, home: Boolean(def.home), render: makeRender(key, def) }),
    ]),
  ),
);

export const SCENE_KEYS = Object.freeze(Object.keys(SCENES));

/** The scenes that also have a small version on the main screen. */
export const HOME_SCENE_KEYS = Object.freeze(SCENE_KEYS.filter((key) => SCENES[key].home));

export const isScene = (key) => typeof key === 'string' && Object.hasOwn(SCENES, key);

/** The scene to show small on the main screen on dateKey, or null. */
export function homeSceneFor(days, dateKey) {
  const day = days.find((d) => d.date === dateKey);
  return day && isScene(day.scene) && SCENES[day.scene].home ? day.scene : null;
}

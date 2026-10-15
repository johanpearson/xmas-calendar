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

// --- Tree: the tree grows, then lights up bulb by bulb and gets its star ---

function tree(ctx) {
  return [
    sky(ctx, '#0a1430', '#26427a'),
    starField(ctx, 18, { bottom: 80 }),
    snowGround(ctx, 128),
    christmasTree(ctx, { grow: true, lightsFrom: 1.2, starAt: 2.5 }),
  ];
}

// --- Camera: a flash, then a polaroid drops in and develops ---

function camera(ctx) {
  const bokeh = [];
  for (let i = 0; i < 9; i++) {
    bokeh.push(el('circle', {
      class: 'sc-breathe', cx: round(ctx.between(10, 310)), cy: round(ctx.between(10, 140)), r: round(ctx.between(8, 20)),
      fill: ctx.glow(ctx.pick(['#ffd166', '#ff8fa3', '#9ad0ff']), 0.5), style: vars({ ph: -ctx.between(0, 3) }),
    }));
  }
  const photo = g({},
    el('rect', { x: -38, y: -50, width: 76, height: 70, fill: ctx.linear('#16305e', '#3a5a94') }),
    el('path', { d: 'M-38 8C-20 0 0 4 38 -2V20H-38z', fill: '#e7eef8' }),
    pine(-18, 10, 34, { fill: '#1f6b3a', shade: '#185a30' }),
    el('circle', { cx: 6, cy: 2, r: 5, fill: '#fff' }),
    el('circle', { cx: 6, cy: -6, r: 3.6, fill: '#fff' }),
    el('circle', { cx: 18, cy: 4, r: 4, fill: '#fff' }),
    el('circle', { cx: 18, cy: -3, r: 3, fill: '#fff' }),
    el('polygon', { points: starPoints(22, -36, 5, 2), fill: '#ffd34d' }),
    el('rect', { x: -38, y: -50, width: 76, height: 70, fill: '#3b3530', class: 'sc-develop' }));
  const polaroid = g({ transform: 'translate(160 76) rotate(-5)' },
    enter('sc-drop-in', 0.45,
      g({ class: 'sc-sway', style: vars({ dur: 5 }) },
        el('rect', { x: -45, y: -57, width: 90, height: 104, rx: 2, fill: '#000', opacity: 0.25, transform: 'translate(3 4)' }),
        el('rect', { x: -45, y: -57, width: 90, height: 104, rx: 2, fill: '#fbfaf6' }),
        photo,
        el('path', { d: 'M-24 36q8-4 16 0t16 0', stroke: '#8b8fa3', fill: 'none', 'stroke-width': 1.2 }))));
  return [
    sky(ctx, '#24162e', '#4a2c4f'),
    bokeh,
    polaroid,
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: '#fff', class: 'sc-flash' }),
  ];
}

// --- Letter: the wax seal cracks, the flap opens and the letter rises ---

function letter(ctx) {
  const sealHalf = (side) => {
    const d = side < 0 ? 'M160 89a11 11 0 0 0 0 22l2-6-3-4 3-5-2-7z' : 'M160 89a11 11 0 0 1 0 22l2-6-3-4 3-5-2-7z';
    return g({ class: side < 0 ? 'sc-crack-l' : 'sc-crack-r' },
      el('path', { d, fill: '#b3202c' }),
      el('path', { d, fill: 'none', stroke: '#7d121b', 'stroke-width': 0.8 }));
  };
  const paperLines = [44, 52, 60, 68].map((y, i) =>
    el('path', { d: `M122 ${y}h${i === 3 ? 44 : 76}`, stroke: '#9aa3b8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  return [
    sky(ctx, '#123524', '#1f5a3e'),
    starField(ctx, 12, { bottom: 140 }),
    el('ellipse', { cx: 160, cy: 84, rx: 120, ry: 60, fill: ctx.glow('#ffe7b0', 0.35) }),
    enter('sc-rise', 0.1,
      el('rect', { x: 98, y: 60, width: 124, height: 74, rx: 3, fill: '#e9d8b4' }),
      el('polygon', { class: 'sc-flap', points: '98,60 222,60 160,100', fill: '#dcc79d' }),
      g({ class: 'sc-float' }, enter('sc-letter', 2.0,
        el('rect', { x: 112, y: 32, width: 96, height: 66, rx: 2, fill: '#fffdf6' }),
        paperLines,
        el('path', { d: 'M196 82c-3-4-9-1-5 4l5 4 5-4c4-5-2-8-5-4z', fill: '#d6334a' }))),
      el('polygon', { points: '98,74 160,108 222,74 222,134 98,134', fill: '#f4e6c8' }),
      el('path', { d: 'M98 134L150 100M222 134L170 100', stroke: '#d9c49b', 'stroke-width': 1.2 }),
      sealHalf(-1),
      sealHalf(1)),
  ];
}

// --- Candy: sweets falling ---

function sweet(ctx) {
  const kind = ctx.pick(['cane', 'wrap', 'wrap', 'pop']);
  const color = ctx.pick(['#e63946', '#2a9d8f', '#ffd166', '#9b5de5', '#f15bb5', '#4cc9f0']);
  const s = round(ctx.between(0.8, 1.25));
  if (kind === 'cane') {
    return g({ transform: `scale(${s})` },
      el('path', { d: 'M0 10V-4a5 5 0 0 1 10 0', fill: 'none', stroke: '#fff', 'stroke-width': 3.4, 'stroke-linecap': 'round' }),
      el('path', { d: 'M0 10V-4a5 5 0 0 1 10 0', fill: 'none', stroke: '#e63946', 'stroke-width': 3.4, 'stroke-dasharray': '2.4 2.4' }));
  }
  if (kind === 'pop') {
    return g({ transform: `scale(${s})` },
      el('path', { d: 'M0 4V16', stroke: '#f4ead8', 'stroke-width': 1.6 }),
      el('circle', { r: 6, fill: color }),
      el('path', { d: 'M0 0a2 2 0 0 1 3 1a4 4 0 0 1-5 3a6 6 0 0 1-3-6', fill: 'none', stroke: '#fff', 'stroke-width': 1.3 }));
  }
  return g({ transform: `scale(${s})` },
    el('path', { d: 'M-6 0l-6-5v10zM6 0l6-5v10z', fill: color, opacity: 0.85 }),
    el('ellipse', { rx: 7, ry: 5, fill: color }),
    el('ellipse', { cx: -2, cy: -2, rx: 2.4, ry: 1.2, fill: '#fff', opacity: 0.6 }));
}

function candy(ctx) {
  return [
    sky(ctx, '#3a1430', '#7a2346'),
    el('ellipse', { cx: 160, cy: 60, rx: 150, ry: 80, fill: ctx.glow('#ffb3c7', 0.3) }),
    enter('sc-fade', 0, falling(ctx, 26, () => sweet(ctx), { dur: [7, 12], drift: 18, spin: 260 })),
  ];
}

// --- Paint: splats of colour that become a reindeer ---

const SPLAT = 'M0-8c3 0 4 3 7 2s5 3 2 5 2 5-1 6-4 1-6 3-5-1-6-3-6 0-6-3 2-4 0-6 2-4 5-3 5-4 5-4z';

function paint(ctx) {
  const brown = '#8a5530';
  const reindeer = g({},
    el('path', { d: 'M200 46c-2-10 4-16 2-24M200 34c4-2 7-6 8-11M203 42c6-3 10-2 14-6M192 46c-6-8-14-10-16-18M184 36c-5 0-8-3-10-6', fill: 'none', stroke: '#6b3d1f', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    el('path', { d: 'M136 112v22M150 114v20M176 114v20M190 110v24', stroke: brown, 'stroke-width': 6, 'stroke-linecap': 'round' }),
    el('ellipse', { cx: 163, cy: 98, rx: 38, ry: 19, fill: brown }),
    el('path', { d: 'M184 92l10-34 14 4-8 34z', fill: brown }),
    el('ellipse', { cx: 207, cy: 56, rx: 15, ry: 9, fill: brown, transform: 'rotate(12 207 56)' }),
    el('ellipse', { cx: 194, cy: 50, rx: 5, ry: 2.6, fill: '#a86b40', transform: 'rotate(-30 194 50)' }),
    el('circle', { cx: 205, cy: 53, r: 1.8, fill: '#1c120c' }),
    el('ellipse', { cx: 160, cy: 104, rx: 22, ry: 8, fill: '#c58a5c', opacity: 0.6 }),
    el('path', { d: 'M125 92c-6-2-8 4-4 6', stroke: brown, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }));
  const spots = [
    [208, 24, '#e63946'], [176, 26, '#2a9d8f'], [216, 38, '#ffd166'], [130, 100, '#9b5de5'],
    [164, 92, '#ffd166'], [196, 98, '#4cc9f0'], [138, 130, '#2a9d8f'], [190, 130, '#f15bb5'],
    [100, 40, '#4cc9f0'], [252, 112, '#9b5de5'], [70, 116, '#e63946'], [262, 40, '#2a9d8f'],
  ].map(([x, y, fill], i) =>
    g({ transform: `translate(${x} ${y}) rotate(${round(ctx.between(0, 360))}) scale(${round(ctx.between(0.8, 1.4))})` },
      enter('sc-splat', 0.1 + i * 0.11, el('path', { d: SPLAT, fill, class: 'sc-breathe', style: vars({ ph: -ctx.between(0, 3) }) }))));
  return [
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear('#fff4e2', '#f1dcb8') }),
    spots.slice(8),
    enter('sc-paint-in', 1.5, reindeer),
    spots.slice(0, 8),
    g({ transform: 'translate(220 58)' }, enter('sc-pop', 2.4,
      el('circle', { class: 'sc-breathe', r: 9, fill: ctx.glow('#ff4d4d', 0.7) }),
      el('circle', { r: 3.6, fill: '#e3242b' }))),
  ];
}

// --- Party: confetti and bubbles ---

function party(ctx) {
  const colors = ['#ff5a5f', '#ffd166', '#5fd38d', '#7fb4e8', '#f15bb5', '#ffffff'];
  return [
    sky(ctx, '#1d0f3a', '#4a1f6b'),
    el('ellipse', { cx: 160, cy: 70, rx: 150, ry: 80, fill: ctx.glow('#c77dff', 0.3) }),
    rising(ctx, 10, () => {
      const r = round(ctx.between(4, 9));
      return g({},
        el('circle', { r, fill: '#ffffff', 'fill-opacity': 0.08, stroke: '#e9e3ff', 'stroke-width': 1, 'stroke-opacity': 0.7 }),
        el('circle', { cx: round(-r * 0.4), cy: round(-r * 0.4), r: round(r * 0.22), fill: '#fff', opacity: 0.8 }));
    }, { dur: [7, 12], opacity: [0.6, 0.95] }),
    enter('sc-burst', 0, falling(ctx, 28, () => el('rect', {
      x: -2.5, y: -4, width: round(ctx.between(3.5, 6)), height: round(ctx.between(6, 10)), rx: 1, fill: ctx.pick(colors),
    }), { dur: [5, 9], drift: 24, spin: 720 })),
  ];
}

// --- Cozy: flickering candles and floating hearts ---

function heart(fill, s = 1) {
  return el('path', { d: 'M0 4C-6-1-6-6-3-7S0-5 0-4C0-5 1-8 3-7S6-1 0 4z', fill, transform: `scale(${s})` });
}

function cozy(ctx) {
  return [
    sky(ctx, '#2a120f', '#5a2a1a'),
    enter('sc-fade-slow', 0.2, el('ellipse', { class: 'sc-breathe', cx: 160, cy: 84, rx: 140, ry: 70, fill: ctx.glow('#ffb35a', 0.5) })),
    rising(ctx, 9, () => heart(ctx.pick(['#ff7b8a', '#ff4d6d', '#ffc2cc']), round(ctx.between(0.9, 1.7))), { dur: [9, 15], opacity: [0.5, 0.85] }),
    el('rect', { x: -10, y: 128, width: W + 20, height: 40, fill: '#3b1d12' }),
    el('ellipse', { cx: 160, cy: 129, rx: 64, ry: 6, fill: '#c9b38a' }),
    candle(ctx, 132, 128, { h: 30, w: 14, color: '#f5efe3', delay: 0.4 }),
    candle(ctx, 160, 128, { h: 46, w: 14, color: '#c4252f', delay: 0.8 }),
    candle(ctx, 188, 128, { h: 22, w: 14, color: '#f5efe3', delay: 1.2 }),
  ];
}

// --- Gold: floating gold dust ---

function gold(ctx) {
  const dust = [];
  for (let i = 0; i < 34; i++) {
    const r = round(ctx.between(0.7, 2.4));
    dust.push(g({ transform: `translate(${round(ctx.between(0, W))} ${round(ctx.between(0, H))})` },
      el('circle', {
        r, fill: r > 1.8 ? ctx.glow('#ffe08a', 1) : '#f3d48a', class: 'sc-drift',
        style: vars({ dur: ctx.between(4, 9), ph: -ctx.between(0, 9), dx: `${round(ctx.between(-12, 12))}px`, dy: `${round(ctx.between(-14, 6))}px`, tw: ctx.between(1.6, 3.4) }),
      })));
  }
  const sparkles = [[70, 40], [250, 30], [214, 106], [104, 112], [160, 64]].map(([x, y], i) =>
    g({ transform: `translate(${x} ${y})` }, enter('sc-pop', 0.4 + i * 0.4,
      el('path', { class: 'sc-twinkle', d: 'M0-9Q0 0 9 0Q0 0 0 9Q0 0-9 0Q0 0 0-9z', fill: '#fff1c1', style: vars({ dur: ctx.between(1.5, 3), ph: -ctx.between(0, 2) }) }))));
  return [
    sky(ctx, '#0e1530', '#2a2445'),
    enter('sc-fade-slow', 0, el('ellipse', { class: 'sc-breathe', cx: 160, cy: 75, rx: 130, ry: 70, fill: ctx.glow('#e8c36a', 0.35) })),
    enter('sc-fade-slow', 0.2, dust),
    sparkles,
  ];
}

// --- Snow: snowfall over a little red cottage ---

function snow(ctx) {
  return [
    sky(ctx, '#0d1a38', '#3b5a8c'),
    starField(ctx, 10, { bottom: 50 }),
    el('circle', { cx: 262, cy: 30, r: 12, fill: '#fff6d8', opacity: 0.9 }),
    [40, 72, 250, 290].map((x, i) => pine(x, 124, 40 + (i % 2) * 14, { fill: '#163a4c', shade: '#112f3e', snow: '#e4ecf6' })),
    g({},
      el('rect', { x: 130, y: 96, width: 56, height: 30, fill: '#a3212b' }),
      el('polygon', { points: '124,98 158,76 192,98', fill: '#3b2a26' }),
      el('path', { d: 'M124 98L158 76 192 98', fill: 'none', stroke: '#f6f9fd', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      el('rect', { x: 150, y: 106, width: 12, height: 20, fill: '#5a2a1a' }),
      enter('sc-fade', 1.0,
        el('rect', { x: 138, y: 104, width: 9, height: 9, fill: '#ffd27a' }),
        el('rect', { x: 169, y: 104, width: 9, height: 9, fill: '#ffd27a' }),
        el('ellipse', { class: 'sc-breathe', cx: 158, cy: 108, rx: 36, ry: 18, fill: ctx.glow('#ffd27a', 0.35) }))),
    snowGround(ctx, 126),
    enter('sc-fade', 0, snowflakes(ctx, 34, { drift: 18 })),
  ];
}

// --- Stars: a starry sky with the Milky Way and a shooting star now and then ---

function stars(ctx) {
  const big = [];
  for (let i = 0; i < 8; i++) {
    const r = round(ctx.between(3, 5.5));
    big.push(g({ transform: `translate(${round(ctx.between(10, 310))} ${round(ctx.between(8, 120))})` },
      enter('sc-pop', ctx.between(0.3, 2.2),
        el('path', { class: 'sc-twinkle', d: `M0-${r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0-${r} 0Q0 0 0-${r}z`, fill: '#fff6d8', style: vars({ dur: ctx.between(1.6, 3), ph: -ctx.between(0, 3) }) }))));
  }
  return [
    sky(ctx, '#040a1d', '#1a2b5a'),
    el('ellipse', { cx: 160, cy: 70, rx: 190, ry: 24, fill: ctx.glow('#b9c8ff', 0.25), transform: 'rotate(-18 160 70)' }),
    starField(ctx, 26, { bottom: 145, from: 0, to: 1.8 }),
    big,
    g({ transform: 'translate(70 26) rotate(24)' },
      el('rect', { class: 'sc-shoot', x: 0, y: 0, width: 46, height: 1.6, rx: 0.8, fill: ctx.linear('#ffffff', '#ffffff') })),
  ];
}

// --- Lanterns: paper lanterns floating up into the night ---

function lantern(ctx) {
  const s = round(ctx.between(0.6, 1.2));
  return g({ transform: `scale(${s})` },
    el('circle', { cy: -4, r: 16, fill: ctx.glow('#ffb347', 0.5) }),
    el('path', { d: 'M-7-14h14l2 18H-9z', fill: ctx.linear('#ffd27a', '#e8742b') }),
    el('path', { d: 'M-5-14v18M0-14v18M5-14v18', stroke: '#c95d1f', 'stroke-width': 0.6, opacity: 0.6 }),
    el('ellipse', { cy: 4, rx: 4, ry: 1.6, fill: '#fff4c2' }));
}

function lanterns(ctx) {
  return [
    sky(ctx, '#120d2b', '#4a2448'),
    starField(ctx, 16, { bottom: 80 }),
    el('path', { d: 'M-10 132C60 124 120 130 170 128S280 122 330 128V160H-10z', fill: '#0b0a1c' }),
    el('ellipse', { cx: 160, cy: 140, rx: 150, ry: 12, fill: ctx.glow('#ffb347', 0.25) }),
    rising(ctx, 12, () => lantern(ctx), { dur: [14, 22], drift: 22, opacity: [0.8, 1] }),
    g({ transform: 'translate(160 0)' }, g({ class: 'sc-release' }, lantern(ctx))),
  ];
}

// --- Flashlight: a beam searching the dark ---

function flashlight(ctx) {
  const hidden = g({ opacity: 0.32 },
    present(56, 102, 26, 22, '#c4252f', '#ffd166'),
    el('polygon', { points: starPoints(250, 46, 12, 5), fill: '#ffd34d' }),
    el('path', { d: 'M110 40a7 7 0 1 1 0 0.1M116 44l18 10m-6-3l-3 5m7-1l-3 4', fill: 'none', stroke: '#e8c36a', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    el('path', { d: 'M232 118h40l-6-14h-28z', fill: '#7fb4e8' }));
  return [
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear('#04060d', '#0e1526') }),
    hidden,
    enter('sc-switch-on', 0.3,
      g({ class: 'sc-search' },
        el('polygon', { points: '160,160 112,10 208,10', fill: ctx.linear('#fff4c2', '#fff4c2') , opacity: 0.16 }),
        el('ellipse', { cx: 160, cy: 18, rx: 48, ry: 22, fill: ctx.glow('#fff4c2', 0.55) }))),
  ];
}

// --- Mystery: question marks drifting ---

function mystery(ctx) {
  const marks = [];
  for (let i = 0; i < 12; i++) {
    const size = round(ctx.between(16, 44));
    marks.push(g({ transform: `translate(${round(ctx.between(16, 304))} ${round(ctx.between(30, 140))})` },
      enter('sc-pop', 0.1 + i * 0.14,
        el('text', {
          class: 'sc-bob', 'font-size': size, 'font-family': 'Georgia, serif', 'font-weight': 700, 'text-anchor': 'middle',
          fill: ctx.pick(['#ffd166', '#f15bb5', '#9ad0ff', '#c9a0e8']), opacity: round(ctx.between(0.45, 0.9)),
          style: vars({ dur: ctx.between(3, 6), ph: -ctx.between(0, 6) }),
        }, '?'))));
  }
  return [
    sky(ctx, '#1a0f2e', '#3c1d5c'),
    starField(ctx, 12, { bottom: 140 }),
    el('ellipse', { cx: 160, cy: 75, rx: 120, ry: 70, fill: ctx.glow('#c9a0e8', 0.3) }),
    marks,
  ];
}

// --- Movie: a starry film with flicker and a running film strip ---

function movie(ctx) {
  const holes = ctx.id('holes');
  ctx.defs.append(el('pattern', { id: holes, width: 18, height: 14, patternUnits: 'userSpaceOnUse' },
    el('rect', { x: 5, y: 4, width: 8, height: 6, rx: 1.5, fill: '#e9e3d0' })));
  const strip = (y) => g({ transform: `translate(0 ${y})` },
    g({ class: 'sc-film' },
      el('rect', { x: -40, y: 0, width: W + 80, height: 14, fill: '#121214' }),
      el('rect', { x: -40, y: 0, width: W + 80, height: 14, fill: `url(#${holes})` })));
  return [
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: '#0a0a12' }),
    enter('sc-projector', 0.2,
      el('rect', { x: 0, y: 14, width: W, height: 122, fill: ctx.linear('#101a3a', '#2c3c6e') }),
      starField(ctx, 22, { top: 18, bottom: 130 }),
      el('circle', { cx: 240, cy: 50, r: 13, fill: '#fff6d8' }),
      el('circle', { cx: 240, cy: 50, r: 30, fill: ctx.glow('#fff6d8', 0.3) }),
      el('rect', { x: 0, y: 14, width: W, height: 122, fill: '#fff', class: 'sc-flicker-o' }),
      el('path', { class: 'sc-scratch', d: 'M96 14v122M212 14v122', stroke: '#fff', 'stroke-width': 0.7 })),
    strip(0),
    strip(136),
  ];
}

// --- Glögg: a steaming mug ---

function glogg(ctx) {
  const steam = [0, 1, 2].map((i) =>
    el('path', {
      class: 'sc-steam', d: `M${150 + i * 10} 70c-6-8 6-12 0-20s6-12 0-20`, fill: 'none', stroke: '#fff', 'stroke-width': 3,
      'stroke-linecap': 'round', style: vars({ ph: 0.8 + i * 1.1 }),
    }));
  return [
    sky(ctx, '#24100f', '#4d1d1a'),
    el('ellipse', { cx: 160, cy: 92, rx: 120, ry: 60, fill: ctx.glow('#ff9a4d', 0.35) }),
    el('rect', { x: -10, y: 124, width: W + 20, height: 40, fill: ctx.linear('#6b3a22', '#4a2616') }),
    steam,
    enter('sc-rise', 0.1,
      el('path', { d: 'M184 90c16 0 16 26 0 26', fill: 'none', stroke: '#a3212b', 'stroke-width': 6 }),
      el('path', { d: 'M136 78h48l-4 46q-1 4-5 4h-30q-4 0-5-4z', fill: '#c4252f' }),
      el('ellipse', { cx: 160, cy: 78, rx: 24, ry: 4.5, fill: '#5a0f1a' }),
      el('path', { d: 'M136 78h48', stroke: '#e0505a', 'stroke-width': 1.5 }),
      el('polygon', { points: starPoints(160, 102, 8, 3.4), fill: '#fff6ec' }),
      el('circle', { cx: 216, cy: 120, r: 9, fill: '#f28c28' }),
      el('circle', { cx: 216, cy: 120, r: 6.5, fill: '#ffc46b' }),
      el('path', { d: 'M216 113.5v13M209.5 120h13M211.4 115.4l9.2 9.2M220.6 115.4l-9.2 9.2', stroke: '#f28c28', 'stroke-width': 0.7 }),
      el('rect', { x: 94, y: 120, width: 30, height: 5, rx: 2.5, fill: '#8a4b25', transform: 'rotate(-8 109 122)' }),
      el('polygon', { points: starPoints(112, 112, 6, 2.2, 8), fill: '#6b3a22' })),
  ];
}

// --- Solstice: the sun sets, stars come out and windows light up ---

function solstice(ctx) {
  const houses = [[54, 106], [92, 112], [218, 108], [258, 104]].map(([x, y], i) => g({},
    el('rect', { x: x - 12, y, width: 24, height: 132 - y, fill: '#141022' }),
    el('polygon', { points: `${x - 15},${y + 1} ${x},${y - 12} ${x + 15},${y + 1}`, fill: '#141022' }),
    enter('sc-fade', 1.9 + i * 0.25,
      el('rect', { x: x - 7, y: y + 6, width: 6, height: 6, fill: '#ffd27a' }),
      el('rect', { x: x + 2, y: y + 6, width: 6, height: 6, fill: '#ffd27a' }),
      el('circle', { class: 'sc-breathe', cx: x, cy: y + 9, r: 14, fill: ctx.glow('#ffd27a', 0.45) }))));
  return [
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear('#f6b26b', '#e2554a', '#7a2d55') }),
    el('circle', { class: 'sc-sunset', cx: 160, cy: 150, r: 24, fill: '#ffd36b' }),
    el('rect', { class: 'sc-dusk', x: -10, y: -10, width: W + 20, height: H + 20, fill: ctx.linear('#060b22', '#1d2a5a') }),
    starField(ctx, 22, { bottom: 95, from: 1.6, to: 2.6 }),
    el('path', { d: 'M-10 120C50 108 110 116 160 118S260 106 330 116V160H-10z', fill: '#1d1830' }),
    houses,
    snowGround(ctx, 140),
  ];
}

// --- Countdown: two stars blinking (two days left) ---

function countdown(ctx) {
  const bigStar = (x, delay, phase) => g({ transform: `translate(${x} 70)` },
    enter('sc-pop', delay,
      g({ class: 'sc-blink-star', style: vars({ ph: phase }) },
        el('circle', { r: 34, fill: ctx.glow('#ffe08a', 0.6) }),
        el('polygon', { points: starPoints(0, 0, 24, 10), fill: '#ffd34d', stroke: '#c9971f', 'stroke-width': 1 }),
        el('polygon', { points: starPoints(0, 0, 12, 5), fill: '#fff1b0', opacity: 0.6 }))));
  return [
    sky(ctx, '#0a1430', '#2a3f73'),
    starField(ctx, 18, { bottom: 140 }),
    bigStar(116, 0.3, 0),
    bigStar(204, 0.8, -1.2),
  ];
}

// --- Bingo: numbered balls bouncing ---

function bingo(ctx) {
  const numbers = new Set();
  while (numbers.size < 7) numbers.add(1 + Math.floor(ctx.rand() * 75));
  const colors = ['#e63946', '#2f7fd1', '#ffd166', '#2a9d8f', '#f15bb5', '#ff9f43', '#9b5de5'];
  const balls = [...numbers].map((n, i) => {
    const x = 40 + i * 40;
    return g({ transform: `translate(${x} 118)` },
      el('ellipse', { cx: 0, cy: 16, rx: 12, ry: 3, fill: '#000', opacity: 0.25 }),
      enter('sc-drop', 0.1 + i * 0.2,
        g({ class: 'sc-bounce', style: vars({ dur: ctx.between(1.2, 1.8), ph: -ctx.between(0, 1.8), h: `${round(ctx.between(10, 26))}px` }) },
          el('circle', { r: 15, fill: colors[i] }),
          el('circle', { r: 9, fill: '#fff' }),
          el('text', { y: 3.6, 'font-size': 10, 'font-weight': 700, 'font-family': 'system-ui, sans-serif', 'text-anchor': 'middle', fill: '#142443' }, String(n)),
          el('ellipse', { cx: -6, cy: -8, rx: 4, ry: 2, fill: '#fff', opacity: 0.5 }))));
  });
  return [
    sky(ctx, '#0f2b1f', '#1d4d35'),
    el('ellipse', { cx: 160, cy: 70, rx: 150, ry: 70, fill: ctx.glow('#ffd166', 0.2) }),
    starField(ctx, 10, { bottom: 70 }),
    el('rect', { x: -10, y: 134, width: W + 20, height: 30, fill: '#0b1f16' }),
    balls,
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
  tree: { label: 'Granen växer och tänds', draw: tree },
  camera: { label: 'Kamerablixt och polaroid', draw: camera },
  letter: { label: 'Brev med vaxsigill', draw: letter },
  candy: { label: 'Fallande godis', draw: candy },
  paint: { label: 'Färgklickar som blir en ren', draw: paint },
  party: { label: 'Konfetti och bubblor', draw: party },
  cozy: { label: 'Ljus och hjärtan', draw: cozy },
  gold: { label: 'Guldstoft', draw: gold },
  snow: { label: 'Snöfall', draw: snow },
  stars: { label: 'Stjärnhimmel', draw: stars },
  lanterns: { label: 'Svävande lyktor', draw: lanterns },
  flashlight: { label: 'Ficklampa i mörkret', draw: flashlight },
  mystery: { label: 'Flytande frågetecken', draw: mystery },
  movie: { label: 'Filmflimmer och stjärnor', draw: movie },
  glogg: { label: 'Rykande glöggmugg', draw: glogg },
  solstice: { label: 'Vintersolstånd', draw: solstice },
  countdown: { label: 'Två stjärnor kvar', draw: countdown },
  bingo: { label: 'Bingokulor', draw: bingo },
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

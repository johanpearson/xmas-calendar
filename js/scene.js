// Background decoration: the garland of lights across the top and the falling snow.
// Purely visual: everything lives inside the aria-hidden .scene and ignores pointer events.
// Stars, trees and the snowy ground are plain CSS (see style.css).

const SVG_NS = 'http://www.w3.org/2000/svg';
const BULB_COLORS = ['#ff5a5f', '#ffd166', '#5fd38d', '#ffffff', '#ff9f43'];
const SEGMENT_PX = 110; // approximate distance between garland hooks
const SAG_PX = 16;

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

// --- Garland ---

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// Point on a quadratic Bézier curve.
function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function renderGarland(container) {
  const width = Math.round(document.documentElement.clientWidth);
  if (!width || Number(container.dataset.width) === width) return;
  container.dataset.width = String(width);

  const segments = Math.max(2, Math.round(width / SEGMENT_PX));
  const seg = width / segments;
  const top = 6;
  const height = top + SAG_PX + 22;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, focusable: 'false' });
  const defs = svgEl('defs', {});
  BULB_COLORS.forEach((color, i) => {
    const grad = svgEl('radialGradient', { id: `bulb-glow-${i}` });
    grad.append(
      svgEl('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '.85' }),
      svgEl('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }),
    );
    defs.append(grad);
  });
  svg.append(defs);

  let d = `M0 ${top}`;
  for (let i = 0; i < segments; i++) {
    d += ` Q${(i + 0.5) * seg} ${top + SAG_PX * 2} ${(i + 1) * seg} ${top}`;
  }
  svg.append(svgEl('path', { d, class: 'garland-wire' }));

  let n = 0;
  for (let i = 0; i < segments; i++) {
    for (const t of [0.22, 0.5, 0.78]) {
      const x = quad(i * seg, (i + 0.5) * seg, (i + 1) * seg, t);
      const y = quad(top, top + SAG_PX * 2, top, t);
      const colorIndex = n % BULB_COLORS.length;
      // A slight, deterministic tilt so the bulbs don't hang like soldiers.
      const tilt = ((n * 37) % 21) - 10;
      const bulb = svgEl('g', {
        class: 'bulb',
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt})`,
        style: `--d:${((n * 0.73) % 2.6).toFixed(2)}s`,
      });
      bulb.append(
        svgEl('circle', { class: 'bulb-glow', cx: 0, cy: 9, r: 10, fill: `url(#bulb-glow-${colorIndex})` }),
        svgEl('rect', { class: 'bulb-cap', x: -2, y: 0, width: 4, height: 4, rx: 1 }),
        svgEl('ellipse', { cx: 0, cy: 9, rx: 3.6, ry: 5.6, fill: BULB_COLORS[colorIndex] }),
      );
      svg.append(bulb);
      n++;
    }
  }
  container.replaceChildren(svg);
}

// --- Snow ---

function createSnow(scene) {
  const canvas = document.createElement('canvas');
  canvas.className = 'snow-canvas';
  const ctx = canvas.getContext('2d');
  let flakes = [];
  let raf = 0;
  let last = 0;
  let width = 0;
  let height = 0;

  function makeFlake(y) {
    const r = 0.8 + Math.random() * 2;
    return {
      x: Math.random() * width,
      y: y ?? Math.random() * height,
      r,
      vy: 14 + r * 14, // bigger flakes are closer and fall faster
      sway: 6 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
      alpha: 0.35 + Math.random() * 0.5,
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // About one flake per 7000 px², capped so slow phones stay smooth.
    const count = Math.min(110, Math.round((width * height) / 7000));
    while (flakes.length < count) flakes.push(makeFlake());
    flakes.length = count;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    for (const f of flakes) {
      f.y += f.vy * dt;
      f.phase += f.speed * dt;
      if (f.y - f.r > height) Object.assign(f, makeFlake(-f.r * 2));
      const x = f.x + Math.sin(f.phase) * f.sway;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  const shouldRun = () => document.visibilityState === 'visible' && !reducedMotionQuery.matches;

  function update() {
    if (shouldRun()) {
      if (!canvas.isConnected) {
        scene.append(canvas);
        resize();
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      // With reduced motion there is no snow at all, not even frozen flakes.
      if (reducedMotionQuery.matches) canvas.remove();
    }
  }

  window.addEventListener('resize', () => canvas.isConnected && resize());
  document.addEventListener('visibilitychange', update);
  reducedMotionQuery.addEventListener?.('change', update);
  update();
}

export function mountScene() {
  const scene = document.querySelector('.scene');
  const garland = document.getElementById('garland');
  if (!scene || !garland) return;
  renderGarland(garland);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderGarland(garland), 150);
  });
  createSnow(scene);
}

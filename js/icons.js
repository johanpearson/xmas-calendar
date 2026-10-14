// Small inline SVG icons. The markup is constant and authored here (never content from
// days.json), so building it from a string is safe.

const ICONS = {
  // --- Theme icons ---
  bauble: `
    <circle cx="16" cy="4.5" r="2.2" fill="none" stroke="#f3d48a" stroke-width="1.6"/>
    <rect x="12.5" y="6" width="7" height="4" rx="1" fill="#e8c36a"/>
    <circle cx="16" cy="19" r="10" fill="#d7263d"/>
    <path d="M6.6 16.5q4.7 3 9.4 0t9.4 0" fill="none" stroke="#f3d48a" stroke-width="1.6"/>
    <path d="M6.6 21.5q4.7 3 9.4 0t9.4 0" fill="none" stroke="#f3d48a" stroke-width="1.6"/>
    <ellipse cx="11.5" cy="13.5" rx="2.4" ry="1.4" fill="#fff" opacity=".6" transform="rotate(-35 11.5 13.5)"/>`,
  star: `
    <path d="M16 2.5l3.9 8.3 9 1.1-6.6 6.2 1.7 9-8-4.4-8 4.4 1.7-9-6.6-6.2 9-1.1z"
      fill="#c4252f" stroke="#fff6dc" stroke-width="1.4" stroke-linejoin="round"/>`,
  gingerbread: `
    <path d="M16 3.5a4.6 4.6 0 0 1 2.6 8.4h5.9a2.6 2.6 0 0 1 0 5.2h-4.2l3.6 8.4a2.7 2.7 0 0 1-5 2.1L16 22.8l-2.9 4.8a2.7 2.7 0 0 1-5-2.1l3.6-8.4H7.5a2.6 2.6 0 0 1 0-5.2h5.9A4.6 4.6 0 0 1 16 3.5z"
      fill="#d9944f" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="14.4" cy="7.4" r=".9" fill="#3b2208"/><circle cx="17.6" cy="7.4" r=".9" fill="#3b2208"/>
    <path d="M14.3 9.6q1.7 1.3 3.4 0" fill="none" stroke="#3b2208" stroke-width=".9" stroke-linecap="round"/>
    <circle cx="16" cy="14.6" r="1" fill="#d7263d"/><circle cx="16" cy="18" r="1" fill="#2f8f55"/>`,
  stocking: `
    <path d="M11 9h11v9.5c0 1.6.6 2.6 1.6 3.6l.6.6a4.2 4.2 0 0 1-5.8 6.1l-5.6-5.3A5.4 5.4 0 0 1 11 19.6z"
      fill="#1f7a49" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M18.4 28.8l-1.7-1.6 4.4-4.6 1.9 1.5c1.2 1.5.9 3.5-.6 4.6-1.2.8-2.8.8-4-.1z" fill="#d7263d"/>
    <rect x="9.5" y="3.5" width="14" height="6.5" rx="2" fill="#fff"/>`,
  gift: `
    <rect x="5" y="13" width="22" height="15" rx="1.5" fill="#e8c36a"/>
    <rect x="4" y="9.5" width="24" height="5.5" rx="1.5" fill="#f3d48a"/>
    <rect x="14" y="9.5" width="4" height="18.5" fill="#1f7a49"/>
    <path d="M16 9.5c-2-4.5-7.5-5.5-7.5-2.4 0 2.2 4 2.4 7.5 2.4zm0 0c2-4.5 7.5-5.5 7.5-2.4 0 2.2-4 2.4-7.5 2.4z"
      fill="none" stroke="#1f7a49" stroke-width="2" stroke-linejoin="round"/>`,
  heart: `
    <path d="M16 27.5S4 20.4 4 12.2A6.3 6.3 0 0 1 16 9.4a6.3 6.3 0 0 1 12 2.8c0 8.2-12 15.3-12 15.3z"
      fill="#fff6ec" stroke="#14532d" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M16 23c-1.4-1-6.5-4.6-6.5-9a2.8 2.8 0 0 1 5.3-1.2" fill="none" stroke="#d7263d" stroke-width="1.4" stroke-linecap="round"/>`,
  bun: `
    <circle cx="16" cy="17" r="11" fill="#c98a4b"/>
    <path d="M16 17.2c1.2-.2 1.6 1.6.2 2.2-2.2.9-4-1.3-3.2-3.5 1.2-3.2 5.6-3.2 7.3-.4 2 3.2-.4 7.6-4.6 7.8-4.6.3-7.7-4.4-6.1-8.6 1.9-4.8 8.2-6.2 12-2.8"
      fill="none" stroke="#7a4314" stroke-width="1.7" stroke-linecap="round"/>
    <g fill="#fff"><rect x="9" y="10" width="2" height="2" rx=".5"/><rect x="20" y="9" width="2" height="2" rx=".5"/><rect x="22" y="19" width="2" height="2" rx=".5"/><rect x="12" y="23" width="2" height="2" rx=".5"/><rect x="17" y="13" width="1.6" height="1.6" rx=".4"/></g>`,

  // --- Content type icons (opened doors and the card) ---
  ledtrad: `
    <circle cx="13.5" cy="13.5" r="8" fill="#dff1ff" stroke="#1d3b6b" stroke-width="2.6"/>
    <path d="M19.5 19.5l7.5 7.5" stroke="#8a4f23" stroke-width="4" stroke-linecap="round"/>
    <path d="M10 11.5a4 4 0 0 1 3.5-2.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  litet: `
    <rect x="5" y="13" width="22" height="15" rx="1.5" fill="#d7263d"/>
    <rect x="4" y="9.5" width="24" height="5.5" rx="1.5" fill="#e33a4f"/>
    <rect x="14" y="9.5" width="4" height="18.5" fill="#e8c36a"/>
    <path d="M16 9.5c-2-4.5-7.5-5.5-7.5-2.4 0 2.2 4 2.4 7.5 2.4zm0 0c2-4.5 7.5-5.5 7.5-2.4 0 2.2-4 2.4-7.5 2.4z"
      fill="none" stroke="#c9961f" stroke-width="2" stroke-linejoin="round"/>`,
  uppdrag: `
    <path d="M16 4.5a2 2 0 0 1 2 2v.7a8 8 0 0 1 6 7.8v5.5l2.5 3.5h-21L8 20.5V15a8 8 0 0 1 6-7.8v-.7a2 2 0 0 1 2-2z"
      fill="#e8b93c" stroke="#8a5a00" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="16" cy="26.5" r="2.6" fill="#8a5a00"/>
    <path d="M27 9q2 3 0 6M5 9q-2 3 0 6" fill="none" stroke="#d7263d" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="9" y="22" width="14" height="2" rx="1" fill="#d7263d"/>`,
  rim: `
    <path d="M8 6h15a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#fbf0d6" stroke="#8a4f23" stroke-width="1.4"/>
    <path d="M8 6a3 3 0 0 0-3 3v2h3M11 28a3 3 0 0 0 3-3v-1H8" fill="#e6cf9e" stroke="#8a4f23" stroke-width="1.4"/>
    <path d="M12 11.5h10M12 15h10M12 18.5h7" stroke="#8a4f23" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M24 16.5l-6 6-1 2.5 2.5-1 6-6c.6-.6.6-1.4 0-2-.6-.4-1-.4-1.5.5z" fill="#d7263d"/>`,
  // A treasure hunt: a gold-rimmed magnifier with a sparkle in the lens.
  jakt: `
    <path d="M20 20l7.5 7.5" stroke="#5b2d0e" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M20 20l7.5 7.5" stroke="#b8642a" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="13.5" cy="13.5" r="9" fill="#14532d"/>
    <circle cx="13.5" cy="13.5" r="9" fill="none" stroke="#e8b93c" stroke-width="2.8"/>
    <path d="M13.5 8.2l1.4 3.9 3.9 1.4-3.9 1.4-1.4 3.9-1.4-3.9-3.9-1.4 3.9-1.4z" fill="#ffe08a"/>
    <circle cx="9.6" cy="9.6" r="1.2" fill="#fff" opacity=".8"/>`,
  unknown: `
    <path d="M16 3l2.6 9.4L28 15l-9.4 2.6L16 27l-2.6-9.4L4 15l9.4-2.6z" fill="#e8c36a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>`,

  // --- UI ---
  lock: `
    <path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" stroke="currentColor" stroke-width="3"/>
    <rect x="7" y="13.5" width="18" height="14" rx="3" fill="currentColor"/>
    <circle cx="16" cy="19.5" r="2" fill="#0b1a33"/><rect x="15" y="20" width="2" height="4" rx="1" fill="#0b1a33"/>`,
  speaker: `
    <path d="M4.5 12.5h5l7-6v19l-7-6h-5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M20.5 12a5.5 5.5 0 0 1 0 8M24 8.5a10.5 10.5 0 0 1 0 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  speakerOff: `
    <path d="M4.5 12.5h5l7-6v19l-7-6h-5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M20.5 12.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  note: `
    <path d="M12 23V8.5l13-3V20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="8.5" cy="23" rx="4" ry="3.2" fill="currentColor"/>
    <ellipse cx="21.5" cy="20" rx="4" ry="3.2" fill="currentColor"/>`,
  bow: `
    <path d="M16 15c-4-7-13-9-13-3.5 0 4.5 7.5 4.5 13 3.5zm0 0c4-7 13-9 13-3.5 0 4.5-7.5 4.5-13 3.5z"
      fill="#f3d48a" stroke="#a87a17" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M14 16l-4 9 3-1 2 2.5 1-9.5m2-1l4 9-3-1-2 2.5-1-9.5" fill="#e8c36a" stroke="#a87a17" stroke-width="1.2" stroke-linejoin="round"/>
    <ellipse cx="16" cy="15" rx="3" ry="2.6" fill="#e8c36a" stroke="#a87a17" stroke-width="1.4"/>`,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// Returns a new decorative <svg> element (aria-hidden) for the named icon.
export function icon(name, className = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = ICONS[name] ?? ICONS.unknown;
  return svg;
}

const CONTENT_TYPES = new Set(['ledtrad', 'litet', 'uppdrag', 'rim', 'jakt']);

// Content type icon, falling back to a sparkle for unknown types.
export function typeIcon(type, className) {
  return icon(CONTENT_TYPES.has(type) ? type : 'unknown', className);
}

let candlesCount = 0;

// Four advent candles in a holder, the first `lit` of them burning (lit from the left).
export function adventCandles(lit, className = '') {
  const glowId = `candle-glow-${++candlesCount}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 36');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  let markup = '';
  [9, 25, 41, 57].forEach((x, i) => {
    const on = i < lit;
    if (on) {
      markup += `
        <circle class="candle-glow" cx="${x}" cy="9" r="7" fill="url(#${glowId})" style="--i:${i}"/>
        <path class="candle-flame" style="--i:${i}" d="M${x} 2.5c2.6 3.4 3.4 5.4 3.4 7a3.4 3.4 0 0 1-6.8 0c0-1.6.8-3.6 3.4-7z" fill="#ffc94a"/>
        <path class="candle-flame" style="--i:${i}" d="M${x} 6.5c1.2 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-.8.4-1.8 1.6-3.4z" fill="#fff6d6"/>`;
    }
    markup += `
      <rect x="${x - 4}" y="14" width="8" height="15" rx="1.5" fill="#fbf5e9"/>
      <rect x="${x - 4}" y="14" width="2.5" height="15" rx="1" fill="#fff" opacity=".7"/>
      <path d="M${x} ${on ? 13.4 : 11.5}v2.6" stroke="#3b2a1a" stroke-width="1.2" stroke-linecap="round"/>`;
  });
  svg.innerHTML = `
    <defs><radialGradient id="${glowId}"><stop offset="0" stop-color="#ffd76a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs>
    ${markup}
    <rect x="1" y="28" width="62" height="6" rx="3" fill="#e8c36a"/>
    <rect x="1" y="28" width="62" height="2" rx="1" fill="#fff3c4" opacity=".6"/>
    <g fill="#2f8f55"><ellipse cx="17" cy="29" rx="4" ry="1.8" transform="rotate(-20 17 29)"/><ellipse cx="33" cy="29.5" rx="4" ry="1.8" transform="rotate(15 33 29.5)"/><ellipse cx="49" cy="29" rx="4" ry="1.8" transform="rotate(-15 49 29)"/></g>
    <g fill="#d7263d"><circle cx="20" cy="30.5" r="1.3"/><circle cx="36" cy="31" r="1.3"/><circle cx="52" cy="30.5" r="1.3"/></g>`;
  return svg;
}

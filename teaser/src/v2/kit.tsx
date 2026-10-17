import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import '../fonts';
import { serif, titleFont } from '../fonts';
import { Glint, clamp01, mulberry } from '../fx';
import { FPS } from '../timing';

export type Line = {
  a: number; b: number; text: string; top: number; size: number;
  font?: 'title'; gold?: boolean; variant?: 'caps';
};
export type HintCue = { kind: string; a: number; dur: number };

export const useT = () => useCurrentFrame() / FPS;
const E = (t: number, a: number, b: number, fi: number, fo: number) =>
  clamp01(Math.min((t - a) / fi, (b - t) / fo));

// ---------------------------------------------------------------- segments
/** A scene on [a,b] seconds. With fade>0 it cross-fades in over the `fade` seconds before a. */
export const Seg: React.FC<{ a: number; b: number; fade?: number; children: (t: number, p: number) => React.ReactNode }> = ({ a, b, fade = 0, children }) => {
  const from = Math.max(0, Math.round((a - fade) * FPS));
  const to = Math.round(b * FPS);
  return (
    <Sequence from={from} durationInFrames={Math.max(1, to - from)} layout="none">
      <SegInner a={a} b={b} fade={fade} from={from}>{children}</SegInner>
    </Sequence>
  );
};
const SegInner: React.FC<{ a: number; b: number; fade: number; from: number; children: (t: number, p: number) => React.ReactNode }> = ({ a, b, fade, from, children }) => {
  const g = (useCurrentFrame() + from) / FPS;
  const o = fade > 0 ? clamp01((g - (a - fade)) / fade) : 1;
  return <AbsoluteFill style={{ opacity: o }}>{children(g - a, clamp01((g - a) / (b - a)))}</AbsoluteFill>;
};

// ---------------------------------------------------------------- text
const gold: React.CSSProperties = {
  backgroundImage: 'linear-gradient(105deg, #b98a3a 0%, #f5d57a 28%, #fff7d2 40%, #e3b04a 58%, #b98a3a 100%)',
  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
};
/** Text line; stays inside the safe area (>=150 px at the sides). */
export const TextLine: React.FC<{ l: Line; slam?: boolean }> = ({ l, slam }) => {
  const t = useT();
  if (t < l.a - 0.01 || t > l.b + 0.01) return null;
  const caps = l.variant === 'caps';
  const o = slam ? E(t, l.a, l.b, 0.06, 0.25) : E(t, l.a, l.b, 0.55, 0.45);
  const k = slam ? 1 + 0.09 * Math.max(0, 1 - (t - l.a) / 0.2) : 1;
  const base: React.CSSProperties = l.font === 'title'
    ? { fontFamily: titleFont, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap' }
    : caps
      ? { fontFamily: serif, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.035em', lineHeight: 1.2 }
      : { fontFamily: serif, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.18 };
  return (
    <div
      style={{
        position: 'absolute', left: 150, right: 150, top: l.top, textAlign: 'center', fontSize: l.size,
        color: '#fbe8c4', opacity: o, transform: `scale(${k}) translateY(${slam ? 0 : (1 - o) * 14}px)`,
        filter: slam ? undefined : `blur(${(1 - o) * 6}px)`,
        textShadow: l.gold ? undefined : '0 0 26px rgba(0,0,0,0.7), 0 2px 10px rgba(0,0,0,0.85), 0 0 8px rgba(255,190,100,0.35)',
        ...base,
        ...(l.gold ? { ...gold, filter: `drop-shadow(0 0 18px rgba(255,190,80,0.5))${slam ? '' : ` blur(${(1 - o) * 6}px)`}` } : {}),
      }}
    >
      {l.text}
    </div>
  );
};

// ---------------------------------------------------------------- hints (blurred, silhouette jokes)
const INK = '#0c1020';
const Icon: React.FC<{ kind: string; p: number }> = ({ kind, p }) => {
  switch (kind) {
    case 'magnifier': {
      const x = -190 + 380 * p, y = 40 - 80 * p;
      return (
        <g transform={`translate(${x} ${y}) rotate(-35)`}>
          <circle r={86} fill="rgba(255,240,190,0.4)" /><circle r={86} fill="none" stroke={INK} strokeWidth={20} />
          <rect x={-12} y={86} width={24} height={150} rx={10} fill={INK} />
          <path d="M-50 -40 A 66 66 0 0 1 -8 -66" stroke="#fff" strokeWidth={9} strokeLinecap="round" fill="none" />
        </g>
      );
    }
    case 'cup':
      return (
        <g>
          <rect x={-90} y={-10} width={180} height={150} rx={26} fill={INK} />
          <path d="M90 25 q 66 0 66 45 q 0 45 -66 45" fill="none" stroke={INK} strokeWidth={22} />
          {[0, 1, 2].map((i) => {
            const k = (p * 1.6 + i / 3) % 1;
            return <path key={i} d={`M${-45 + i * 45} ${-30 - k * 50} q 20 -34 0 -68 q -20 -34 0 -68`} stroke="#fff6e0" strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.85 * Math.sin(k * Math.PI)} />;
          })}
        </g>
      );
    case 'cookie':
      return (
        <g transform={`rotate(${Math.sin(p * 9) * 6})`}>
          <path d="M0 -150 a52 52 0 1 1 0.1 0 Z M-40 -90 L-130 -80 Q-150 -60 -120 -40 L-60 -50 L-70 40 L-100 150 Q-95 170 -60 160 L0 70 L60 160 Q95 170 100 150 L70 40 L60 -50 L120 -40 Q150 -60 130 -80 L40 -90Z" fill="#9a5a2a" />
          <circle cx={-18} cy={-160} r={7} fill="#fff" /><circle cx={18} cy={-160} r={7} fill="#fff" />
          <path d="M-26 -138 Q0 -112 26 -138" stroke="#fff" strokeWidth={8} strokeLinecap="round" fill="none" />
          <circle cx={0} cy={-30} r={9} fill="#fff" /><circle cx={0} cy={10} r={9} fill="#fff" />
        </g>
      );
    case 'polaroid': {
      const flash = Math.max(0, 1 - p / 0.35);
      return (
        <g>
          <g transform="translate(-80 40)">
            <rect x={-95} y={-70} width={190} height={140} rx={22} fill={INK} />
            <circle cx={0} cy={0} r={46} fill="#1d2744" stroke="#7d8cb6" strokeWidth={6} />
            <rect x={50} y={-100} width={52} height={36} rx={8} fill={INK} />
          </g>
          <g transform="translate(95 -20) rotate(6)" opacity={clamp01((p - 0.2) * 3)}>
            <rect x={-70} y={-85} width={140} height={170} rx={6} fill="#f7f1e4" />
            <rect x={-56} y={-72} width={112} height={112} fill="#d8d2c4" />
          </g>
          <circle cx={0} cy={-20} r={30 + 220 * (1 - flash)} fill="#fff" opacity={flash} />
        </g>
      );
    }
    case 'box': {
      const lift = Math.min(1, p * 2.4) * 32;
      return (
        <g>
          <polygon points={`-90,${-lift + 10} 90,${-lift + 10} 150,-170 -150,-170`} fill="#ffe7a0" opacity={0.8 * Math.min(1, p * 3)} />
          <rect x={-100} y={10} width={200} height={140} fill={INK} /><rect x={-14} y={10} width={28} height={140} fill="#7d3a44" />
          <g transform={`translate(0 ${-lift}) rotate(${-lift * 0.15})`}>
            <rect x={-114} y={-34} width={228} height={46} rx={6} fill={INK} /><rect x={-14} y={-34} width={28} height={46} fill="#7d3a44" />
            <path d="M0 -34 C -60 -100 -80 -48 0 -34 C 80 -100 60 -48 0 -34Z" fill="#7d3a44" />
          </g>
        </g>
      );
    }
    case 'footprints': {
      const n = 7;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const k = i / (n - 1);
            const show = clamp01((p * 1.15 - k * 0.8) * 5);
            const x = -140 + k * 250 + (i % 2 ? 22 : -22), y = 190 - k * 300;
            return <ellipse key={i} cx={x} cy={y} rx={17} ry={28} transform={`rotate(${28} ${x} ${y})`} fill="#5b6a98" opacity={show} />;
          })}
          <g transform="translate(150 -150)" opacity={clamp01(p * 2.5 - 0.7)}>
            <circle r={90} fill="rgba(255,200,100,0.55)" />
            <rect x={-22} y={-34} width={44} height={64} rx={8} fill={INK} /><rect x={-14} y={-24} width={28} height={44} fill="#ffcf70" />
            <path d="M-16 -34 a16 14 0 0 1 32 0" stroke={INK} strokeWidth={6} fill="none" />
          </g>
        </g>
      );
    }
    case 'cat':
      return (
        <g transform={`rotate(${Math.sin(p * 14) * 16} 210 130)`}>
          <path d="M210 130 C 90 110 60 20 120 -50 C 160 -100 90 -150 40 -120" fill="none" stroke={INK} strokeWidth={44} strokeLinecap="round" />
        </g>
      );
    case 'question': {
      const sc = 0.9 + 0.2 * Math.sin(p * Math.PI);
      return (
        <g>
          <text x={0} y={95} textAnchor="middle" fontFamily={titleFont} fontWeight={700} fontSize={300} fill="#fff1b5" transform={`scale(${sc})`}>?</text>
          <path d="M0 -150 L12 -12 L150 0 L12 12 L0 150 L-12 12 L-150 0 L-12 -12Z" fill="#fff" opacity={Math.max(0, Math.sin(p * Math.PI * 2)) * 0.8} transform="translate(80 -90) scale(0.5)" />
        </g>
      );
    }
    case 'candle': {
      const L = clamp01((p - 0.25) * 3);
      return (
        <g>
          <circle cy={-90} r={150 * L} fill="rgba(255,190,90,0.6)" />
          <rect x={-34} y={-60} width={68} height={230} rx={8} fill="#f3e6c8" />
          <rect x={-3} y={-76} width={6} height={20} fill={INK} />
          <g transform={`translate(0 -76) scale(${L} ${L * (1 + 0.1 * Math.sin(p * 40))})`}>
            <path d="M0 0 C 30 -36 24 -80 0 -128 C -24 -80 -30 -36 0 0Z" fill="#ffab3a" /><path d="M0 -4 C 12 -20 10 -44 0 -66 C -10 -44 -12 -20 0 -4Z" fill="#fff6d0" />
          </g>
        </g>
      );
    }
    default:
      return null;
  }
};

/** A hint appears as a soft, out-of-focus silhouette on a glowing disc, `dur` (<= 1.5) seconds. */
export const Hint: React.FC<{ h: HintCue }> = ({ h }) => {
  const t = useT();
  const p = (t - h.a) / h.dur;
  if (p < 0 || p > 1) return null;
  const o = Math.min(p / 0.2, (1 - p) / 0.2, 1);
  const size = 520;
  const edge = h.kind === 'cat';
  const x = edge ? 1080 - 300 : 540, y = edge ? 1560 : h.kind === 'candle' ? 1500 : h.kind === 'question' ? 1400 : 1040;
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: o, filter: 'blur(6px)' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle closest-side, rgba(255,232,170,0.92) 0%, rgba(255,196,100,0.7) 45%, rgba(255,150,60,0.25) 75%, rgba(255,140,50,0) 100%)' }} />
      <svg width={size} height={size} viewBox="-200 -200 400 400" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <Icon kind={h.kind} p={p} />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- art
const stars = (() => { const r = mulberry(5); return Array.from({ length: 70 }, () => ({ x: r() * 1080, y: r() * 900, s: 1 + r() * 2.2, ph: r() * 6 })); })();
const Sky: React.FC<{ t: number; dusk?: number }> = ({ t, dusk = 1 }) => (
  <>
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#141c48" /><stop offset="0.45" stopColor={dusk ? '#4b3d7a' : '#1a2556'} /><stop offset="0.7" stopColor={dusk ? '#d98a68' : '#2a3a78'} />
      </linearGradient>
    </defs>
    <rect width={1080} height={1920} fill="url(#sky)" />
    {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={0.3 + 0.3 * Math.sin(t * 2 + s.ph)} />)}
    <circle cx={840} cy={430} r={150} fill="#cfdcff" opacity={0.12} /><circle cx={840} cy={430} r={46} fill="#eef3ff" opacity={0.85} />
  </>
);

const houseData = (() => {
  const r = mulberry(11); const out: { x: number; w: number; h: number; roof: number; wins: { x: number; y: number; on: number }[] }[] = [];
  let x = -40;
  while (x < 1120) {
    const w = 170 + r() * 120, h = 160 + r() * 170;
    const wins = Array.from({ length: 2 + Math.floor(r() * 3) }, (_, i) => ({ x: 28 + i * 52 + r() * 8, y: 40 + r() * (h - 110), on: 0.6 + r() * 5 }));
    out.push({ x, w, h, roof: 70 + r() * 50, wins });
    x += w + 8 + r() * 24;
  }
  return out;
})();

/** Small town at dusk; windows light up one by one. */
export const TownArt: React.FC<{ t: number; p: number; zoom?: number }> = ({ t, p, zoom = 0.4 }) => {
  const sc = 1 + zoom * p;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ transform: `scale(${sc}) translateY(${-p * 60}px)`, transformOrigin: '540px 1300px' }}>
        <Sky t={t} />
        <path d="M0 1130 Q 300 1040 560 1120 T 1080 1090 V1920 H0Z" fill="#3a3f78" />
        {houseData.map((h, i) => {
          const base = 1330;
          return (
            <g key={i} transform={`translate(${h.x} ${base - h.h})`}>
              <rect width={h.w} height={h.h} fill="#0b1030" />
              <polygon points={`-14,2 ${h.w / 2},${-h.roof} ${h.w + 14},2`} fill="#0a0e28" />
              <path d={`M-18 4 L${h.w / 2} ${-h.roof - 4} L${h.w + 18} 4`} stroke="#e6edff" strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.92} />
              {h.wins.map((w, j) => {
                const on = clamp01((t - w.on) * 1.5);
                return <g key={j}><circle cx={w.x + 17} cy={w.y + 22} r={46} fill="#ffb454" opacity={0.25 * on} /><rect x={w.x} y={w.y} width={34} height={44} fill={on > 0.2 ? '#ffc766' : '#161c40'} opacity={0.5 + 0.5 * on} /></g>;
              })}
            </g>
          );
        })}
        {/* church */}
        <g transform="translate(790 880)">
          <rect x={-46} y={0} width={92} height={460} fill="#090d28" /><polygon points="-62,0 0,-190 62,0" fill="#090d28" />
          <path d="M-64 4 L0 -194 L64 4" stroke="#e6edff" strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.9} />
          <rect x={-12} y={90} width={24} height={50} fill="#ffc766" opacity={clamp01((t - 1.5) * 2)} />
        </g>
        <path d="M0 1330 Q 300 1290 540 1325 T 1080 1310 V1920 H0Z" fill="#aab9e6" />
        <path d="M0 1450 Q 300 1400 560 1445 T 1080 1430 V1920 H0Z" fill="#7e8fc4" />
        <path d="M0 1620 Q 340 1560 700 1610 T 1080 1600 V1920 H0Z" fill="#4c5a96" />
        {[110, 960, 70].map((x, i) => (
          <g key={i} transform={`translate(${x} ${1420 + i * 110}) scale(${1.3 + i * 0.4})`}>
            <polygon points="0,-300 90,-150 50,-150 120,-30 60,-30 140,60 -140,60 -60,-30 -120,-30 -50,-150 -90,-150" fill="#070b22" />
            <path d="M-80 -135 Q0 -160 80 -135 M-100 -20 Q0 -50 100 -20" stroke="#dfe8ff" strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.7} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Workshop: a man seen from behind at a lamp-lit table with 24 tiny doors. */
export const WorkshopArt: React.FC<{ t: number; p: number; zoom?: number }> = ({ t, p, zoom = 0.3 }) => {
  const sc = 1 + zoom * p;
  const arm = Math.sin(t * 7) * 9;
  const doors = Array.from({ length: 24 }, (_, i) => ({ x: 160 + (i % 8) * 100, y: 1330 + Math.floor(i / 8) * 34, c: ['#8e1b2b', '#1f5a43', '#b3862f', '#234b78'][i % 4] }));
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ transform: `scale(${sc})`, transformOrigin: '540px 1150px' }}>
        <defs>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1814" /><stop offset="1" stopColor="#4a2c1e" /></linearGradient>
          <radialGradient id="lampG" cx="0.5" cy="0.35" r="0.65"><stop offset="0" stopColor="#ffd88a" stopOpacity="0.85" /><stop offset="1" stopColor="#ff9a3c" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width={1080} height={1920} fill="url(#wall)" />
        {/* window with night and snow */}
        <rect x={110} y={420} width={300} height={420} fill="#18224f" /><rect x={110} y={420} width={300} height={420} fill="none" stroke="#6e4a30" strokeWidth={18} />
        <rect x={252} y={420} width={16} height={420} fill="#6e4a30" /><rect x={110} y={622} width={300} height={16} fill="#6e4a30" />
        {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={130 + ((i * 53 + t * 24) % 260)} cy={440 + ((i * 97 + t * 60) % 380)} r={3 + (i % 3)} fill="#fff" opacity={0.7} />)}
        {/* string lights */}
        <path d="M0 330 Q 270 420 540 330 T 1080 340" fill="none" stroke="#2a1a14" strokeWidth={5} />
        {Array.from({ length: 16 }, (_, i) => { const x = 30 + i * 66; const y = 345 + Math.sin(i * Math.PI / 4) * 50 * 0 + (i % 4 === 0 ? 0 : 0) + 55 * Math.sin((x / 1080) * Math.PI * 2 - 1.6) * 0 + 40 * Math.abs(Math.sin((x / 270) * Math.PI / 2)); return <circle key={i} cx={x} cy={y} r={11} fill={['#ffb454', '#ff7a5a', '#ffe08a'][i % 3]} opacity={0.7 + 0.3 * Math.sin(t * 3 + i)} />; })}
        {/* lamp */}
        <line x1={640} y1={0} x2={640} y2={560} stroke="#1a1010" strokeWidth={6} />
        <path d="M560 560 Q 640 480 720 560Z" fill="#c9852e" />
        <ellipse cx={640} cy={980} rx={620} ry={760} fill="url(#lampG)" />
        {/* table */}
        <rect x={0} y={1290} width={1080} height={630} fill="#5b3a22" /><rect x={0} y={1290} width={1080} height={12} fill="#7d5233" />
        {doors.map((d, i) => <rect key={i} x={d.x} y={d.y} width={70} height={34} rx={4} fill={d.c} stroke="#e3b85a" strokeWidth={3} />)}
        {/* man, from behind */}
        <g>
          <path d="M270 1300 C 270 1090 380 1020 540 1020 C 700 1020 810 1090 810 1300Z" fill="#6e2a30" />
          <path d="M270 1300 C 270 1090 380 1020 540 1020" stroke="#9a4a50" strokeWidth={8} fill="none" opacity={0.7} />
          <rect x={496} y={960} width={90} height={80} fill="#d9a98a" />
          <circle cx={540} cy={900} r={96} fill="#d9a98a" />
          <path d="M444 900 C 440 800 530 790 540 790 C 640 790 650 850 636 910 C 620 870 580 850 540 850 C 500 850 460 870 444 900Z" fill="#3b2a22" />
          <g transform={`rotate(${arm} 740 1170)`}><path d="M740 1170 L 800 1290 L 770 1305 L 710 1190Z" fill="#6e2a30" /><rect x={786} y={1284} width={50} height={22} rx={8} fill="#d9a98a" /><rect x={820} y={1230} width={14} height={70} fill="#8b8f9a" transform="rotate(30 827 1265)" /></g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A snowy street at night; the camera glides towards the vanishing point. */
export const StreetArt: React.FC<{ t: number; p: number; zoom?: number }> = ({ t, p, zoom = 0.5 }) => {
  const sc = 1 + zoom * p;
  const side = (flip: boolean) => Array.from({ length: 5 }, (_, i) => {
    const k = 1 - i * 0.2;
    const w = 330 * k + 40, h = 380 * k + 60;
    const x = flip ? 1080 - 40 - w * 0.9 - i * 50 : 40 + i * 50;
    const y = 1170 + i * 30 - h + 120 * (1 - k);
    return { x, y, w, h, k, i, win: (i * 3 + (flip ? 1 : 0)) % 2 === 0 };
  });
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ transform: `scale(${sc})`, transformOrigin: '540px 1150px' }}>
        <Sky t={t} dusk={0} />
        <path d="M0 1240 L1080 1240 V1920 H0Z" fill="#aebde8" />
        <polygon points="440,1240 640,1240 1220,1920 -140,1920" fill="#7c8fc4" />
        {[false, true].flatMap((flip) => side(flip).reverse().map((h) => (
          <g key={`${flip}-${h.i}`} transform={`translate(${h.x} ${h.y})`}>
            <rect width={h.w * 0.9} height={h.h} fill="#0b1030" />
            <polygon points={`-14,2 ${h.w * 0.45},${-h.h * 0.3} ${h.w * 0.9 + 14},2`} fill="#0a0e28" />
            <path d={`M-18 4 L${h.w * 0.45} ${-h.h * 0.3 - 4} L${h.w * 0.9 + 18} 4`} stroke="#e6edff" strokeWidth={14 * h.k + 4} strokeLinecap="round" fill="none" opacity={0.92} />
            {[0, 1].map((j) => <rect key={j} x={h.w * (0.18 + j * 0.4)} y={h.h * 0.28} width={h.w * 0.2} height={h.h * 0.28} fill={h.win || j ? '#ffc766' : '#161c40'} opacity={0.6 + 0.4 * Math.sin(t * 2 + h.i + j)} />)}
            <ellipse cx={h.w * 0.45} cy={h.h * 0.45} rx={h.w * 0.5} ry={h.h * 0.35} fill="#ffb454" opacity={0.08} />
          </g>
        )))}
        {Array.from({ length: 3 }, (_, i) => (
          <g key={i} transform={`translate(${i % 2 ? 900 : 150} ${1500 + i * 60}) scale(${1.2 + i * 0.2})`}>
            <polygon points="0,-300 90,-150 50,-150 120,-30 60,-30 140,60 -140,60 -60,-30 -120,-30 -50,-150 -90,-150" fill="#050a1a" opacity={0.95} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Window seen from outside; a gnome's hat pops up behind the sill at `popAt` seconds. */
export const TomteWindowArt: React.FC<{ t: number; popAt: number; zoom?: number; p: number }> = ({ t, popAt, zoom = 0.2, p }) => {
  const rise = clamp01((t - popAt) / 0.45);
  const ease = 1 - (1 - rise) ** 3 + (rise >= 1 ? Math.sin((t - popAt) * 6) * 0.01 : 0);
  const flick = 0.92 + 0.08 * Math.sin(t * 9);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ transform: `scale(${1 + zoom * p})`, transformOrigin: '540px 1000px' }}>
        <defs>
          <radialGradient id="wg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd88a" stopOpacity="0.8" /><stop offset="1" stopColor="#ff9a3c" stopOpacity="0" /></radialGradient>
          <clipPath id="win"><rect x={290} y={560} width={500} height={600} /></clipPath>
        </defs>
        <rect width={1080} height={1920} fill="#2a1a16" />
        {Array.from({ length: 16 }, (_, i) => <rect key={i} x={0} y={i * 125} width={1080} height={5} fill="#1c110e" />)}
        <circle cx={540} cy={860} r={640} fill="url(#wg)" opacity={flick} />
        <rect x={290} y={560} width={500} height={600} fill="#ffb862" opacity={flick} />
        <g clipPath="url(#win)">
          <rect x={290} y={560} width={500} height={600} fill="#ff9d3c" opacity={0.3} />
          <rect x={290} y={900} width={500} height={260} fill="#6e3a24" />
          {/* gnome behind the sill */}
          <g transform={`translate(0 ${(1 - ease) * 380})`}>
            <ellipse cx={540} cy={1030} rx={120} ry={140} fill="#f1c7a2" />
            <circle cx={500} cy={1000} r={11} fill="#1b1424" /><circle cx={580} cy={1000} r={11} fill="#1b1424" />
            <path d="M420 1060 Q 540 1000 660 1060 V1200 H420Z" fill="#fbfbff" />
            <path d="M420 960 C 430 800 520 740 640 720 C 610 790 650 870 660 960Z" fill="#c8202c" />
            <rect x={410} y={940} width={260} height={44} rx={22} fill="#fbfbff" />
            <circle cx={640} cy={720} r={30} fill="#fbfbff" />
          </g>
        </g>
        <rect x={290} y={560} width={500} height={600} fill="none" stroke="#e8d9bf" strokeWidth={26} />
        <rect x={532} y={560} width={16} height={600} fill="#e8d9bf" /><rect x={290} y={852} width={500} height={16} fill="#e8d9bf" />
        {/* curtains */}
        <path d="M290 560 Q 400 700 330 1160 H290Z" fill="#8e1b2b" opacity={0.9} /><path d="M790 560 Q 680 700 750 1160 H790Z" fill="#8e1b2b" opacity={0.9} />
        {/* sill and snow */}
        <rect x={250} y={1160} width={580} height={36} rx={10} fill="#e8d9bf" />
        <path d="M240 1160 Q 330 1090 440 1150 T 640 1148 T 850 1160 V1176 H240Z" fill="#f4f8ff" />
        <path d="M0 1560 Q 300 1480 560 1540 T 1080 1510 V1920 H0Z" fill="#8fa2d6" />
      </svg>
    </AbsoluteFill>
  );
};

/** 4x6 little doors that light up one after another. */
export const DoorsArt: React.FC<{ t: number; fast?: boolean }> = ({ t, fast }) => {
  const step = fast ? 0.1 : 0.16;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 55%, #243268 0%, #0d1534 70%)' }} />
      <div style={{ position: 'absolute', left: 150, top: 600, width: 780 }}>
        {Array.from({ length: 24 }, (_, i) => {
          const col = i % 4, row = Math.floor(i / 4);
          const g = clamp01((t - 0.15 - ((i * 7) % 24) * step) / 0.25);
          const pal = [['#8e1b2b', '#5e0f1b'], ['#1f5a43', '#123826'], ['#b3862f', '#7a5818'], ['#234b78', '#14304f']][(i * 5) % 4];
          return (
            <div key={i} style={{ position: 'absolute', left: col * 202, top: row * 198, width: 172, height: 172 }}>
              <div style={{ position: 'absolute', inset: 4, borderRadius: 10, background: 'radial-gradient(circle, #fff1c0, #ffc15a 70%)', opacity: g, boxShadow: `0 0 ${50 * g}px ${12 * g}px rgba(255,170,70,${0.8 * g})` }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: `linear-gradient(160deg, ${pal[0]}, ${pal[1]})`, border: '4px solid #e3b85a', boxSizing: 'border-box', transformOrigin: '0 50%', transform: `perspective(700px) rotateY(${-16 * g}deg)`, boxShadow: '0 6px 14px rgba(0,0,0,0.5)' }}>
                <svg width="100%" height="100%" viewBox="0 0 160 160"><path d="M80 52 L89 72 L110 74 L94 88 L99 109 L80 98 L61 109 L66 88 L50 74 L71 72Z" fill="#f3d37c" opacity={0.9} /></svg>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Plain night-sky card with soft glitter, for titles and credits. */
export const CardArt: React.FC<{ t: number; warm?: number; dark?: boolean }> = ({ t, warm = 0.2, dark }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: dark ? '#07070d' : 'radial-gradient(ellipse at 50% 70%, #1f3170 0%, #0c1536 55%, #050917 100%)' }} />
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(255,180,80,${warm}) 0%, rgba(0,0,0,0) 60%)` }} />
    {Array.from({ length: 18 }, (_, i) => {
      const r = mulberry(40 + i); const x = 160 + r() * 760, y = 420 + r() * 1100;
      return <Glint key={i} x={x} y={y} size={10 + r() * 22} o={Math.max(0, Math.sin(t * (0.9 + r()) + r() * 6)) ** 6 * 0.9} color="#ffe08a" />;
    })}
  </AbsoluteFill>
);

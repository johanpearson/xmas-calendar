import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { Caption } from './Caption';
import { env, Glint, mulberry } from './fx';
import { serif, serifUpright, titleFont } from './fonts';
import { FPS, TEXT } from './timing';

// ---------- scene 4: grid of little doors, none fully open ----------
const PALETTE = [
  ['#8e1b2b', '#5e0f1b'], ['#1f5a43', '#123826'], ['#b3862f', '#7a5818'],
  ['#7a1f3a', '#4d1224'], ['#234b78', '#14304f'], ['#a3372a', '#6e2018'],
];
const rg = mulberry(21);
const doors = Array.from({ length: 24 }, (_, i) => ({
  i, col: i % 4, row: Math.floor(i / 4),
  glowAt: 70 + Math.floor(rg() * 100), wiggle: rg() < 0.4, wigAt: 90 + Math.floor(rg() * 90),
  pal: PALETTE[Math.floor(rg() * PALETTE.length)],
}));

export const Grid: React.FC = () => {
  const frame = useCurrentFrame(); // local 10 == 13.0 s
  const W = 172, H = 172, GX = 30, GY = 26;
  const drift = 1 + 0.05 * interpolate(frame, [0, 210], [0, 1]);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 560, width: 780, height: 6 * H + 5 * GY, transform: `scale(${drift})`, transformOrigin: '50% 50%' }}>
        {doors.map((d) => {
          const sIn = spring({ frame: frame - 6 - (d.row * 3 + d.col) * 3, fps: FPS, config: { damping: 16, stiffness: 90 } });
          const g = interpolate(frame, [d.glowAt, d.glowAt + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const pulse = 0.75 + 0.25 * Math.sin(frame * 0.12 + d.i);
          // gentle, repeated wiggle; the door never opens more than ~20 degrees
          let deg = 0;
          if (d.wiggle && frame > d.wigAt) {
            const w = ((frame - d.wigAt) % 70) / 70;
            deg = w < 0.5 ? 20 * Math.sin((w / 0.5) * Math.PI) ** 2 * (1 - w) : 0;
          }
          return (
            <div
              key={d.i}
              style={{
                position: 'absolute', left: d.col * (W + GX), top: d.row * (H + GY), width: W, height: H,
                opacity: sIn, transform: `translateY(${(1 - sIn) * 240}px)`, perspective: 700,
              }}
            >
              {/* light behind the door, leaking through the seams */}
              <div
                style={{
                  position: 'absolute', inset: 4, borderRadius: 10,
                  background: 'radial-gradient(circle at 50% 50%, #fff1c0, #ffc15a 70%)',
                  opacity: g,
                  boxShadow: `0 0 ${26 * g}px ${8 * g}px rgba(255,190,90,${0.95 * g * pulse}), 0 0 ${90 * g}px ${22 * g}px rgba(255,150,60,${0.5 * g * pulse})`,
                }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: 12, transformOrigin: '0% 50%',
                  transform: `rotateY(${-deg}deg)`,
                  background: `linear-gradient(160deg, ${d.pal[0]}, ${d.pal[1]})`,
                  border: '4px solid #e3b85a', boxSizing: 'border-box',
                  boxShadow: 'inset 0 0 0 6px rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.5)',
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 160 160">
                  <rect x="28" y="28" width="104" height="104" rx="8" fill="none" stroke="#e3b85a" strokeWidth="2.5" opacity="0.8" />
                  <path d="M80 52 L89 72 L110 74 L94 88 L99 109 L80 98 L61 109 L66 88 L50 74 L71 72Z" fill="#f3d37c" opacity="0.9" />
                  <circle cx="120" cy="82" r="5" fill="#f3d37c" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <Caption frame={frame} from={20} to={190} text={TEXT.grid} top={300} />
    </AbsoluteFill>
  );
};

// ---------- scene 5: silhouette montage ----------
const SIL = '#070a17';
const Disc: React.FC<{ size?: number }> = ({ size = 640 }) => (
  <div
    style={{
      position: 'absolute', left: 540 - size / 2, top: 930 - size / 2, width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle closest-side, rgba(255,236,180,0.95) 0%, rgba(255,196,100,0.8) 35%, rgba(255,150,60,0.35) 65%, rgba(255,140,50,0) 100%)',
    }}
  />
);

const Mug: React.FC<{ t: number }> = ({ t }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920">
    <defs><filter id="sm"><feGaussianBlur stdDeviation="7" /></filter></defs>
    <rect x={430} y={930} width={220} height={200} rx={30} fill={SIL} />
    <path d="M650 970 q 80 0 80 55 q 0 55 -80 55" fill="none" stroke={SIL} strokeWidth={28} />
    <rect x={400} y={1120} width={280} height={18} rx={9} fill={SIL} />
    {[0, 1, 2].map((i) => {
      const k = (t * 1.4 + i / 3) % 1;
      const x = 480 + i * 60;
      return (
        <path key={i} d={`M${x} ${900 - k * 120} q 22 -40 0 -80 q -22 -40 0 -80`} fill="none" stroke="#fff2d6" strokeWidth={14} strokeLinecap="round"
          opacity={0.7 * Math.sin(k * Math.PI)} filter="url(#sm)" transform={`translate(0 ${-k * 60})`} />
      );
    })}
  </svg>
);

const Star: React.FC<{ t: number }> = ({ t }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 78 : 190, a = (Math.PI / 5) * i - Math.PI / 2;
    return `${540 + r * Math.cos(a)},${930 + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ transform: `rotate(${Math.sin(t * 3) * 4}deg)`, transformOrigin: '540px 930px' }}>
      <defs>
        <filter id="sg"><feGaussianBlur stdDeviation="14" /></filter>
        <linearGradient id="sgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff2b0" /><stop offset="1" stopColor="#f0a830" /></linearGradient>
      </defs>
      <polygon points={pts} fill="#ffc95a" opacity={0.7} filter="url(#sg)" />
      <polygon points={pts} fill="url(#sgd)" stroke="#fff6d0" strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
};

const Gift: React.FC<{ t: number }> = ({ t }) => {
  const lift = 34 * Math.min(1, t * 2.2);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.95" /><stop offset="1" stopColor="#ffbb55" stopOpacity="0" /></linearGradient>
      </defs>
      <polygon points={`430,${930 - lift * 0.2} 650,${930 - lift * 0.2} 800,560 280,560`} fill="url(#beam)" opacity={Math.min(1, t * 3)} />
      <rect x={400} y={940} width={280} height={190} fill={SIL} />
      <rect x={522} y={940} width={36} height={190} fill="#0e1428" />
      <g transform={`translate(0 ${-lift})`}>
        <rect x={380} y={880} width={320} height={56} rx={6} fill={SIL} />
        <rect x={522} y={880} width={36} height={56} fill="#0e1428" />
        <path d="M540 880 C 470 800 440 860 540 880 C 640 800 640 860 540 880Z" fill={SIL} stroke="#0e1428" strokeWidth={6} />
      </g>
    </svg>
  );
};

const Magnifier: React.FC<{ t: number }> = ({ t }) => {
  const x = interpolate(t, [0, 1], [-420, 420]);
  const y = interpolate(t, [0, 1], [120, -120]);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={`translate(${540 + x} ${930 + y}) rotate(-35)`}>
        <circle r={105} fill="rgba(255,235,170,0.35)" />
        <circle r={105} fill="none" stroke={SIL} strokeWidth={24} />
        <rect x={-14} y={105} width={28} height={190} rx={12} fill={SIL} />
        <path d="M-60 -50 A 80 80 0 0 1 -10 -80" stroke="#fff8dc" strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.9} />
      </g>
      <Glint x={540 + x + 80} y={930 + y - 70} size={60} o={0.9 * Math.sin(t * Math.PI)} />
    </svg>
  );
};

const Bells: React.FC<{ t: number }> = ({ t }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920">
    {[-1, 1].map((s) => {
      const ang = Math.sin(t * 9 + (s > 0 ? 1.3 : 0)) * 14 * (1 - t * 0.3);
      return (
        <g key={s} transform={`translate(${540 + s * 120} 740) rotate(${ang})`}>
          <line x1={0} y1={0} x2={0} y2={110} stroke={SIL} strokeWidth={10} />
          <circle cx={0} cy={210} r={100} fill={SIL} stroke="#e8b24c" strokeWidth={5} />
          <path d="M-90 236 H90" stroke="#e8b24c" strokeWidth={5} opacity={0.8} />
          <circle cx={0} cy={262} r={14} fill="#e8b24c" opacity={0.7} />
          <path d="M-60 150 q 20 -30 50 -34" stroke="#ffe9a8" strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.7} />
        </g>
      );
    })}
    <path d="M400 740 q 140 -80 280 0" stroke="#7a1520" strokeWidth={18} fill="none" strokeLinecap="round" />
  </svg>
);

const ITEMS: { from: number; to: number; C: React.FC<{ t: number }> }[] = [
  { from: 20.0, to: 21.0, C: Mug },
  { from: 20.8, to: 21.8, C: Star },
  { from: 21.6, to: 22.7, C: Gift },
  { from: 22.45, to: 23.5, C: Magnifier },
  { from: 23.3, to: 24.3, C: Bells },
];

const SantaHat: React.FC<{ rise: number; wob: number }> = ({ rise, wob }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
    <g transform={`translate(0 ${(1 - rise) * 420})`}>
      {/* speech bubble */}
      <g opacity={Math.min(1, Math.max(0, (rise - 0.55) * 3))} transform={`translate(0 ${-6 * Math.sin(wob * 2)})`}>
        <path d="M260 1020 h 560 a 50 50 0 0 1 50 50 v 110 a 50 50 0 0 1 -50 50 h -270 l -60 70 l 8 -70 h -238 a 50 50 0 0 1 -50 -50 v -110 a 50 50 0 0 1 50 -50Z" fill="#fff4dc" />
      </g>
      <g transform={`rotate(${Math.sin(wob) * 2.5} 520 1700)`}>
        {/* face */}
        <ellipse cx={522} cy={1740} rx={152} ry={185} fill="#f1c7a2" />
        <circle cx={470} cy={1642} r={13} fill="#1b1424" /><circle cx={574} cy={1642} r={13} fill="#1b1424" />
        <circle cx={474} cy={1637} r={4} fill="#fff" /><circle cx={578} cy={1637} r={4} fill="#fff" />
        <circle cx={522} cy={1700} r={28} fill="#e59c86" />
        <circle cx={430} cy={1710} r={22} fill="#eaa38e" opacity={0.6} /><circle cx={614} cy={1710} r={22} fill="#eaa38e" opacity={0.6} />
        <path d="M368 1745 Q 440 1700 522 1752 Q 604 1700 676 1745 Q 700 1800 676 2000 H368 Q 344 1800 368 1745Z" fill="#fbfbff" />
        {/* hat */}
        <path d="M368 1560 C 372 1400 470 1340 640 1300 C 600 1360 640 1440 676 1560Z" fill="#c8202c" />
        <path d="M368 1560 C 400 1450 470 1380 560 1350" stroke="#e8505a" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.7} />
        <rect x={350} y={1536} width={346} height={52} rx={26} fill="#fbfbff" />
        <circle cx={640} cy={1300} r={36} fill="#fbfbff" />
      </g>
    </g>
  </svg>
);

export const Montage: React.FC = () => {
  const frame = useCurrentFrame(); // local 10 == 20.0 s
  const s = (frame - 10) / FPS + 20; // absolute seconds
  const wob = (frame / FPS) * 5;
  const hoRise = spring({ frame: frame - 10 - 3.6 * FPS, fps: FPS, config: { damping: 11, stiffness: 80 } });
  const itemsFade = env(s, 19.9, 23.9, 0.27, 0.33); // fade items out for the hat
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: itemsFade }}>
        {ITEMS.map(({ from, to, C }, i) => {
          const o = env(s, from, to, 0.23, 0.27);
          if (o <= 0) return null;
          const t = (s - from) / (to - from);
          return (
            <AbsoluteFill key={i} style={{ opacity: o, transform: `scale(${0.94 + 0.12 * t})`, transformOrigin: '540px 930px' }}>
              <Disc size={i === 3 ? 760 : 620} />
              <div style={{ position: 'absolute', inset: 0 }}><C t={t} /></div>
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: env(s, 23.5, 25.1, 0.2, 0.27) }}>
        <SantaHat rise={hoRise} wob={wob} />
        <div
          style={{
            position: 'absolute', left: 260, width: 560, top: 1040, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: serifUpright, fontWeight: 600, fontSize: 92, color: '#8a1a24',
            opacity: Math.min(1, Math.max(0, (hoRise - 0.6) * 3)), transform: `translateY(${-6 * Math.sin(wob * 2) + (1 - hoRise) * 420}px)`,
          }}
        >
          {TEXT.hoho}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- scene 6: title card ----------
const glints = (() => {
  const r = mulberry(33);
  return Array.from({ length: 30 }, () => ({
    x: 190 + r() * 700, y: 640 + r() * 420, size: 10 + r() * 26, ph: r() * 6.28, sp: 0.12 + r() * 0.2, start: 6 + r() * 70,
  }));
})();

export const Title: React.FC = () => {
  const frame = useCurrentFrame(); // local 10 == 25.0 s
  const a = frame - 10;
  const reveal = spring({ frame: a, fps: FPS, config: { damping: 20, stiffness: 50 } });
  const o = env(a, 0, 100000, 28, 1);
  const shimmer = interpolate(a, [0, 140], [120, -20]);
  const gold: React.CSSProperties = {
    backgroundImage: 'linear-gradient(105deg, #9b6a1a 0%, #f5d57a 22%, #fff7d2 32%, #e3b04a 46%, #b07a22 62%, #f5d57a 80%, #9b6a1a 100%)',
    backgroundSize: '260% 100%', backgroundPosition: `${shimmer}% 0`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
  };
  const sub = (from: number) => env(a, from, 100000, 26, 1);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(255,180,80,${0.18 * o}) 0%, rgba(0,0,0,0) 60%)` }} />
      <div
        style={{
          position: 'absolute', left: 150, right: 150, top: 640, textAlign: 'center', fontFamily: titleFont, fontWeight: 700,
          fontSize: 112, lineHeight: 1.1, padding: '0 20px', opacity: o, transform: `scale(${0.92 + 0.08 * reveal})`, filter: `blur(${(1 - o) * 12}px) drop-shadow(0 0 22px rgba(255,190,80,0.55))`,
        }}
      >
        <div style={{ ...gold, whiteSpace: 'nowrap' }}>Adventskalendern</div>
        <div style={{ ...gold, fontSize: 150 }}>2026</div>
      </div>
      {glints.map((g, i) => {
        const tw = Math.max(0, Math.sin(a * g.sp + g.ph)) ** 6;
        return <Glint key={i} x={g.x} y={g.y} size={g.size} o={tw * env(a, g.start, 100000, 10, 1) * o} color="#ffe08a" />;
      })}
      <div style={{ position: 'absolute', left: 150, right: 150, top: 1130, textAlign: 'center', opacity: sub(34) }}>
        <svg width={420} height={30} viewBox="0 0 420 30"><path d="M10 15 H180 M240 15 H410" stroke="#e3b85a" strokeWidth={2} opacity={0.8} /><path d="M210 2 L216 12 L228 15 L216 18 L210 28 L204 18 L192 15 L204 12Z" fill="#f3d37c" /></svg>
      </div>
      <div
        style={{
          position: 'absolute', left: 150, right: 150, top: 1190, textAlign: 'center', fontFamily: serif, fontStyle: 'italic', fontWeight: 500,
          fontSize: 92, color: '#fbe8c4', opacity: sub(38), filter: `blur(${(1 - sub(38)) * 6}px)`, textShadow: '0 0 24px rgba(255,190,100,0.45)',
        }}
      >
        {TEXT.to}
      </div>
      <div
        style={{
          position: 'absolute', left: 150, right: 150, top: 1480, textAlign: 'center', fontFamily: serif, fontStyle: 'italic', fontWeight: 500,
          fontSize: 62, color: '#e9d3aa', opacity: sub(62) * 0.92, textShadow: '0 0 18px rgba(255,190,100,0.35)',
        }}
      >
        {TEXT.from}
      </div>
    </AbsoluteFill>
  );
};

// ---------- scene 7: date ----------
export const DateCard: React.FC = () => {
  const frame = useCurrentFrame(); // local 10 == 31.0 s
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, right: 150, top: 760, textAlign: 'center' }}>
        <svg width={120} height={120} viewBox="-60 -60 120 120" style={{ opacity: env(frame, 16, 1e5, 30, 1), filter: 'drop-shadow(0 0 14px rgba(255,200,90,0.8))' }}>
          <path d="M0 -50 L12 -14 L50 -12 L20 10 L30 46 L0 25 L-30 46 L-20 10 L-50 -12 L-12 -14Z" fill="#f3d37c" />
        </svg>
      </div>
      <Caption frame={frame} from={30} to={1e5} text={TEXT.date} top={930} size={84} />
    </AbsoluteFill>
  );
};

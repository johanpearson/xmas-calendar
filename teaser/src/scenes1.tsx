import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { Caption } from './Caption';
import { env, mulberry } from './fx';
import { CANDLE_TIMES, FPS, TEXT } from './timing';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  return <Caption frame={frame} from={42} to={92} text={TEXT.intro} top={800} />;
};

// ---------- scene 2: house in snow ----------
const stars = (() => {
  const r = mulberry(5);
  return Array.from({ length: 60 }, () => ({ x: r() * 1080, y: r() * 800, s: 1 + r() * 2.2, ph: r() * 6 }));
})();

export const House: React.FC = () => {
  const frame = useCurrentFrame(); // scene starts at local frame 10 (3.0 s)
  const p = interpolate(frame, [0, 160], [0, 1]);
  const scale = 1 + 0.38 * p;
  const flick = 0.9 + 0.1 * Math.sin(frame * 0.35) * Math.sin(frame * 0.13 + 1);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: '520px 1200px' }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <linearGradient id="gSnow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8aa4d6" /><stop offset="1" stopColor="#1f2f63" />
            </linearGradient>
            <radialGradient id="gWin" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffd88a" stopOpacity="0.9" /><stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gCone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd07a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd07a" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="gMoon"><stop offset="0" stopColor="#bcd0ff" stopOpacity="0.35" /><stop offset="1" stopColor="#bcd0ff" stopOpacity="0" /></radialGradient>
            <filter id="hb"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={0.35 + 0.35 * Math.sin(frame * 0.07 + s.ph)} />
          ))}
          {/* moon glow */}
          <circle cx={850} cy={520} r={150} fill="url(#gMoon)" />
          <circle cx={850} cy={520} r={46} fill="#e9efff" opacity={0.85} />
          {/* back hills */}
          <path d="M0 1260 Q 260 1180 520 1250 T 1080 1230 V1920 H0Z" fill="#3a4f8a" />
          {/* far firs */}
          {[130, 210, 910].map((x, i) => (
            <g key={x} transform={`translate(${x} ${1270 + i * 6}) scale(${0.8 + (i % 2) * 0.2})`}>
              <polygon points="0,-190 60,-70 30,-70 80,20 -80,20 -30,-70 -60,-70" fill="#0a1534" />
            </g>
          ))}
          {/* ground */}
          <path d="M0 1330 Q 300 1270 540 1320 T 1080 1300 V1920 H0Z" fill="url(#gSnow)" />
          {/* window light on snow */}
          <polygon points="470,1250 570,1250 760,1700 300,1700" fill="url(#gCone)" opacity={0.55 * flick} />
          {/* house */}
          <rect x={340} y={1060} width={400} height={290} fill="#080d1c" />
          <polygon points="300,1075 540,890 780,1075" fill="#060a16" />
          <path d="M296 1082 L540 884 L784 1082" fill="none" stroke="#e4ecff" strokeWidth={16} strokeLinecap="round" opacity={0.92} />
          <rect x={640} y={920} width={52} height={110} fill="#080d1c" />
          <rect x={632} y={908} width={68} height={18} rx={8} fill="#e4ecff" opacity={0.92} />
          {/* door */}
          <rect x={610} y={1200} width={66} height={150} rx={6} fill="#0c1428" />
          {/* lit window */}
          <circle cx={520} cy={1190} r={140} fill="url(#gWin)" opacity={flick} />
          <rect x={478} y={1136} width={84} height={108} fill="#ffc766" opacity={flick} />
          <rect x={478} y={1136} width={84} height={108} fill="#ff9d3c" opacity={0.25} />
          <rect x={517} y={1136} width={6} height={108} fill="#2a1a10" />
          <rect x={478} y={1186} width={84} height={6} fill="#2a1a10" />
          <rect x={470} y={1244} width={100} height={12} rx={4} fill="#e4ecff" opacity={0.9} />
          {/* front firs */}
          {[
            [200, 1370, 1.25],
            [880, 1390, 1.5],
            [980, 1340, 1.0],
          ].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <polygon points="0,-300 90,-150 50,-150 120,-30 60,-30 140,60 -140,60 -60,-30 -120,-30 -50,-150 -90,-150" fill="#050a1a" />
              <path d="M-80 -135 Q0 -160 80 -135 M-100 -20 Q0 -50 100 -20 M-120 50 Q0 20 120 50" stroke="#dfe8ff" strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.7} />
            </g>
          ))}
          <path d="M0 1520 Q 340 1450 700 1520 T 1080 1500 V1920 H0Z" fill="#2c3e78" opacity={0.0} />
          {/* chimney smoke */}
          {Array.from({ length: 6 }, (_, i) => {
            const tt = ((frame * 0.8 + i * 30) % 180) / 180;
            return <circle key={i} cx={666 + Math.sin(tt * 5 + i) * 26 + tt * 40} cy={900 - tt * 260} r={14 + tt * 34} fill="#9fb2dc" opacity={0.25 * (1 - tt)} filter="url(#hb)" />;
          })}
        </svg>
      </div>
      <Caption frame={frame} from={30} to={150} text={TEXT.house} />
    </AbsoluteFill>
  );
};

// ---------- scene 3: advent candles ----------
const CX = [300, 460, 620, 780];

export const Candles: React.FC = () => {
  const frame = useCurrentFrame(); // local frame 10 == 8.0 s
  const lit = CANDLE_TIMES.map((t) => spring({ frame: frame - 10 - (t - 8) * FPS, fps: FPS, config: { damping: 14, stiffness: 110 } }));
  const count = lit.reduce((a, b) => a + Math.min(1, b), 0);
  const zoom = 1 + 0.1 * interpolate(frame, [0, 170], [0, 1]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 56%, rgba(255,160,70,${0.1 * count}) 0%, rgba(0,0,0,0) 65%)` }} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '540px 1100px' }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f2d58a" /><stop offset="0.5" stopColor="#b98a2e" /><stop offset="1" stopColor="#6e4c14" />
            </linearGradient>
            <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#c8b690" /><stop offset="0.45" stopColor="#f7ecd2" /><stop offset="1" stopColor="#b7a27a" />
            </linearGradient>
            <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.85" /><stop offset="0.45" stopColor="#ff9a3c" stopOpacity="0.28" /><stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="flameO" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ffe9a0" /><stop offset="0.55" stopColor="#ffab3a" /><stop offset="1" stopColor="#e2561a" />
            </linearGradient>
          </defs>
          {/* stand */}
          <ellipse cx={540} cy={1430} rx={190} ry={34} fill="url(#brass)" />
          <rect x={526} y={1270} width={28} height={160} fill="url(#brass)" />
          <path d="M230 1262 Q540 1290 850 1262 L850 1286 Q540 1316 230 1286Z" fill="url(#brass)" />
          {CX.map((x, i) => {
            const L = Math.min(1, lit[i]);
            const fl = Math.sin(frame * 0.5 + i * 2) * 0.5 + Math.sin(frame * 0.23 + i * 5) * 0.5;
            const wickY = 940;
            return (
              <g key={i}>
                <path d={`M${x - 34} 1280 L${x - 28} 1252 H${x + 28} L${x + 34} 1280Z`} fill="url(#brass)" />
                <rect x={x - 24} y={wickY + 10} width={48} height={320} rx={6} fill="url(#wax)" />
                <rect x={x - 24} y={wickY + 10} width={48} height={14} rx={6} fill="#fff7e2" opacity={0.6 * L} />
                <rect x={x - 2} y={wickY - 4} width={4} height={16} fill="#2a1d12" />
                <circle cx={x} cy={wickY - 50} r={230} fill="url(#glow)" opacity={L * (0.82 + 0.1 * fl)} />
                <g transform={`translate(${x} ${wickY - 4}) skewX(${fl * 5}) scale(${L * (1 + 0.04 * fl)} ${L * (1 + 0.1 * fl)})`}>
                  <path d="M0 0 C 24 -30 20 -66 0 -104 C -20 -66 -24 -30 0 0Z" fill="url(#flameO)" />
                  <path d="M0 -2 C 11 -16 9 -34 0 -52 C -9 -34 -11 -16 0 -2Z" fill="#fff6d0" opacity={0.95} />
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <Caption frame={frame} from={26} to={150} text={TEXT.candles} />
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FPS } from './timing';

// deterministic pseudo random
export const mulberry = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** opacity envelope: fade in over `fi` frames from `a`, fade out over `fo` frames ending at `b` */
export const env = (frame: number, a: number, b: number, fi: number, fo: number) =>
  clamp01(Math.min((frame - a) / Math.max(1e-6, fi), (b - frame) / Math.max(1e-6, fo)));

export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse at 50% 78%, #27407a 0%, #14285a 35%, #0a1636 65%, #050b1f 100%)',
    }}
  />
);

const bokehData = (() => {
  const r = mulberry(7);
  return Array.from({ length: 26 }, () => ({
    x: r() * 1080, y: r() * 1920, s: 70 + r() * 190,
    hue: r() < 0.7 ? 'rgba(255,196,96,' : 'rgba(255,150,70,',
    ph: r() * 6.28, sp: 0.3 + r() * 0.5, dx: (r() - 0.5) * 60, dy: (r() - 0.5) * 80,
    a: 0.12 + r() * 0.28,
  }));
})();

export const Bokeh: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ opacity }}>
      {bokehData.map((b, i) => {
        const tw = 0.65 + 0.35 * Math.sin(t * b.sp * 2 + b.ph);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.x + Math.sin(t * 0.3 + b.ph) * b.dx - b.s / 2,
              top: b.y + Math.cos(t * 0.25 + b.ph) * b.dy - b.s / 2,
              width: b.s, height: b.s, borderRadius: '50%',
              background: `radial-gradient(circle, ${b.hue}${b.a * tw}) 0%, ${b.hue}${b.a * tw * 0.8}) 55%, ${b.hue}0) 72%)`,
              filter: 'blur(3px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const flakes = (() => {
  const r = mulberry(99);
  return Array.from({ length: 130 }, () => ({
    x: r() * 1080, y0: r() * 2100, sp: 60 + r() * 150, sz: 2 + r() * 7,
    sw: 15 + r() * 40, ph: r() * 6.28, a: 0.35 + r() * 0.55,
  }));
})();

export const Snow: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame) / FPS;
  const fadeIn = clamp01((frame - startFrame) / 45);
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <svg width={1080} height={1920}>
        <defs><filter id="sb"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
        {flakes.map((p, i) => {
          const y = ((p.y0 + t * p.sp) % 2100) - 90;
          const x = p.x + Math.sin(t * 0.8 + p.ph) * p.sw;
          return <circle key={i} cx={x} cy={y} r={p.sz} fill="#fff" opacity={p.a} filter={p.sz > 6 ? 'url(#sb)' : undefined} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,8,0.55) 100%)', pointerEvents: 'none' }}
  />
);

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.16, pointerEvents: 'none' }}>
      <svg width={1080} height={1920} viewBox="0 0 270 480" preserveAspectRatio="none">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={frame % 24} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="270" height="480" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** four-pointed glitter star */
export const Glint: React.FC<{ x: number; y: number; size: number; o: number; color?: string }> = ({ x, y, size, o, color = '#fff3c4' }) => (
  <svg style={{ position: 'absolute', left: x - size, top: y - size, opacity: o }} width={size * 2} height={size * 2} viewBox="-1 -1 2 2">
    <path d="M0 -1 Q0.08 -0.08 1 0 Q0.08 0.08 0 1 Q-0.08 0.08 -1 0 Q-0.08 -0.08 0 -1Z" fill={color} />
  </svg>
);

export const lerp = interpolate;

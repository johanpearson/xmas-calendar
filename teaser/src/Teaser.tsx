import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import './fonts';
import { Backdrop, Bokeh, Grain, Snow, Vignette, env } from './fx';
import { Candles, House, Intro } from './scenes1';
import { DateCard, Grid, Montage, Title } from './scenes2';
import { SCENES, TOTAL_FRAMES, f } from './timing';

const PAD = 10; // each scene starts PAD frames early and ends PAD frames late, for crossfades
const Scene: React.FC<{ range: readonly [number, number]; children: React.ReactNode; fadeOut?: boolean }> = ({ range, children, fadeOut = true }) => {
  const from = Math.max(0, f(range[0]) - PAD);
  const to = Math.min(TOTAL_FRAMES, f(range[1]) + PAD);
  return (
    <Sequence from={from} durationInFrames={to - from} layout="none">
      <Fade len={to - from} first={from === 0} fadeOut={fadeOut}>{children}</Fade>
    </Sequence>
  );
};
const Fade: React.FC<{ len: number; first: boolean; fadeOut: boolean; children: React.ReactNode }> = ({ len, first, fadeOut, children }) => {
  const fr = useCurrentFrame();
  const o = Math.min(first ? 1 : fr / (PAD * 2), fadeOut ? (len - fr) / (PAD * 2) : 1);
  return <AbsoluteFill style={{ opacity: Math.max(0, Math.min(1, o)) }}>{children}</AbsoluteFill>;
};

export const Teaser: React.FC = () => {
  const frame = useCurrentFrame();
  // black at the very start, black again at the end
  const black = Math.max(
    interpolate(frame, [0, 70], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [f(33), TOTAL_FRAMES - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  const bokehO = interpolate(frame, [0, 75], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('music.wav')} />
      <Backdrop />
      <Bokeh opacity={bokehO * (1 - 0.35 * env(frame, f(8), f(13), 15, 15) * 0)} />
      <Snow startFrame={30} />
      <Scene range={SCENES.intro}><Intro /></Scene>
      <Scene range={SCENES.house}><House /></Scene>
      <Scene range={SCENES.candles}><Candles /></Scene>
      <Scene range={SCENES.grid}><Grid /></Scene>
      <Scene range={SCENES.montage}><Montage /></Scene>
      <Scene range={SCENES.title}><Title /></Scene>
      <Scene range={SCENES.date} fadeOut={false}><DateCard /></Scene>
      <Vignette />
      <Grain />
      <AbsoluteFill style={{ backgroundColor: '#000', opacity: black }} />
    </AbsoluteFill>
  );
};

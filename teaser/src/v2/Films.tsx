import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Bokeh, Grain, Snow, Vignette, clamp01 } from '../fx';
import cues from './cues.json';
import { CardArt, DoorsArt, Hint, HintCue, Line, Seg, StreetArt, TextLine, TomteWindowArt, TownArt, WorkshopArt, useT } from './kit';

const Overlay: React.FC<{ lines: Line[]; hints: HintCue[]; duration: number; slam?: boolean; flashes?: number[]; bokeh?: number }> = ({ lines, hints, duration, slam, flashes = [], bokeh = 0.8 }) => {
  const t = useT();
  const flash = Math.max(0, ...flashes.map((f) => 1 - (t - f) / 0.14).map((v) => (v > 1 ? 0 : v)));
  const black = clamp01((t - (duration - 0.7)) / 0.7) + clamp01(1 - t / 0.6);
  return (
    <>
      <Snow startFrame={0} />
      <Bokeh opacity={bokeh} />
      {hints.map((h, i) => <Hint key={i} h={h} />)}
      {lines.map((l, i) => <TextLine key={i} l={l} slam={slam} />)}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 38%)' }} />
      <Vignette />
      <Grain />
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.85 }} />
      <AbsoluteFill style={{ background: '#000', opacity: Math.min(1, black) }} />
    </>
  );
};

/** A, "Klassisk julfilm": slow, warm, cross-faded. */
export const FilmA: React.FC = () => {
  const c = cues.A as unknown as { duration: number; lines: Line[]; hints: HintCue[] };
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('music-a.wav')} />
      <Seg a={0} b={10}>{(t, p) => <TownArt t={t} p={p} zoom={0.5} />}</Seg>
      <Seg a={10} b={16.5} fade={0.9}>{(t, p) => <WorkshopArt t={t} p={p} />}</Seg>
      <Seg a={16.5} b={22.5} fade={0.9}>{(t, p) => <StreetArt t={t} p={p} />}</Seg>
      <Seg a={22.5} b={27.5} fade={0.9}>{(t, p) => <TomteWindowArt t={t} p={p} popAt={0.7} />}</Seg>
      <Seg a={27.5} b={31.5} fade={0.9}>{(t) => <DoorsArt t={t} />}</Seg>
      <Seg a={31.5} b={35.3} fade={0.9}>{(t) => <CardArt t={t} warm={0.3} />}</Seg>
      <Seg a={35.3} b={c.duration} fade={0.8}>{(t) => <CardArt t={t} warm={0.14} />}</Seg>
      <Overlay lines={c.lines} hints={c.hints} duration={c.duration} />
    </AbsoluteFill>
  );
};

/** B, trailer parody: hard cuts, flashes, slammed captions. */
export const FilmB: React.FC = () => {
  const c = cues.B as unknown as { duration: number; lines: Line[]; hints: HintCue[] };
  const flashes = [3, 4, 5, 6, 8.8, 12.8, 15.6, 19.8, 23.8, 28.8, 29.2, 32, 35.2];
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('music-b.wav')} />
      <Seg a={0} b={3}>{(t) => <CardArt t={t} dark warm={0.06} />}</Seg>
      <Seg a={3} b={4}>{(t, p) => <TownArt t={t + 6} p={p} zoom={0.25} />}</Seg>
      <Seg a={4} b={5}>{(t, p) => <WorkshopArt t={t} p={p} zoom={0.3} />}</Seg>
      <Seg a={5} b={6}>{(t, p) => <StreetArt t={t} p={p} zoom={0.4} />}</Seg>
      <Seg a={6} b={8.8}>{(t) => <CardArt t={t} dark warm={0.1} />}</Seg>
      <Seg a={8.8} b={12.8}>{(t, p) => <WorkshopArt t={t} p={p} zoom={0.55} />}</Seg>
      <Seg a={12.8} b={15.6}>{(t) => <CardArt t={t} dark warm={0.1} />}</Seg>
      <Seg a={15.6} b={19.8}>{(t, p) => <StreetArt t={t} p={p} zoom={0.9} />}</Seg>
      <Seg a={19.8} b={23.8}>{(t) => <DoorsArt t={t} fast />}</Seg>
      <Seg a={23.8} b={28.8}>{(t) => <CardArt t={t} dark warm={0.08} />}</Seg>
      <Seg a={28.8} b={32}>{(t, p) => <TomteWindowArt t={t} p={p} popAt={0.35} zoom={0.12} />}</Seg>
      <Seg a={32} b={35.2}>{(t) => <CardArt t={t} warm={0.3} />}</Seg>
      <Seg a={35.2} b={c.duration}>{(t) => <CardArt t={t} warm={0.14} />}</Seg>
      <Overlay lines={c.lines} hints={c.hints} duration={c.duration} slam flashes={flashes} bokeh={0.45} />
    </AbsoluteFill>
  );
};

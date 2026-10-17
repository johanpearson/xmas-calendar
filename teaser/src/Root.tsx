import { Composition } from 'remotion';
import { Teaser } from './Teaser';
import { FPS, TOTAL_FRAMES } from './timing';
import cues from './v2/cues.json';
import { FilmA, FilmB } from './v2/Films';

export const Root = () => (
  <>
  <Composition id="Teaser" component={Teaser} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="TeaserA" component={FilmA} durationInFrames={Math.round(cues.A.duration * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="TeaserB" component={FilmB} durationInFrames={Math.round(cues.B.duration * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);

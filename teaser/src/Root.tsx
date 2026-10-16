import { Composition } from 'remotion';
import { Teaser } from './Teaser';
import { FPS, TOTAL_FRAMES } from './timing';

export const Root = () => (
  <Composition id="Teaser" component={Teaser} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);

import { continueRender, delayRender, staticFile } from 'remotion';

// Google Fonts (OFL): Cormorant Garamond and Mountains of Christmas. The woff2 files come from
// @remotion/google-fonts via scripts/fetch-fonts.mjs and are loaded locally.
const FACES = [
  { family: 'Cormorant Garamond', file: 'cormorant-italic-500.woff2', style: 'italic', weight: '500' },
  { family: 'Cormorant Garamond', file: 'cormorant-italic-600.woff2', style: 'italic', weight: '600' },
  { family: 'Cormorant Garamond', file: 'cormorant-normal-600.woff2', style: 'normal', weight: '600' },
  { family: 'Mountains of Christmas', file: 'mountains-700.woff2', style: 'normal', weight: '700' },
];

if (typeof document !== 'undefined') {
  const handle = delayRender('fonts');
  Promise.all(
    FACES.map(async (x) => {
      const face = new FontFace(x.family, `url(${staticFile('fonts/' + x.file)}) format('woff2')`, { style: x.style, weight: x.weight });
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => { throw e; });
}

export const serif = "'Cormorant Garamond', serif";
export const serifUpright = serif;
export const titleFont = "'Mountains of Christmas', cursive";

// Renders the PNG icons in icons/ from icons/favicon.svg with headless Chromium.
// Run: npm run icons   (needs the dev dependency @playwright/test)
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ICONS_DIR = fileURLToPath(new URL('../icons/', import.meta.url));
const BACKGROUND = '#0b1a33'; // same as the SVG background and the manifest colors

// scale: share of the canvas the SVG covers. bleed: fill the whole square with the
// background (no transparent corners). Maskable icons keep the motif inside the
// central safe zone (a circle with 80 % diameter), so the SVG is scaled down.
const VARIANTS = [
  { file: 'icon-192.png', size: 192, scale: 1, bleed: false },
  { file: 'icon-512.png', size: 512, scale: 1, bleed: false },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72, bleed: true },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 0.86, bleed: true },
];

const svg = await readFile(`${ICONS_DIR}favicon.svg`, 'utf8');
const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
try {
  for (const { file, size, scale, bleed } of VARIANTS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * scale);
    await page.setContent(`<!doctype html>
      <html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;
        background:${bleed ? BACKGROUND : 'transparent'}">
        <img src="${svgDataUrl}" width="${inner}" height="${inner}" alt="">
      </body></html>`);
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: `${ICONS_DIR}${file}`, omitBackground: !bleed });
    await page.close();
    console.log(`icons/${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}

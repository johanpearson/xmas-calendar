// Downloads the woff2 files that @remotion/google-fonts points to into public/fonts/,
// so rendering does not depend on Chrome reaching fonts.gstatic.com (see README, "Antaganden").
import { mkdirSync, writeFileSync } from 'node:fs';
import { getInfo as cormorant } from '@remotion/google-fonts/CormorantGaramond';
import { getInfo as christmas } from '@remotion/google-fonts/MountainsofChristmas';

const WANT = [
  ['cormorant-italic-500', cormorant().fonts.italic['500'].latin],
  ['cormorant-italic-600', cormorant().fonts.italic['600'].latin],
  ['cormorant-normal-600', cormorant().fonts.normal['600'].latin],
  ['mountains-700', christmas().fonts.normal['700'].latin],
];
mkdirSync('public/fonts', { recursive: true });
for (const [name, url] of WANT) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(`public/fonts/${name}.woff2`, Buffer.from(await res.arrayBuffer()));
  console.log('saved', name);
}

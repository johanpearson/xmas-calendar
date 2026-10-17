// Arrangement B, "Julfilms-trailer med glimten i ögat" (39,2 s): deadpan bassoon, timpani hits on the
// cuts, pizzicato, rising strings, big clang under "ho ho ho".
//   node scripts/make-music-b.mjs  ->  public/music-b.wav
import { readFileSync } from 'node:fs';
import { CH, TUNES as U, createScore, midi, render, setupChannels } from './audio-lib.mjs';

const cues = JSON.parse(readFileSync(new URL('../src/v2/cues.json', import.meta.url)));
const c = cues.B;
const s = createScore(c.duration);
setupChannels(s);
const { BOX, HARP, TUBE, CELESTA, GLOCK, STRINGS, PIZZ, CHOIR, BASSOON, TIMP } = CH;
const hit = (t, v = 110) => { s.note(TIMP, midi('F2'), t, 1.2, v); s.note(TIMP, midi('C2'), t, 1.2, v - 10); };
const bass = (names, t0, step, vel = 74) => names.forEach((n, i) => s.note(PIZZ, midi(n), t0 + i * step, step * 0.5, vel));

// 0-3 s: drone and a single tolling bell
s.ramp(STRINGS, 0, 3, 0, 70);
s.chord(STRINGS, ['F2', 'C3', 'F3'], 0, 3.4, 54);
s.note(TUBE, midi('F4'), 0.5, 3, 80);
[1.4, 2.0, 2.5].forEach((t) => s.jb(t, 32));
// 3-6 s: three quick cuts: a ding on each, pizzicato run, riser
[3, 4, 5].forEach((t, i) => { s.note(GLOCK, midi(['F5', 'A5', 'C6'][i]), t, 0.8, 100); hit(t, 90 + i * 8); });
bass(['F2', 'F2', 'C3', 'C3', 'F2', 'F2', 'C3', 'G3', 'A3', 'C4', 'F4', 'A4'], 3.0, 0.25);
s.ramp(STRINGS, 3, 6, 40, 110); s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], 3.2, 2.9, 60);
// 6-8.8 s: chapter card
hit(6.0, 120); s.chord(TUBE, ['F3', 'C4', 'F4'], 6.0, 3, 100);
s.play(BOX, `${U.tusenPickup} ${U.tusen1}`, 6.6, 76, { vel: 80 });
// 8.8-12.8 s: workshop, deadpan bassoon "Hej tomtegubbar" with a glockenspiel answer
hit(8.8, 100);
s.play(BASSOON, U.hej, 9.1, 112, { vel: 92, shift: -24, stac: 0.3 });
s.play(GLOCK, U.hej, 11.0, 112, { vel: 70, stac: 0.2 });
bass(['F2', 'C3', 'F2', 'C3', 'Bb2', 'F3', 'Bb2', 'F3', 'C3', 'G3', 'C3', 'G3', 'F2', 'C3', 'F2', 'C3'], 8.9, 0.25, 70);
s.chord(STRINGS, ['F2', 'C3', 'A3'], 8.8, 4, 56);
// 12.8-15.6 s: chapter two: darker
hit(12.8, 124); s.chord(STRINGS, ['D2', 'A2', 'F3', 'D4'], 12.8, 3, 74); s.chord(TUBE, ['D3', 'F3', 'A3'], 12.85, 3, 76);
s.note(GLOCK, midi('A6'), 13.85, 1.2, 80);
// 15.6-19.8 s: tension, strings rise, pizzicato
s.ramp(STRINGS, 15.6, 19.8, 60, 120);
s.chord(STRINGS, ['D2', 'A2', 'F3', 'A3'], 15.6, 2, 66); s.chord(STRINGS, ['Bb2', 'F3', 'D4'], 17.6, 2.3, 74);
bass(['D3', 'A3', 'D3', 'A3', 'D3', 'A3', 'F3', 'A3', 'Bb2', 'F3', 'Bb2', 'F3', 'C3', 'G3', 'C3', 'G3'], 15.7, 0.25, 72);
for (let t = 18.6; t < 19.8; t += 0.15) s.note(TIMP, midi('C3'), t, 0.2, 60 + (t - 18.6) * 60);
// 19.8-23.8 s: "I år kommer julen i luckor": bright Jingle Bells
hit(19.8, 124); s.tree(19.8, 100);
s.play(CELESTA, `${U.jingle} ${U.jingle}`, 20.1, 150, { vel: 94, stac: 0.2 });
s.play(GLOCK, `${U.jingle} ${U.jingle}`, 20.1, 150, { vel: 72, shift: 12, stac: 0.2 });
s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], 19.8, 4, 82);
for (let t = 19.9; t < 23.8; t += 0.4) s.jb(t, 46);
bass(['F2', 'C3', 'F2', 'C3', 'F2', 'C3', 'G2', 'D3'], 20.1, 0.4, 76);
// 23.8-28.8 s: credits: warm, harp and strings with the theme, then a rising pulse
s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], 23.8, 3, 70); s.chord(STRINGS, ['Bb2', 'F3', 'D4', 'F4'], 26.6, 2.2, 74);
s.play(CELESTA, `${U.tusenPickup} ${U.tusen1}`, 24.1, 88, { vel: 84 });
[['F3', 'C4', 'A4', 'C5']].forEach((a) => { for (let i = 0; i < 12; i++) s.note(HARP, midi(a[i % 4]), 24 + i * 0.4, 0.9, 52); });
for (let t = 27.2, k = 0; t < 29.1; t += 0.2, k++) s.note(TIMP, midi('F2'), t, 0.2, 50 + k * 6);
s.ramp(STRINGS, 26.8, 29.2, 60, 127);
// 28.8-32 s: climax with the gnome
{
  const t0 = c.poff[0];
  hit(t0, 127); s.tree(t0, 110);
  s.chord(TUBE, ['F3', 'C4', 'F4', 'A4', 'C5'], t0, 7, 124); s.note(TUBE, midi('F5'), t0 + 0.03, 7, 110);
  s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], t0, 4, 96); s.chord(CHOIR, ['F3', 'A3', 'C4', 'F4'], t0, 3.6, 76);
  for (let k = 0; k < 10; k++) s.jb(c.hoho[0] + 0.25 + k * 0.11, 48);
  [['C6', 1.6], ['F6', 2.1]].forEach(([n, d]) => s.note(GLOCK, midi(n), t0 + d, 1.2, 70));
}
// 32-35.2 s: title: theme on celesta, big bell
{
  const tc = 32;
  s.chord(TUBE, ['F3', 'C4', 'F4', 'A4', 'C5'], tc, 8, 118); s.tree(tc, 90);
  s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], tc, 3.4, 80); s.chord(CHOIR, ['F3', 'A3', 'C4', 'F4'], tc, 3.2, 58);
  let t = s.play(CELESTA, U.tusenPickup, tc + 0.2, 100, { vel: 92 });
  t = s.play(CELESTA, U.tusen1, t, 100, { vel: 92 });
  s.note(CELESTA, midi('F5'), t, 3, 90);
  const roll = ['F3', 'C4', 'A4', 'C5', 'F5', 'C5', 'A4', 'C4'];
  for (let i = 0; i < 8; i++) s.note(HARP, midi(roll[i]), tc + 0.5 + i * 0.36, 1.1, 58);
}
// 35.2-39.2 s: final chord
{
  const t = 35.2;
  s.chord(STRINGS, ['F2', 'C3', 'G3', 'A3', 'C4'], t, 4, 56); s.chord(CHOIR, ['F3', 'A3', 'C4', 'G4'], t, 3.8, 44);
  ['F4', 'A4', 'C5', 'G5', 'F5'].forEach((n, i) => s.note(HARP, midi(n), t + 0.2 + i * 0.28, 2.2, 42));
  s.note(CELESTA, midi('C6'), t + 1.8, 2.0, 50);
}
render(s, { name: 'music-b', hoho: c.hoho, poff: [...c.poff, 6.0, 12.8, 19.8], ding: c.hints.map((h) => h.a + 0.05) });

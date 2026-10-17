// Arrangement A, "Klassisk julfilm" (39 s): calm, warm; music box, harp, celesta, strings.
//   node scripts/make-music-a.mjs  ->  public/music-a.wav
import { readFileSync } from 'node:fs';
import { CH, TUNES as U, createScore, midi, render, setupChannels } from './audio-lib.mjs';

const cues = JSON.parse(readFileSync(new URL('../src/v2/cues.json', import.meta.url)));
const c = cues.A;
const s = createScore(c.duration);
setupChannels(s);
const { BOX, HARP, TUBE, CELESTA, GLOCK, STRINGS, PIZZ, CHOIR } = CH;
const arp = (names, t0, step, vel) => names.forEach((n, i) => s.note(HARP, midi(n), t0 + i * step, 1.0, vel + (i % 4) * 3));
const F = ['F3', 'A3', 'C4', 'F4', 'A4', 'F4', 'C4', 'A3'], Bb = ['Bb2', 'D3', 'F3', 'Bb3', 'D4', 'Bb3', 'F3', 'D3'], C = ['C3', 'E3', 'G3', 'C4', 'E4', 'C4', 'G3', 'E3'];

// 0-5 s: pad and a glitter of bells, then the music box with "Nu tändas tusen juleljus"
s.ramp(STRINGS, 0, 4, 0, 80);
s.chord(STRINGS, ['F2', 'C3', 'F3', 'A3', 'C4'], 0, 10, 56);
[0.9, 1.5, 2.1, 2.6, 3.1, 3.7].forEach((t, i) => s.jb(t, 36 + (i % 3) * 8));
{
  let t = 2.2;
  t = s.play(BOX, U.tusenPickup, t, 84, { vel: 88 });
  t = s.play(BOX, `${U.tusen1}`, t, 84, { vel: 92 });
  s.note(BOX, midi('C5'), t - 0.01, 0.8, 50);
}
// 5-10 s: harp arpeggios under the closing-in town
[F, Bb, C, F].forEach((a, i) => arp(a, 5.2 + i * 2.5, 0.31, 50 + i * 2));
s.chord(STRINGS, ['Bb2', 'F3', 'D4', 'F4'], 7.7, 2.6, 46);
// 10-16 s: the workshop; celesta carries the second phrase, quiet pizzicato, a ding on each hint
s.ramp(STRINGS, 10, 16, 55, 80);
s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4'], 10, 3.2, 58); s.chord(STRINGS, ['Bb2', 'F3', 'D4'], 13.2, 3.4, 60);
s.play(CELESTA, `${U.tusen2}`, 10.6, 84, { vel: 80 });
s.play(GLOCK, `${U.tusen2}`, 10.6, 84, { vel: 56, shift: 12, stac: 0.4 });
['F2', 'C3', 'F2', 'C3', 'Bb2', 'F3', 'Bb2', 'F3', 'C3', 'G3', 'C3', 'G3'].forEach((n, i) => s.note(CH.PIZZ, midi(n), 10.4 + i * 0.5, 0.2, 66));
// 16-22.5 s: night street, slightly playful
s.ramp(STRINGS, 16, 22.5, 70, 95);
s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], 16.4, 3, 62); s.chord(STRINGS, ['C3', 'G3', 'E4', 'G4'], 19.4, 3.2, 62);
s.play(CELESTA, U.tusen3, 16.6, 90, { vel: 82 });
s.play(CELESTA, U.hej, 19.6, 120, { vel: 78, stac: 0.2 });
for (let t = 16.6; t < 22.4; t += 0.8) s.jb(t, 34);
// 22.5-27.5 s: the gnome peeks; tiptoeing pizzicato, bells, a clang under "ho ho ho"
['F3', 'A3', 'C4', 'A3', 'F3', 'A3', 'C4', 'F4'].forEach((n, i) => s.note(PIZZ, midi(n), 22.6 + i * 0.22, 0.14, 72));
s.note(TUBE, midi('F4'), c.hoho[0], 3, 85); s.tree(c.hoho[0] - 0.05, 80);
for (let k = 0; k < 8; k++) s.jb(c.hoho[0] + 0.2 + k * 0.12, 48);
s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4'], 24, 3.6, 56);
s.play(GLOCK, U.jingle, 25.6, 130, { vel: 70, stac: 0.2 });
// 27.5-31.5 s: doors glow, one by one
[0, 1, 2, 3, 4, 5].forEach((i) => s.note(CELESTA, midi(['F5', 'A5', 'C6', 'A5', 'C6', 'F6'][i]), 27.9 + i * 0.5, 1.2, 70));
s.chord(STRINGS, ['Bb2', 'F3', 'D4', 'F4'], 27.6, 2, 58); s.chord(STRINGS, ['C3', 'G3', 'E4', 'G4'], 29.6, 2, 62);
s.tree(28.0, 62); s.tree(30.2, 72);
// 31.5-35.3 s: title card: big clang and the theme
{
  const tc = 31.5;
  s.chord(TUBE, ['F3', 'C4', 'F4', 'A4', 'C5'], tc, 9, 124); s.note(TUBE, midi('F5'), tc + 0.03, 9, 106); s.tree(tc, 100);
  s.ramp(STRINGS, tc, 39, 105, 70);
  s.chord(STRINGS, ['F2', 'C3', 'A3', 'C4', 'F4'], tc, 3.5, 78); s.chord(STRINGS, ['Bb2', 'F3', 'D4', 'F4'], tc + 3.4, 2, 70);
  s.chord(CHOIR, ['F3', 'A3', 'C4', 'F4'], tc, 3.4, 60);
  let t = s.play(CELESTA, U.tusenPickup, tc + 0.2, 92, { vel: 92 });
  t = s.play(CELESTA, U.tusen1, t, 92, { vel: 92 });
  s.note(CELESTA, midi('F5'), t, 3.4, 90); s.note(CHOIR, midi('F4'), t, 3.8, 60);
  const roll = ['F3', 'C4', 'A4', 'C5', 'F5', 'C5', 'A4', 'C4'];
  for (let i = 0; i < 10; i++) s.note(HARP, midi(roll[i % 8]), tc + 0.5 + i * 0.36, 1.1, 58 + (i % 4) * 4);
  [['C6', 1.2], ['F6', 2.0], ['A6', 2.6]].forEach(([n, d]) => s.note(GLOCK, midi(n), tc + d, 1.5, 54));
}
// 35.3-39 s: last soft chord
{
  const t = 35.3;
  s.chord(STRINGS, ['F2', 'C3', 'G3', 'A3', 'C4'], t, 4, 54); s.chord(CHOIR, ['F3', 'A3', 'C4', 'G4'], t, 3.8, 44);
  ['F4', 'A4', 'C5', 'G5', 'F5'].forEach((n, i) => s.note(HARP, midi(n), t + 0.2 + i * 0.28, 2.2, 42));
  s.note(CELESTA, midi('C6'), t + 1.7, 2.0, 50);
}
render(s, { name: 'music-a', hoho: c.hoho, poff: c.poff, ding: c.hints.map((h) => h.a + 0.05) });

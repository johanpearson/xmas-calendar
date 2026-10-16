// Builds teaser/public/music.wav from a General MIDI arrangement rendered with FluidSynth
// and the FluidR3_GM SoundFont (MIT). Writes the MIDI itself (no npm dependency needed),
// renders it at 44.1 kHz stereo with built-in reverb and chorus, then fades (1 s in, 3 s out)
// and normalizes the peak to -3.5 dBFS.
//
//   apt-get install -y fluidsynth fluid-soundfont-gm
//   node scripts/make-music.mjs            (SOUNDFONT=/path/to.sf2 overrides the default)
//
// Times in the arrangement are written in the ORIGINAL manuscript time (intro 0-3 s) and
// shifted by SHIFT seconds, because the intro was lengthened by 2 s (see src/timing.ts).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOUNDFONT = process.env.SOUNDFONT || '/usr/share/sounds/sf2/FluidR3_GM.sf2';
const OUT = resolve(here, '../public/music.wav');
const MID = resolve(here, '../out/music.mid');
const SR = 44100;
const DURATION = 36; // seconds, must match src/timing.ts
const SHIFT = 2; // seconds added in front of the original manuscript timing
const T = (t) => t + SHIFT;
const PEAK_DB = -3.5;

// ---------------- tiny Standard MIDI File writer ----------------
const PPQ = 480; // at 120 bpm: 1 s = 960 ticks
const tick = (s) => Math.round(s * 960);
const events = []; // {t, order, bytes}
const push = (t, order, bytes) => events.push({ t: tick(t), order, bytes });
const prog = (ch, p) => push(0, 0, [0xc0 | ch, p]);
const cc = (ch, n, v, t = 0) => push(t, 1, [0xb0 | ch, n, Math.max(0, Math.min(127, Math.round(v)))]);
function note(ch, pitch, t, dur, vel = 80) {
  if (t < 0) return;
  push(t, 3, [0x90 | ch, pitch, Math.max(1, Math.min(127, Math.round(vel)))]);
  push(t + dur, 2, [0x80 | ch, pitch, 0]);
}
const vlq = (n) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
function writeMidi(path) {
  const body = [];
  body.push(0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20); // 120 bpm
  let last = 0;
  events.sort((a, b) => a.t - b.t || a.order - b.order);
  for (const e of events) {
    body.push(...vlq(e.t - last), ...e.bytes);
    last = e.t;
  }
  body.push(...vlq(Math.max(0, tick(DURATION) - last)), 0xff, 0x2f, 0); // end of track at DURATION
  const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255]);
  const trk = Buffer.concat([Buffer.from([0x4d, 0x54, 0x72, 0x6b]), Buffer.alloc(4), Buffer.from(body)]);
  trk.writeUInt32BE(body.length, 4);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([head, trk]));
}

// ---------------- notes and melodies ----------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (name) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
};
// "A5 A5:2 R" -> [{p, beats}] (R = rest)
const phrase = (str) =>
  str.split(/[\s|]+/).filter(Boolean).map((tok) => {
    const [n, b = '1'] = tok.split(':');
    return { p: n === 'R' ? null : midi(n), beats: Number(b) };
  });
// Plays a phrase from time t0 with a given bpm; returns the end time.
function play(ch, str, t0, bpm, { vel = 80, shift = 0, stac = 0, hold = 0.97 } = {}) {
  const spb = 60 / bpm;
  let t = t0;
  for (const { p, beats } of phrase(str)) {
    if (p != null) note(ch, p + shift, t, stac ? Math.min(stac, beats * spb * hold) : beats * spb * hold, vel);
    t += beats * spb;
  }
  return t;
}

// Public-domain tunes. Notes follow the app's js/melodies.js (an octave up, like a celesta).
const TUSEN = {
  pickup: 'C5',
  b1: 'A5 A5 G5 G5', b2: 'F5 D5 C5:1.5 C5:0.5', b3: 'D5 D5 G5 E5', b4: 'C5:2 R C5',
  b5: 'C6 C6 Bb5 Bb5', end: 'F5:4',
};
const HEJ = 'C6 G5:0.75 A5:0.25 G5:0.75 F5:0.25 | E5:0.75 F5:0.25 G5 C6:0.75 C6:0.25';
const JINGLE = 'E5 E5 E5:2 | E5 E5 E5:2';

// ---------------- channels / instruments (General MIDI, zero-based program numbers) ----------------
const BOX = 0, HARP = 1, TUBE = 2, CELESTA = 3, GLOCK = 4, STRINGS = 5, PIZZ = 6, CHOIR = 7, DRUMS = 9;
prog(BOX, 10); prog(HARP, 46); prog(TUBE, 14); prog(CELESTA, 8); prog(GLOCK, 9);
prog(STRINGS, 48); prog(PIZZ, 45); prog(CHOIR, 52);
const level = { [BOX]: 120, [HARP]: 105, [TUBE]: 110, [CELESTA]: 100, [GLOCK]: 85, [STRINGS]: 95, [PIZZ]: 100, [CHOIR]: 90, [DRUMS]: 70 };
for (const [ch, v] of Object.entries(level)) {
  cc(+ch, 7, v); cc(+ch, 11, 127); cc(+ch, 10, 64);
  cc(+ch, 91, ch == TUBE || ch == STRINGS || ch == CHOIR ? 95 : 70); // reverb send
  cc(+ch, 93, 45); // chorus send
}
cc(BOX, 10, 56); cc(HARP, 10, 78); cc(CELESTA, 10, 50); cc(GLOCK, 10, 78); cc(PIZZ, 10, 46);
const ramp = (ch, t0, t1, v0, v1) => { for (let t = t0; t <= t1; t += 0.2) cc(ch, 11, v0 + ((v1 - v0) * (t - t0)) / (t1 - t0), t); };
const jb = (t, v = 50) => note(DRUMS, 83, t, 0.3, v); // jingle bell
const tree = (t, v = 60) => note(DRUMS, 84, t, 0.8, v); // bell tree
const chord = (ch, pitches, t, dur, vel) => pitches.forEach((p, i) => note(ch, midi(p), t + i * 0.012, dur, vel));

// ---- 0-5 s (manuscript 0-3 s, intro lengthened): soft string pad and a glitter of jingle bells ----
ramp(STRINGS, 0, 3.6, 0, 80);
chord(STRINGS, ['F2', 'C3', 'F3', 'A3', 'C4'], 0, T(3.4), 62);
[0.9, 1.5, 2.1, 2.6, 3.1, 3.5, 4.1, 4.5].forEach((t, i) => jb(t, 38 + (i % 3) * 8));
ramp(STRINGS, T(3.4), T(5), 80, 40);

// ---- 3-8 s: music box, "Nu tändas tusen juleljus" (melody only) ----
{
  let t = T(3);
  t = play(BOX, TUSEN.pickup, t, 108, { vel: 88 });
  t = play(BOX, `${TUSEN.b1} ${TUSEN.b2}`, t, 108, { vel: 92 });
  note(BOX, midi('C5'), t - 0.01, 0.6, 50); // soft last tone, nothing else
}
ramp(STRINGS, T(5), T(8), 40, 55);
chord(STRINGS, ['F2', 'C3', 'A3'], T(5.4), 3.2, 45);

// ---- 8-13 s: harp arpeggios and one tubular bell for each candle ----
{
  const arps = [
    ['F3', 'A3', 'C4', 'F4', 'A4', 'F4', 'C4', 'A3'],
    ['Bb2', 'D3', 'F3', 'Bb3', 'D4', 'Bb3', 'F3', 'D3'],
    ['C3', 'E3', 'G3', 'C4', 'E4', 'C4', 'G3', 'E3'],
    ['F3', 'A3', 'C4', 'F4', 'A4', 'F4', 'C4', 'A3'],
  ];
  const step = 0.31;
  let t = T(8.05), n = 0;
  for (let bar = 0; bar < 4 && t < T(13); bar++) {
    for (const nm of arps[bar]) { note(HARP, midi(nm), t, 0.9, 50 + n * 1.8); t += step; n++; }
  }
  ['F4', 'A4', 'C5', 'F5'].forEach((nm, i) => {
    const tt = T(8.9 + i);
    note(TUBE, midi(nm), tt, 3.2, 96 + i * 5);
    jb(tt + 0.02, 40);
  });
  ramp(STRINGS, T(8), T(13), 55, 70);
  chord(STRINGS, ['F2', 'C3', 'A3', 'F4'], T(9), 4.2, 40);
}

// ---- 13-20 s: celesta + glockenspiel, growing strings, pizzicato rhythm ----
{
  const t0 = T(13) + 0.1;
  const th = `${TUSEN.b3} ${TUSEN.b4} ${TUSEN.b5}`;
  play(CELESTA, th, t0, 100, { vel: 84 });
  play(GLOCK, th, t0, 100, { vel: 64, shift: 12, stac: 0.45 });
  ramp(STRINGS, T(13), T(20), 25, 112);
  const pads = [['F2', 'C3', 'A3', 'C4', 'F4'], ['Bb2', 'F3', 'D4', 'F4'], ['C3', 'G3', 'E4', 'G4'], ['F2', 'C3', 'A3', 'C4', 'F4']];
  pads.forEach((c, i) => chord(STRINGS, c, T(13) + i * 1.75, 1.9, 60 + i * 9));
  const bass = ['F2', 'C3', 'F2', 'C3', 'Bb2', 'F3', 'Bb2', 'F3', 'C3', 'G3', 'C3', 'G3', 'F2', 'C3', 'F2', 'C3'];
  bass.forEach((nm, i) => note(PIZZ, midi(nm), T(13.3) + i * 0.4, 0.2, 78));
  for (let t = T(13.2); t < T(20); t += 0.8) jb(t, 36);
  tree(T(15.2), 62); tree(T(17.4), 72); tree(T(19.3), 84); // glitter as the doors glow
}

// ---- 20-25 s: playful staccato medley, "Hej tomtegubbar" + "Jingle Bells" ----
{
  const bpm = 168, spb = 60 / bpm;
  const t0 = T(20);
  const t1 = play(GLOCK, HEJ, t0, bpm, { vel: 92, stac: 0.2 });
  play(CELESTA, HEJ, t0, bpm, { vel: 70, shift: -12, stac: 0.2 });
  const t2 = play(CELESTA, JINGLE, t1, bpm, { vel: 96, stac: 0.2 });
  play(GLOCK, JINGLE, t1, bpm, { vel: 70, shift: 12, stac: 0.2 });
  for (let t = t0; t < t2; t += spb / 2) jb(t, 44 + ((t - t0) / spb % 1 === 0 ? 14 : 0));
  tree(t0, 60); tree(t1, 66); tree(T(24.4), 80);
  // light plucks on the beat under the medley
  for (let t = t0, i = 0; t < t2; t += spb * 2, i++) note(PIZZ, midi(i % 2 ? 'C3' : 'G2'), t, 0.18, 70);
}

// ---- 25-31 s: full orchestra, the theme, a big bell chime exactly when the title card appears ----
{
  const tc = T(25);
  chord(TUBE, ['F3', 'C4', 'F4', 'A4', 'C5'], tc, 9, 127); // the big clang
  note(TUBE, midi('F5'), tc + 0.03, 9, 110);
  tree(tc, 100);
  // strings and choir: long, soft pad that moves with the tune
  ramp(STRINGS, tc, T(34), 105, 80);
  const pads = [['F2', 'C3', 'A3', 'C4', 'F4'], ['Bb2', 'F3', 'D4', 'F4'], ['F2', 'C3', 'A3', 'C4', 'F4']];
  const edges = [0, 3.1, 5.6, 9];
  pads.forEach((c, i) => chord(STRINGS, c, tc + edges[i], edges[i + 1] - edges[i] + 0.3, 78));
  const choir = [['F3', 'A3', 'C4', 'F4'], ['Bb3', 'D4', 'F4'], ['F3', 'A3', 'C4', 'F4']];
  choir.forEach((c, i) => chord(CHOIR, c, tc + edges[i], edges[i + 1] - edges[i] + 0.3, 64));
  // theme on celesta (+ choir an octave down), the final F rings out
  const bpm = 96;
  let t = tc;
  t = play(CELESTA, TUSEN.pickup, t, bpm, { vel: 92 });
  t = play(CELESTA, `${TUSEN.b1} ${TUSEN.b2}`, t, bpm, { vel: 92 });
  note(CELESTA, midi('F5'), t, 3.4, 90);
  note(CHOIR, midi('F4'), t, 3.8, 62);
  // harp: rolling arpeggios across the title
  const roll = ['F3', 'C4', 'A4', 'C5', 'F5', 'C5', 'A4', 'C4'];
  for (let i = 0; i < 16; i++) note(HARP, midi(roll[i % 8]), tc + 0.5 + i * 0.36, 1.1, 58 + (i % 4) * 4);
  for (let k = 0; k < 10; k++) jb(tc + 0.3 + k * 0.55, 30);
  [['C6', 1.2], ['F6', 2.0], ['A6', 2.6], ['C7', 3.4]].forEach(([n, d]) => note(GLOCK, midi(n), tc + d, 1.5, 54));
}

// ---- 31-34 s: one last soft chord that fades out ----
{
  const t = T(31);
  chord(STRINGS, ['F2', 'C3', 'G3', 'A3', 'C4'], t, 5, 54);
  chord(CHOIR, ['F3', 'A3', 'C4', 'G4'], t, 4.6, 46);
  ['F4', 'A4', 'C5', 'G5', 'F5'].forEach((n, i) => note(HARP, midi(n), t + 0.2 + i * 0.28, 2.2, 42));
  note(CELESTA, midi('C6'), t + 1.7, 2.4, 52);
  note(CELESTA, midi('A5'), t + 2.1, 2.4, 44);
}

// ---------------- render with FluidSynth ----------------
if (!existsSync(SOUNDFONT)) throw new Error(`SoundFont not found: ${SOUNDFONT} (apt-get install fluid-soundfont-gm)`);
writeMidi(MID);
const RAW = resolve(here, '../out/music-raw.wav');
execFileSync('fluidsynth', [
  '-ni', '-T', 'wav', '-F', RAW, '-r', String(SR), '-g', '0.35',
  '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.78', '-o', 'synth.reverb.damp=0.35',
  '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.75',
  '-o', 'synth.chorus.active=1', '-o', 'synth.chorus.level=1.6', '-o', 'synth.chorus.depth=6', '-o', 'synth.chorus.nr=3',
  '-o', 'audio.file.endian=little', '-o', 'audio.file.format=s16',
  SOUNDFONT, MID,
], { stdio: 'inherit' });

// ---------------- fades, length and level ----------------
const wav = readFileSync(RAW);
let pos = 12, fmt = null, data = null;
while (pos < wav.length - 8) {
  const id = wav.toString('ascii', pos, pos + 4), size = wav.readUInt32LE(pos + 4);
  if (id === 'fmt ') fmt = { ch: wav.readUInt16LE(pos + 10), sr: wav.readUInt32LE(pos + 12), bits: wav.readUInt16LE(pos + 22) };
  if (id === 'data') { data = wav.subarray(pos + 8, Math.min(wav.length, pos + 8 + size)); break; }
  pos += 8 + size + (size & 1);
}
if (!fmt || !data || fmt.bits !== 16 || fmt.ch !== 2 || fmt.sr !== SR) throw new Error('unexpected FluidSynth output ' + JSON.stringify(fmt));
const N = SR * DURATION;
const L = new Float32Array(N), R = new Float32Array(N);
const have = Math.min(N, data.length >> 2);
for (let i = 0; i < have; i++) { L[i] = data.readInt16LE(i * 4) / 32768; R[i] = data.readInt16LE(i * 4 + 2) / 32768; }
const sm = (x) => x * x * (3 - 2 * x);
for (let i = 0; i < N; i++) {
  const s = i / SR;
  const g = sm(Math.min(1, s / 1)) * sm(Math.max(0, Math.min(1, (DURATION - s) / 3)));
  L[i] *= g; R[i] *= g;
}
// gentle peak limiter (fast attack, slow release) so the big bell clang does not push the rest of the mix down
{
  const thr = 0.22, rel = Math.exp(-1 / (SR * 0.35)), att = Math.exp(-1 / (SR * 0.002));
  let g = 1;
  for (let i = 0; i < N; i++) {
    const need = Math.min(1, thr / Math.max(1e-6, Math.abs(L[i]), Math.abs(R[i])));
    g = need < g ? need + (g - need) * att : 1 + (g - 1) * rel;
    L[i] *= g; R[i] *= g;
  }
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const k = Math.pow(10, PEAK_DB / 20) / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${DURATION}s, rendered ${(have / SR).toFixed(1)}s, raw peak ${peak.toFixed(2)}, scaled to ${PEAK_DB} dBFS`);

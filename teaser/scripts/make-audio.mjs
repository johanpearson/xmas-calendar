// Synthesizes teaser/public/music.wav (44.1 kHz, 16-bit stereo) with no samples or external deps.
// Cue times (seconds) are exported in CUES below and mirrored in src/timing.ts.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DURATION = 34; // seconds, must match src/timing.ts
const N = SR * DURATION;
const L = new Float32Array(N);
const R = new Float32Array(N);

const CUES = {
  music: 3, // music box starts
  candles: [8.9, 9.9, 10.9, 11.9], // candle lighting bells (8-13 s block)
  glitterGrid: 15.2, // glitter sweep as the doors glow
  montage: 20,
  title: 25, // clear chime as the title card appears
};

// ---- helpers ----
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const freq = (name) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (Number(m[3]) + 1) * 12 - 69) / 12);
};
function add(t0, dur, pan, gain, fn) {
  const i0 = Math.max(0, Math.floor(t0 * SR));
  const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = i0; i < i1; i++) {
    const v = fn((i - i0) / SR);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}
const TAU = Math.PI * 2;

// Music box / celesta tone: sine partials with fast-decaying upper partials.
function box(t0, f, len, gain, pan) {
  const dur = Math.min(len + 1.8, 3.2);
  add(t0, dur, pan, gain, (t) => {
    const a = Math.min(1, t / 0.003);
    const e1 = Math.exp(-t / 0.9), e2 = Math.exp(-t / 0.25), e3 = Math.exp(-t / 0.08);
    return a * (Math.sin(TAU * f * t) * e1 + 0.28 * Math.sin(TAU * f * 3.01 * t) * e2 + 0.12 * Math.sin(TAU * f * 5.43 * t) * e3);
  });
}
// Church-bell-like strike: inharmonic partials.
function bell(t0, f, gain, pan, decay = 2.2) {
  const P = [[1, 1], [2.0, 0.6], [2.76, 0.5], [4.07, 0.28], [5.4, 0.16]];
  add(t0, decay * 4, pan, gain, (t) => {
    const a = Math.min(1, t / 0.002);
    let s = 0;
    for (const [r, g] of P) s += g * Math.sin(TAU * f * r * t) * Math.exp(-t / (decay / (0.6 + r * 0.35)));
    return a * s;
  });
}
// Soft sleigh bells: bandpassed noise ring with a few metallic partials.
function jingle(t0, gain, pan) {
  const fs = [4100, 5300, 6700];
  const ph = fs.map(() => ((rnd()+1)/2) * TAU);
  add(t0, 0.45, pan, gain, (t) => {
    const a = Math.min(1, t / 0.002) * Math.exp(-t / 0.09);
    let s = 0;
    fs.forEach((f, k) => (s += Math.sin(TAU * f * t + ph[k])));
    return a * (s / 3 + 0.25 * rnd());
  });
}
function sparkle(t0, f, gain, pan) {
  add(t0, 0.9, pan, gain, (t) => Math.min(1, t / 0.001) * Math.exp(-t / 0.18) * (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.01 * t)));
}

// ---- melody: "Nu tändas tusen juleljus" (traditional; notes from the app's js/melodies.js, first two verses of the tune) ----
const MELODY = `C5 |
 A5 A5 G5 G5 | F5 D5 C5:1.5 C5:0.5 | D5 D5 G5 E5 | C5:2 R C5 |
 C6 C6 Bb5 Bb5 | A5 F5 D5:1.5 D5:0.5 | E5 E5 G5 G5 | F5:2`;
const BASS = 'R F2 Bb2 Bb2 C3 F2 F2 C3 F2'.split(/\s+/);
const BPM = 86;
const spb = 60 / BPM;
const bars = MELODY.split('|').map((b) => b.trim()).filter(Boolean);
let t = CUES.music;
bars.forEach((bar, bi) => {
  let bt = t;
  if (BASS[bi] && BASS[bi] !== 'R') box(t, freq(BASS[bi]) , 2.2, 0.10, -0.1);
  for (const tok of bar.split(/\s+/)) {
    const [name, b = '1'] = tok.split(':');
    const beats = Number(b);
    if (name !== 'R') {
      const f = freq(name);
      box(bt, f, beats * spb, 0.22, Math.max(-0.5, Math.min(0.5, (f - 700) / 1400)));
    }
    bt += beats * spb;
  }
  t = bt;
});

// ---- soft sleigh-bell layer: gentle off-beat pulses 3 s -> 25 s, a little denser in the montage ----
for (let s = CUES.music + 0.25; s < 25; s += spb / 2 * (s > CUES.montage ? 1 : 2)) {
  const g = 0.03 * (s < 5 ? (s - 3) / 2 : 1);
  jingle(s, Math.max(0.0, g), 0.3 * rnd());
}

// ---- bells when the four advent candles light (8-13 s) ----
const candleNotes = ['F5', 'A5', 'C6', 'F6'];
CUES.candles.forEach((c, i) => {
  bell(c, freq(candleNotes[i]), 0.2, -0.4 + i * 0.27);
  box(c + 0.02, freq(candleNotes[i]) * 2, 1, 0.07, 0.3);
});

// ---- glittering sweeps: grid (15-19 s) and the montage (20-24.5 s) ----
function sweep(start, end, density, gain) {
  const span = end - start;
  for (let s = start; s < end; s += 1 / density) {
    const p = (s - start) / span;
    const f = 1800 * Math.pow(2, p * 2.4) * (1 + 0.12 * ((rnd()+1)/2));
    sparkle(s + ((rnd()+1)/2) * 0.03, f, gain * Math.sin(Math.PI * Math.min(1, p * 0.9 + 0.1)), p * 1.6 - 0.8);
  }
}
sweep(CUES.glitterGrid, 19.5, 14, 0.045);
sweep(CUES.montage, 24.6, 10, 0.04);

// ---- title chime at 25 s with long, soft decay ----
const TITLE = CUES.title;
[['F4', 0.30], ['F5', 0.26], ['A5', 0.16], ['C6', 0.14], ['F6', 0.08]].forEach(([n, g], i) =>
  bell(TITLE + i * 0.04, freq(n), g, (i - 2) * 0.18, 6)
);
// airy pad under the chime
add(TITLE, 9, 0, 1, (t) => {
  const e = Math.min(1, t / 1.2) * Math.exp(-t / 3.5);
  return e * 0.05 * (Math.sin(TAU * freq('F3') * t) + Math.sin(TAU * freq('C4') * t * 1.002) + 0.6 * Math.sin(TAU * freq('A3') * t));
});
// twinkles around the title
for (let k = 0; k < 14; k++) sparkle(TITLE + 0.5 + k * 0.28 + ((rnd()+1)/2) * 0.1, 2400 + ((rnd()+1)/2) * 2400, 0.03, rnd() * 0.7);

// ---- simple stereo reverb (Schroeder combs + allpasses) ----
function reverb(buf, wet, delays) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const fb = 0.78;
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < N; i++) {
      const y = line[p];
      line[p] = buf[i] + y * fb * 0.96 + (i > 0 ? 0 : 0);
      out[i] += y;
      p = (p + 1) % d;
    }
  }
  for (let i = 0; i < N; i++) buf[i] += (out[i] / delays.length) * wet;
}
reverb(L, 0.9, [1687, 2053, 2381, 2713]);
reverb(R, 0.9, [1759, 2111, 2437, 2791]);

// ---- fades, normalization to -3.5 dBFS peak ----
const FADE_IN = 1, FADE_OUT = 3;
for (let i = 0; i < N; i++) {
  const s = i / SR;
  const g = Math.min(1, s / FADE_IN) * Math.min(1, (DURATION - s) / FADE_OUT);
  const sm = g * g * (3 - 2 * g);
  L[i] *= sm; R[i] *= sm;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = Math.pow(10, -3.5 / 20);
const k = target / peak;
const pcm = Buffer.alloc(N * 4 + 44);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4);
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/music.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, pcm);
console.log(`wrote ${out}: ${DURATION}s, peak ${(20 * Math.log10(target)).toFixed(1)} dBFS (raw peak ${peak.toFixed(2)})`);

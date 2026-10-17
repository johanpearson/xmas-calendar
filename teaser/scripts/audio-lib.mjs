// Shared audio chain for the v2 films: General MIDI score -> FluidSynth (FluidR3_GM, MIT, built-in
// reverb and chorus) -> soft limiter -> ffmpeg mix with the "ho ho ho" sample, "ding" and "poff"
// effects -> 1 s fade in, 3 s fade out, peak normalised to -3.5 dBFS.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SOUNDFONT = process.env.SOUNDFONT || '/usr/share/sounds/sf2/FluidR3_GM.sf2';
const SR = 44100;
const PEAK_DB = -3.5;

export const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midi = (name) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
};
const vlq = (n) => { const o = [n & 0x7f]; while ((n >>= 7)) o.unshift((n & 0x7f) | 0x80); return o; };

// Public-domain tunes (melody only). Notes follow js/melodies.js in the app.
export const TUNES = {
  tusenPickup: 'C5',
  tusen1: 'A5 A5 G5 G5 F5 D5 C5:1.5 C5:0.5',
  tusen2: 'D5 D5 G5 E5 C5:2 R C5',
  tusen3: 'C6 C6 Bb5 Bb5',
  hej: 'C6 G5:0.75 A5:0.25 G5:0.75 F5:0.25 | E5:0.75 F5:0.25 G5 C6:0.75 C6:0.25',
  jingle: 'E5 E5 E5:2 | E5 E5 E5:2',
};

export function createScore(duration) {
  const events = [];
  const tick = (s) => Math.round(s * 960);
  const push = (t, order, bytes) => events.push({ t: tick(t), order, bytes });
  const api = {
    duration,
    prog: (ch, p) => push(0, 0, [0xc0 | ch, p]),
    cc: (ch, n, v, t = 0) => push(t, 1, [0xb0 | ch, n, Math.max(0, Math.min(127, Math.round(v)))]),
    note(ch, pitch, t, dur, vel = 80) {
      if (t < 0 || t >= duration) return;
      push(t, 3, [0x90 | ch, pitch, Math.max(1, Math.min(127, Math.round(vel)))]);
      push(t + dur, 2, [0x80 | ch, pitch, 0]);
    },
    chord(ch, names, t, dur, vel) { names.forEach((n, i) => api.note(ch, midi(n), t + i * 0.012, dur, vel)); },
    play(ch, str, t0, bpm, { vel = 80, shift = 0, stac = 0, hold = 0.97 } = {}) {
      const spb = 60 / bpm; let t = t0;
      for (const tok of str.split(/[\s|]+/).filter(Boolean)) {
        const [n, b = '1'] = tok.split(':'); const beats = Number(b);
        if (n !== 'R') api.note(ch, midi(n) + shift, t, stac ? Math.min(stac, beats * spb * hold) : beats * spb * hold, vel);
        t += beats * spb;
      }
      return t;
    },
    ramp(ch, t0, t1, v0, v1) { for (let t = t0; t <= t1; t += 0.2) api.cc(ch, 11, v0 + ((v1 - v0) * (t - t0)) / (t1 - t0), t); },
    jb: (t, v = 50) => api.note(9, 83, t, 0.3, v), // jingle bell
    tree: (t, v = 60) => api.note(9, 84, t, 0.8, v), // bell tree
    write(path) {
      const body = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20];
      let last = 0;
      events.sort((a, b) => a.t - b.t || a.order - b.order);
      for (const e of events) { body.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
      body.push(...vlq(Math.max(0, tick(duration) - last)), 0xff, 0x2f, 0);
      const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 480 >> 8, 480 & 255]);
      const trk = Buffer.concat([Buffer.from([0x4d, 0x54, 0x72, 0x6b]), Buffer.alloc(4), Buffer.from(body)]);
      trk.writeUInt32BE(body.length, 4);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.concat([head, trk]));
    },
  };
  return api;
}

/** Standard channel setup used by both arrangements. */
export const CH = { BOX: 0, HARP: 1, TUBE: 2, CELESTA: 3, GLOCK: 4, STRINGS: 5, PIZZ: 6, CHOIR: 7, BASSOON: 8, DRUMS: 9, TIMP: 10 };
export function setupChannels(s) {
  const P = { [CH.BOX]: 10, [CH.HARP]: 46, [CH.TUBE]: 14, [CH.CELESTA]: 8, [CH.GLOCK]: 9, [CH.STRINGS]: 48, [CH.PIZZ]: 45, [CH.CHOIR]: 52, [CH.BASSOON]: 70, [CH.TIMP]: 47 };
  for (const [ch, p] of Object.entries(P)) s.prog(+ch, p);
  const level = { [CH.BOX]: 120, [CH.HARP]: 105, [CH.TUBE]: 110, [CH.CELESTA]: 100, [CH.GLOCK]: 85, [CH.STRINGS]: 95, [CH.PIZZ]: 100, [CH.CHOIR]: 90, [CH.BASSOON]: 100, [CH.DRUMS]: 70, [CH.TIMP]: 115 };
  for (const [ch, v] of Object.entries(level)) {
    s.cc(+ch, 7, v); s.cc(+ch, 11, 127); s.cc(+ch, 10, 64);
    s.cc(+ch, 91, [CH.TUBE, CH.STRINGS, CH.CHOIR, CH.TIMP].includes(+ch) ? 95 : 70);
    s.cc(+ch, 93, 45);
  }
  s.cc(CH.BOX, 10, 56); s.cc(CH.HARP, 10, 78); s.cc(CH.CELESTA, 10, 50); s.cc(CH.GLOCK, 10, 78); s.cc(CH.PIZZ, 10, 46); s.cc(CH.BASSOON, 10, 40);
}

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
/**
 * Renders the score and mixes the effects.
 * hoho: seconds where the "ho ho ho" sample starts; poff: seconds for a "poff"; ding: seconds for a high "ding".
 */
export function render(score, { name, hoho = [], poff = [], ding = [] }) {
  if (!existsSync(SOUNDFONT)) throw new Error(`SoundFont not found: ${SOUNDFONT} (apt-get install fluid-soundfont-gm)`);
  const D = score.duration;
  const tmp = resolve(root, 'out/tmp'); mkdirSync(tmp, { recursive: true });
  const mid = resolve(tmp, `${name}.mid`), raw = resolve(tmp, `${name}-raw.wav`), lim = resolve(tmp, `${name}-lim.wav`), mix = resolve(tmp, `${name}-mix.wav`);
  score.write(mid);
  execFileSync('fluidsynth', [
    '-ni', '-T', 'wav', '-F', raw, '-r', String(SR), '-g', '0.35',
    '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.78', '-o', 'synth.reverb.damp=0.35', '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.75',
    '-o', 'synth.chorus.active=1', '-o', 'synth.chorus.level=1.6', '-o', 'synth.chorus.depth=6', '-o', 'synth.chorus.nr=3',
    '-o', 'audio.file.endian=little', '-o', 'audio.file.format=s16', SOUNDFONT, mid,
  ], { stdio: 'ignore' });
  // poff: a short, soft puff of low-passed noise
  const poffWav = resolve(tmp, 'poff.wav');
  sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.35:c=pink:a=0.9:r=44100', '-af', 'lowpass=f=1400,highpass=f=120,afade=t=in:d=0.01,afade=t=out:st=0.04:d=0.3,volume=0.9,aformat=channel_layouts=stereo', poffWav]);
  const dingWav = resolve(tmp, 'ding.wav');
  sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=f=2093:d=1.2:r=44100', '-f', 'lavfi', '-i', 'sine=f=3136:d=1.2:r=44100', '-filter_complex', '[0][1]amix=inputs=2:weights=1 0.4:normalize=0,afade=t=in:d=0.004,afade=t=out:st=0.02:d=1.1,volume=0.5,aformat=channel_layouts=stereo', dingWav]);
  const hohoFile = resolve(root, 'public/hohoho.mp3');
  // pass 1: music with a gentle limiter, normalised to a quiet bed so that the effects sit on top
  sh('ffmpeg', ['-y', '-i', raw, '-af', `atrim=0:${D},apad=whole_dur=${D},alimiter=limit=0.25:attack=2:release=350:level=disabled`, '-ar', String(SR), lim]);
  const inputs = ['-i', lim];
  const filters = ['[0:a]volume=0.9[m]']; const labels = ['[m]'];
  let n = 1;
  const addAt = (file, times, chain, label) => {
    for (const t of times) {
      inputs.push('-i', file);
      filters.push(`[${n}:a]aformat=channel_layouts=stereo,${chain},adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}[${label}${n}]`);
      labels.push(`[${label}${n}]`); n++;
    }
  };
  // "ho ho ho" with a short echo and a soft bell tone underneath (the bell comes from the score)
  addAt(hohoFile, hoho, 'volume=1.6,aecho=0.8:0.55:140|290:0.35|0.18', 'h');
  addAt(poffWav, poff, 'volume=0.8', 'p');
  addAt(dingWav, ding, 'volume=0.35', 'd');
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first,atrim=0:${D},afade=t=in:st=0:d=1,afade=t=out:st=${D - 3}:d=3[out]`);
  sh('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', String(SR), '-ac', '2', mix]);
  // normalise to the target peak
  const m = /max_volume: (-?[\d.]+) dB/.exec(volStats(mix));
  const gain = PEAK_DB - parseFloat(m[1]);
  const out = resolve(root, `public/${name}.wav`);
  sh('ffmpeg', ['-y', '-i', mix, '-af', `volume=${gain.toFixed(3)}dB`, '-c:a', 'pcm_s16le', out]);
  console.log(`${name}: wrote ${out}, gain ${gain.toFixed(2)} dB, final`, /max_volume: (-?[\d.]+) dB/.exec(volStats(out))[0]);
}
function volStats(file) {
  return spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
}

// Voices and creaks, rendered sample by sample into plain arrays (pure logic, testable
// with node --test; audio.js turns them into AudioBuffers).
//
// Oscillators with straight-line ramps sound mechanical, because nothing in them ever
// wavers. These are built the way a voice is: a train of glottal pulses whose pitch and
// loudness wobble a little from cycle to cycle, breath noise, and resonators for the
// vocal tract (a Klatt-style cascade of formants) that move smoothly between vowels.

// A curve [[time, value], ...] read at time t, eased (cosine) between its points.
export function curveAt(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return v0 + ((v1 - v0) * (1 - Math.cos(Math.PI * k))) / 2;
    }
  }
  return points.at(-1)[1];
}

// A slow random wobble between -1 and 1: new random targets `hz` times a second, eased.
function wobble(rate, hz, random) {
  const step = Math.max(1, Math.round(rate / hz));
  let from = 0;
  let to = random() * 2 - 1;
  let i = 0;
  return () => {
    if (i === step) {
      i = 0;
      from = to;
      to = random() * 2 - 1;
    }
    const k = i++ / step;
    return from + ((to - from) * (1 - Math.cos(Math.PI * k))) / 2;
  };
}

// A two-pole resonator (Klatt): unity gain at 0 Hz, a peak at f with bandwidth bw.
function resonator(rate) {
  let y1 = 0;
  let y2 = 0;
  let a = 1;
  let b = 0;
  let c = 0;
  return {
    tune(f, bw) {
      c = -Math.exp((-2 * Math.PI * bw) / rate);
      b = 2 * Math.exp((-Math.PI * bw) / rate) * Math.cos((2 * Math.PI * f) / rate);
      a = 1 - b - c;
    },
    run(x) {
      const y = a * x + b * y1 + c * y2;
      y2 = y1;
      y1 = y;
      return y;
    },
  };
}

// The glottal flow over one cycle (Rosenberg): opens smoothly, closes quickly, rests.
function glottis(phase) {
  const open = 0.4;
  const close = 0.16;
  if (phase < open) return 0.5 * (1 - Math.cos((Math.PI * phase) / open));
  if (phase < open + close) return Math.cos((Math.PI * (phase - open)) / (2 * close));
  return 0;
}

// Removes the 0 Hz offset and rumble, then scales the loudest sample to 1.
function finish(data, rate, highpass = 80) {
  const k = Math.exp((-2 * Math.PI * highpass) / rate);
  let prevIn = 0;
  let prevOut = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const y = k * (prevOut + data[i] - prevIn);
    prevIn = data[i];
    prevOut = y;
    data[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return data;
}

/**
 * Renders a voice. All curves are [[seconds, value], ...]:
 *  f0        pitch in Hz             voicing  0-1, how much the vocal folds sing
 *  breath    0-1, breath noise       formants [{ f: curve, bw: curve }] (Hz)
 *  jitter    pitch wobble (0.01 = 1 %)          shimmer  loudness change per cycle
 *  vibrato   { rate, depth } (depth 0.01 = 1 %)
 * Returns a Float32Array scaled to a peak of 1.
 */
export function renderVoice(spec, { rate = 44100, random = Math.random } = {}) {
  const { dur, f0, voicing, breath, formants, jitter = 0.01, shimmer = 0.05, vibrato = { rate: 5, depth: 0.008 } } = spec;
  const data = new Float32Array(Math.ceil(dur * rate));
  const drift = wobble(rate, 9, random);
  const flutter = wobble(rate, 31, random);
  const tract = formants.map(() => resonator(rate));
  let phase = 0;
  let previous = 0;
  let cycleLevel = 1;
  for (let n = 0; n < data.length; n++) {
    const t = n / rate;
    if (n % 32 === 0) formants.forEach(({ f, bw }, i) => tract[i].tune(curveAt(f, t), curveAt(bw, t)));
    const pitch = curveAt(f0, t) * (1 + vibrato.depth * Math.sin(2 * Math.PI * vibrato.rate * t) + jitter * (0.7 * drift() + 0.3 * flutter()));
    phase += pitch / rate;
    if (phase >= 1) {
      phase -= 1;
      cycleLevel = 1 + shimmer * (random() * 2 - 1);
    }
    const flow = glottis(phase);
    // The radiated sound is the change in flow, normalised so its level hardly depends on pitch.
    const voiced = (flow - previous) * (rate / (4 * pitch)) * cycleLevel * curveAt(voicing, t);
    previous = flow;
    const v = curveAt(voicing, t);
    // Breath noise, pulsing with the vocal folds while they sing.
    const noise = (random() * 2 - 1) * curveAt(breath, t) * (1 - 0.6 * v + 0.6 * v * flow);
    let x = voiced + noise;
    for (const r of tract) x = r.run(x);
    data[n] = x;
  }
  return finish(data, rate);
}

// Tomten's "ho ho ho": a deep, warm voice. Each syllable starts with a breathy "h" (breath
// through the shape of the coming vowel, which is what an "h" is) and falls in pitch.
export function hoSpec() {
  const syllables = [[0, 118, 0.27, 1], [0.32, 110, 0.27, 0.82], [0.64, 101, 0.48, 0.7]];
  const f0 = [];
  const voicing = [[0, 0]];
  const breath = [[0, 0]];
  for (const [start, pitch, length, level] of syllables) {
    breath.push([start + 0.005, 0], [start + 0.03, 0.4 * level], [start + 0.075, 0.32 * level], [start + 0.12, 0.07 * level], [start + length - 0.04, 0.05 * level], [start + length, 0]);
    voicing.push([start + 0.05, 0], [start + 0.11, level], [start + length * 0.6, 0.8 * level], [start + length, 0]);
    f0.push([start + 0.05, pitch * 1.04], [start + 0.13, pitch], [start + length, pitch * 0.82]);
  }
  return {
    dur: 1.2,
    f0,
    voicing,
    breath,
    jitter: 0.012,
    shimmer: 0.06,
    vibrato: { rate: 5.2, depth: 0.012 },
    // An "o" that rounds off a little towards "u" at the end of the laugh.
    formants: [
      { f: [[0, 490], [1.2, 430]], bw: [[0, 80]] },
      { f: [[0, 850], [1.2, 770]], bw: [[0, 90]] },
      { f: [[0, 2550]], bw: [[0, 140]] },
      { f: [[0, 3350]], bw: [[0, 250]] },
    ],
  };
}

// A cat's "mjau": a high, slightly rough voice that opens from a closed "m" into "iaa"
// and rounds off into "ow" while its pitch rises and falls.
export function catSpec() {
  return {
    dur: 0.9,
    f0: [[0, 500], [0.12, 640], [0.3, 780], [0.5, 730], [0.75, 560], [0.9, 470]],
    voicing: [[0, 0], [0.06, 0.6], [0.15, 1], [0.6, 0.85], [0.9, 0]],
    breath: [[0, 0.02], [0.2, 0.05], [0.7, 0.08], [0.9, 0]],
    jitter: 0.02,
    shimmer: 0.08,
    vibrato: { rate: 6, depth: 0.012 },
    formants: [
      { f: [[0, 400], [0.12, 720], [0.28, 1100], [0.55, 950], [0.8, 650], [0.9, 600]], bw: [[0, 160], [0.2, 110]] },
      { f: [[0, 1500], [0.12, 2300], [0.28, 2050], [0.55, 1500], [0.8, 1100]], bw: [[0, 150]] },
      { f: [[0, 3000], [0.3, 3300], [0.9, 3000]], bw: [[0, 220]] },
      { f: [[0, 4500]], bw: [[0, 320]] },
    ],
  };
}

/**
 * A creaking door: stick and slip. Each slip is a click that rings a few of the wood's
 * resonances (every click a little different); the clicks come slowly, then quickly
 * (a rising squeak), then slow down as the door stops, never quite evenly.
 */
export function renderCreak({ rate = 44100, random = Math.random } = {}) {
  const dur = 1.05;
  const data = new Float32Array(Math.ceil(dur * rate));
  const clicksPerSecond = [[0, 25], [0.12, 45], [0.25, 35], [0.42, 140], [0.55, 300], [0.68, 340], [0.8, 220], [0.92, 90], [1.0, 40]];
  const swell = [[0, 0], [0.05, 0.6], [0.3, 0.5], [0.55, 1], [0.8, 0.8], [1.0, 0]];
  const modes = [[480, 0.6, 0.006], [1050, 1, 0.004], [1700, 0.7, 0.003], [2600, 0.4, 0.002], [3800, 0.2, 0.0015]];
  const length = Math.floor(rate * 0.025);
  const kernels = Array.from({ length: 8 }, () => {
    const parts = modes.map(([f, level, tau]) => [2 * Math.PI * f * (0.96 + 0.08 * random()), level * (0.7 + 0.3 * random()), tau]);
    return Float32Array.from({ length }, (_, i) => parts.reduce((sum, [w, level, tau]) => sum + level * Math.sin((w * i) / rate) * Math.exp(-i / (tau * rate)), 0));
  });
  const speed = wobble(rate, 6, random);
  const loud = wobble(rate, 11, random);
  let next = 0.01;
  for (let n = 0; n < data.length; n++) {
    const s = speed();
    const l = loud();
    const t = n / rate;
    if (t < next) continue;
    const kernel = kernels[Math.floor(random() * kernels.length)];
    const amp = curveAt(swell, t / dur) * (0.75 + 0.25 * l) * (0.8 + 0.2 * random());
    for (let i = 0; i < length && n + i < data.length; i++) data[n + i] += amp * kernel[i];
    next = t + (1 / (curveAt(clicksPerSecond, t / dur) * (1 + 0.1 * s))) * (0.92 + 0.16 * random());
  }
  return finish(data, rate, 150);
}

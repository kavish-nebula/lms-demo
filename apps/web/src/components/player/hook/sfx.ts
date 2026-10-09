/**
 * Small sound effects for the hook film, made in the browser with Web Audio:
 * no files to load. Quiet next to the narration, and silent until the learner
 * has pressed Begin (browsers only allow sound after a click).
 */
export type Sfx = {
  pop: () => void;
  ping: () => void;
  tick: () => void;
  thud: () => void;
  alarm: () => void;
  whoosh: () => void;
};

let ctx: AudioContext | null = null;
let lastTick = 0;

/** Call from a click handler so the audio context may start. */
export function unlockSfx() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, seconds: number, opts: { type?: OscillatorType; gain?: number; delay?: number; to?: number } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + seconds);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.05, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

function noise(seconds: number, gain: number) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(600, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + seconds);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start();
}

const live: Sfx = {
  pop: () => tone(740, 0.09, { gain: 0.04, to: 980 }),
  ping: () => {
    tone(988, 0.14, { gain: 0.05 });
    tone(1319, 0.22, { gain: 0.04, delay: 0.09 });
  },
  tick: () => {
    const now = performance.now();
    if (now - lastTick < 70) return; // a counter rolling fast must not turn into a buzz
    lastTick = now;
    tone(2100, 0.025, { type: "square", gain: 0.012 });
  },
  thud: () => tone(120, 0.32, { gain: 0.14, to: 48 }),
  alarm: () => {
    tone(523, 0.16, { type: "triangle", gain: 0.05 });
    tone(415, 0.24, { type: "triangle", gain: 0.05, delay: 0.17 });
  },
  whoosh: () => noise(0.35, 0.05),
};

const silent: Sfx = { pop() {}, ping() {}, tick() {}, thud() {}, alarm() {}, whoosh() {} };

export function sfxFor(on: boolean): Sfx {
  return on ? live : silent;
}

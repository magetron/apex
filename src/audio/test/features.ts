/**
 * Engine-sound features, measured the same way on real recordings (in the browser, from a decoded
 * file) and on our synth (in Node): where the firing note is, how its orders and harmonics
 * stand, how much lope rides under it, how the spectrum tilts, and how tonal it is. No DOM, no
 * fixed sample rate.
 */

/** In-place radix-2 FFT (re/im of length 2^n). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Hann-windowed magnitude spectrum of x[start, start+n) (n a power of two), bins of fs/n. */
export function magnitudes(x: Float32Array, start: number, n: number) {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++)
    re[i] = (x[start + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const m = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

/** Hann-windowed amplitude at one frequency over [start, end) (Goertzel). */
export function amplitude(x: Float32Array, fs: number, hz: number, start: number, end: number) {
  const n = end - start;
  const c = 2 * Math.cos((2 * Math.PI * hz) / fs);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = x[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return (4 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2))) / n;
}

export interface Features {
  rpm: number;
  /** each half order 0.5 … 4F, dB re the firing line */
  orders: { k: number; db: number }[];
  /** orders 0.5 and 1 (a revolution-long lope), dB re the firing line */
  lope: number;
  /** every order below the firing line, dB re it */
  sub: number;
  /** firing harmonics 2F, 3F, 4F, dB re the firing line */
  harmonics: number;
  /** slope of the firing harmonics' amplitudes, dB per octave (F … 8F, below 5 kHz) */
  rolloff: number;
  /** share of the 100 Hz–3 kHz power on the half-order lines (1 = pure tones) */
  tonal: number;
  /** octave bands 125 Hz … 8 kHz, dB re the loudest */
  bands: number[];
}

const db = (p: number) => 10 * Math.log10(Math.max(p, 1e-30));

/** Features of x[t0, t1) s at steady rpm, for an engine with firing order F (cylinders / 2). */
export function features(
  x: Float32Array,
  fs: number,
  rpm: number,
  F: number,
  t0: number,
  t1: number,
): Features {
  const a = Math.max(0, Math.round(t0 * fs));
  const b = Math.min(x.length, Math.round(t1 * fs));
  const amp = (k: number) => amplitude(x, fs, (k * rpm) / 60, a, b);
  const line = amp(F) ** 2;
  const orders: { k: number; db: number }[] = [];
  for (let k = 0.5; k <= 4 * F + 1e-9; k += 0.5)
    if ((k * rpm) / 60 < fs / 2.2) orders.push({ k, db: db(amp(k) ** 2 / line) });
  const p = (ks: number[]) => ks.reduce((s, k) => s + amp(k) ** 2, 0) / line;
  const subs: number[] = [];
  for (let k = 0.5; k < F; k += 0.5) subs.push(k);
  const harm: [number, number][] = [];
  for (let m = 1; m <= 8 && (m * F * rpm) / 60 < 5000; m++)
    harm.push([Math.log2(m), db(amp(m * F) ** 2) / 2]);
  // least-squares slope of the harmonic levels against octaves
  const mx = harm.reduce((s, h) => s + h[0], 0) / harm.length;
  const my = harm.reduce((s, h) => s + h[1], 0) / harm.length;
  const rolloff =
    harm.length > 1
      ? (2 * harm.reduce((s, h) => s + (h[0] - mx) * (h[1] - my), 0)) /
        harm.reduce((s, h) => s + (h[0] - mx) ** 2, 0)
      : 0;
  // power on the lines vs all power, 100 Hz – 3 kHz (Hann: line power ≈ amp²/2 · n·3/8 per bin)
  let n = 1;
  while (n * 2 <= b - a) n <<= 1;
  const m = magnitudes(x, a, n);
  const binHz = fs / n;
  let all = 0;
  let onLines = 0;
  const lineHz: number[] = [];
  for (let k = 0.5; (k * rpm) / 60 < 3000; k += 0.5) lineHz.push((k * rpm) / 60);
  for (let i = 1; i < m.length; i++) {
    const hz = i * binHz;
    if (hz < 100 || hz > 3000) continue;
    const pw = m[i] * m[i];
    all += pw;
    if (lineHz.some((f) => Math.abs(f - hz) <= 2 * binHz)) onLines += pw;
  }
  const bands = [125, 250, 500, 1000, 2000, 4000, 8000].map((c) => {
    let s = 0;
    for (let i = 1; i < m.length; i++) {
      const hz = i * binHz;
      if (hz >= c / Math.SQRT2 && hz < c * Math.SQRT2) s += m[i] * m[i];
    }
    return s;
  });
  const top = Math.max(...bands);
  return {
    rpm,
    orders,
    lope: db(p([0.5, 1])),
    sub: db(p(subs)),
    harmonics: db(p([2 * F, 3 * F, 4 * F])),
    rolloff,
    tonal: onLines / all,
    bands: bands.map((s) => db(s / top)),
  };
}

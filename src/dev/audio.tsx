/**
 * #/dev/audio — WP4 sound lab: pick an engine or motor for A and B, set rpm/throttle, toggle
 * add-ons, flip A/B at the same operating point, and watch the spectrum with crank-order ticks.
 * Below it, both voices rendered offline at that operating point and compared order by order,
 * so a difference can be checked without listening; and a real recording (test/real.ts, fetched
 * from Wikimedia Commons into memory, never saved) measured the same way next to its catalog
 * engine, with a button to hear the stretch analysed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dock, Panel, Segmented, Select, Slider, Stat, Stats } from '../app/ui';
import {
  defaultAddons,
  isMotor,
  SoundControls,
  useEngineAudio,
  voiceConfig,
  type SoundSource,
} from '../audio';
import { firingOrder } from '../audio/config';
import { createVoice } from '../audio/dsp/voice';
import { audioHost, existingHost } from '../audio/host';
import { features, type Features } from '../audio/test/features';
import { REAL } from '../audio/test/real';
import { getEngine, getMotor, listEngines, listMotors } from '../spec/catalog';
import '../audio/sound.css';

type Slot = 'A' | 'B';

const OPTIONS = [
  ...listEngines().map((e) => ({ value: `e:${e.id}`, label: e.name })),
  ...listMotors().map((m) => ({ value: `m:${m.id}`, label: `${m.name} (EV)` })),
];

const resolve = (key: string): SoundSource =>
  key.startsWith('m:') ? getMotor(key.slice(2)) : getEngine(key.slice(2));

const maxRpm = (s: SoundSource) => (isMotor(s) ? s.maxRpm : s.redlineRpm);
const minRpm = (s: SoundSource) => (isMotor(s) ? 0 : s.idleRpm);
/** firing frequency in crank orders (cylinders / 2, rotors), or the motor's electrical order × 6 */
const mainOrder = (s: SoundSource) => (isMotor(s) ? 6 * s.sound.polePairs : firingOrder(s));

/** Re-render ~10×/s with the live input (blips and sweeps move it outside React). */
function useLive(input: { rpm: number; throttle: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  return input;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Live spectrum of the master output, 0–2 kHz, with ticks at every half crank order. */
function Spectrum({ input, order }: { input: { rpm: number }; order: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    let raf = 0;
    let data: Float32Array<ArrayBuffer> | null = null;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = Math.round(canvas.clientWidth * devicePixelRatio);
      const h = Math.round(canvas.clientHeight * devicePixelRatio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      g.clearRect(0, 0, w, h);
      const maxHz = 2000;
      const faint = cssVar('--line-strong');
      const accent = cssVar('--accent');
      const amber = cssVar('--warn');
      const half = input.rpm / 120;
      // half-order grid, firing-order harmonics brighter
      if (half > 2) {
        for (let k = 1; k * half < maxHz; k++) {
          const x = ((k * half) / maxHz) * w;
          const isMain = k % Math.round(order * 2) === 0;
          g.fillStyle = isMain ? amber : faint;
          g.globalAlpha = isMain ? 0.9 : 0.5;
          g.fillRect(x, 0, isMain ? 2 : 1, isMain ? h : h * 0.15);
        }
        g.globalAlpha = 1;
      }
      const a = existingHost()?.analyser;
      if (!a) return;
      if (!data || data.length !== a.frequencyBinCount)
        data = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(data);
      const binHz = a.context.sampleRate / a.fftSize;
      g.strokeStyle = accent;
      g.lineWidth = 1.5 * devicePixelRatio;
      g.beginPath();
      for (let i = 1; i * binHz < maxHz; i++) {
        const x = ((i * binHz) / maxHz) * w;
        const db = Math.max(-100, Math.min(-10, data[i]));
        const y = h - ((db + 100) / 90) * h;
        if (i === 1) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [input, order]);
  return <canvas ref={ref} className="apx-snd-scope" aria-label="Spectrum, 0 to 2 kHz" />;
}

const FS = 48000;

/** Hann-windowed amplitude at one frequency (Goertzel). */
function tone(x: Float32Array, hz: number, start: number) {
  const n = x.length - start;
  const c = 2 * Math.cos((2 * Math.PI * hz) / FS);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const s = x[start + i] * w + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return (4 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2))) / n;
}

interface Print {
  /** dB re the strongest, per half order 0.5 … */
  db: number[];
  dominant: number;
  /** orders 0.5 + 1 (a lumpy collector's lope) and the firing line's harmonics, dB re it */
  lope: number;
  harmonics: number;
}

/** Render ~1 s offline (mono) and measure it order by order. */
function fingerprint(src: SoundSource, rpm: number, throttle: number, upTo: number): Print {
  const voice = createVoice(voiceConfig(src), FS, { seed: 1 });
  const start = Math.round(0.3 * FS);
  const mono = new Float32Array(Math.round(1 * FS));
  const L = new Float32Array(128);
  const R = new Float32Array(128);
  for (let s = 0; s < mono.length; s += 128) {
    const n = Math.min(128, mono.length - s);
    voice.render(L, R, n, rpm, throttle);
    for (let i = 0; i < n; i++) mono[s + i] = 0.5 * (L[i] + R[i]);
  }
  const amp = (k: number) => tone(mono, (k * rpm) / 60, start);
  const ks = Array.from({ length: upTo * 2 }, (_, i) => (i + 1) / 2);
  const amps = ks.map(amp);
  const top = Math.max(...amps);
  const F = mainOrder(src);
  const rel = (orders: number[]) =>
    10 * Math.log10(orders.reduce((s, k) => s + amp(k) ** 2, 0) / amp(F) ** 2);
  return {
    db: amps.map((a) => 20 * Math.log10(a / top)),
    dominant: ks[amps.indexOf(top)],
    lope: rel([0.5, 1]),
    harmonics: rel([2 * F, 3 * F, 4 * F]),
  };
}

/** A and B order by order (bars down to -40 dB), firing orders marked. */
function Fingerprint({
  a,
  b,
  rpm,
  throttle,
}: {
  a: SoundSource;
  b: SoundSource;
  rpm: number;
  throttle: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [prints, setPrints] = useState<[Print, Print] | null>(null);
  const upTo = Math.min(24, 4 * Math.max(mainOrder(a), mainOrder(b)));
  const engines = !isMotor(a) && !isMotor(b);
  // re-measure once the controls settle: two offline renders block the page for a moment
  const r = Math.round(rpm / 50) * 50;
  const t = Math.round(throttle * 20) / 20;
  useEffect(() => {
    if (!engines) return;
    const id = setTimeout(
      () => setPrints([fingerprint(a, r, t, upTo), fingerprint(b, r, t, upTo)]),
      300,
    );
    return () => clearTimeout(id);
  }, [a, b, r, t, upTo, engines]);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || !prints) return;
    const w = Math.round(canvas.clientWidth * devicePixelRatio);
    const h = Math.round(canvas.clientHeight * devicePixelRatio);
    canvas.width = w;
    canvas.height = h;
    g.clearRect(0, 0, w, h);
    const n = prints[0].db.length;
    const slot = w / n;
    const marks = [mainOrder(a), mainOrder(b)];
    g.fillStyle = cssVar('--line-strong');
    for (let i = 0; i < n; i++)
      if (marks.some((m) => ((i + 1) / 2) % m === 0)) g.fillRect(i * slot, 0, slot, 2);
    prints.forEach((p, s) => {
      g.fillStyle = cssVar(s === 0 ? '--accent' : '--warn');
      p.db.forEach((db, i) => {
        const y = h * Math.min(1, -db / 40);
        g.fillRect(i * slot + (s + 0.15) * slot * 0.45, y, slot * 0.4, h - y);
      });
    });
  }, [prints, a, b]);

  if (!engines) return null;
  const f = (x: number) => x.toFixed(0);
  return (
    <>
      <canvas
        ref={ref}
        className="apx-snd-scope"
        aria-label={`Order spectra of A and B at ${r} rpm, half orders 0.5 to ${upTo}`}
      />
      {prints && (
        <Stats>
          <Stat label="Dominant order" value={`${prints[0].dominant} · ${prints[1].dominant}`} />
          <Stat label="Lope" value={`${f(prints[0].lope)} · ${f(prints[1].lope)}`} unit="dB" />
          <Stat
            label="Harmonics"
            value={`${f(prints[0].harmonics)} · ${f(prints[1].harmonics)}`}
            unit="dB"
          />
        </Stats>
      )}
    </>
  );
}

const REF_OPTIONS = Object.entries(REAL).map(([key, r]) => ({
  value: key,
  label: `${r.conditions.split(' (')[0]} · ${r.rpm} rpm`,
}));

interface Comparison {
  real: Features;
  ours: Features;
  clip: AudioBuffer;
}

/** A real recording (fetched into memory from Commons) and its catalog engine, measured alike. */
async function compare(key: string): Promise<Comparison> {
  const r = REAL[key];
  const title = decodeURIComponent(r.source.split('/wiki/')[1]);
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&format=json&origin=*&titles=' +
    encodeURIComponent(title);
  const info = (await (await fetch(api)).json()) as {
    query: { pages: Record<string, { imageinfo?: { url: string }[] }> };
  };
  const url = Object.values(info.query.pages)[0]?.imageinfo?.[0]?.url;
  if (!url) throw new Error(`no file for ${title}`);
  const clip = await new OfflineAudioContext(1, 1, FS).decodeAudioData(
    await (await fetch(url)).arrayBuffer(),
  );
  const mono = new Float32Array(clip.length);
  for (let c = 0; c < clip.numberOfChannels; c++) {
    const d = clip.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += d[i] / clip.numberOfChannels;
  }
  const real = features(mono, clip.sampleRate, r.rpm, r.F, r.t[0], r.t[1]);
  const spec = getEngine(r.engine);
  const voice = createVoice(voiceConfig(spec), FS, { seed: 1, addons: defaultAddons(spec) });
  const ours = new Float32Array(Math.round(2.5 * FS));
  const L = new Float32Array(128);
  const R = new Float32Array(128);
  for (let s = 0; s < ours.length; s += 128) {
    const n = Math.min(128, ours.length - s);
    voice.render(L, R, n, r.rpm, r.throttle);
    for (let i = 0; i < n; i++) ours[s + i] = 0.5 * (L[i] + R[i]);
  }
  return { real, ours: features(ours, FS, r.rpm, firingOrder(spec), 0.5, 2.5), clip };
}

function Reference() {
  const [key, setKey] = useState(REF_OPTIONS[0].value);
  const [result, setResult] = useState<Comparison | 'busy' | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const r = REAL[key];
  const run = () => {
    setResult('busy');
    compare(key).then(setResult, () => setResult(null));
  };
  const play = () => {
    if (!result || result === 'busy') return;
    const h = audioHost();
    const src = h.ctx.createBufferSource();
    src.buffer = result.clip;
    src.connect(h.input);
    src.start(0, r.t[0], r.t[1] - r.t[0]);
  };
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || !result || result === 'busy') return;
    const w = Math.round(canvas.clientWidth * devicePixelRatio);
    const h = Math.round(canvas.clientHeight * devicePixelRatio);
    canvas.width = w;
    canvas.height = h;
    g.clearRect(0, 0, w, h);
    const rows = [result.real.orders, result.ours.orders];
    const n = Math.min(rows[0].length, rows[1].length, 4 * r.F);
    const slot = w / n;
    g.fillStyle = cssVar('--line-strong');
    for (let i = 0; i < n; i++) if (rows[0][i].k % r.F === 0) g.fillRect(i * slot, 0, slot, 2);
    rows.forEach((orders, s) => {
      g.fillStyle = cssVar(s === 0 ? '--ok' : '--accent');
      for (let i = 0; i < n; i++) {
        // dB re the firing line, +20 at the top, -40 at the bottom
        const y = h * Math.min(1, Math.max(0, (20 - orders[i].db) / 60));
        g.fillRect(i * slot + (s + 0.15) * slot * 0.45, y, slot * 0.4, h - y);
      }
    });
  }, [result, r.F]);
  const f = (x: number) => x.toFixed(0);
  const done = result && result !== 'busy' ? result : null;
  return (
    <>
      <Select
        label="Real"
        value={key}
        options={REF_OPTIONS}
        onChange={(v) => {
          setKey(v);
          setResult(null);
        }}
      />
      <Stats>
        <Button onClick={run}>{result === 'busy' ? '…' : 'Measure'}</Button>
        {done && <Button onClick={play}>Play</Button>}
      </Stats>
      {done && (
        <>
          <canvas
            ref={ref}
            className="apx-snd-scope"
            aria-label={`Order spectra re the firing line: ${r.conditions} (real) and ${r.engine} (ours)`}
          />
          <Stats>
            <Stat
              label="Below firing"
              value={`${f(done.real.sub)} · ${f(done.ours.sub)}`}
              unit="dB"
            />
            <Stat
              label="Harmonics"
              value={`${f(done.real.harmonics)} · ${f(done.ours.harmonics)}`}
              unit="dB"
            />
            <Stat
              label="Tonal"
              value={`${done.real.tonal.toFixed(2)} · ${done.ours.tonal.toFixed(2)}`}
            />
            <Stat
              label="Bands off"
              value={(
                done.real.bands.reduce((s, v, i) => s + Math.abs(v - done.ours.bands[i]), 0) /
                done.real.bands.length
              ).toFixed(1)}
              unit="dB"
            />
          </Stats>
        </>
      )}
    </>
  );
}

export function Overlay() {
  const [keys, setKeys] = useState<Record<Slot, string>>({ A: 'e:v8-cross', B: 'e:v8-flat' });
  const [active, setActive] = useState<Slot>('A');
  const input = useRef({ rpm: 2500, throttle: 0.3 }).current;
  const live = useLive(input);
  const srcA = useMemo(() => resolve(keys.A), [keys.A]);
  const srcB = useMemo(() => resolve(keys.B), [keys.B]);
  const a = useEngineAudio(srcA, { input });
  const b = useEngineAudio(srcB, { input });
  const cur = active === 'A' ? a : b;
  const src = active === 'A' ? srcA : srcB;

  const flip = (to: Slot) => {
    if (to === active) return;
    const next = to === 'A' ? a : b;
    if (cur.playing) {
      cur.stop();
      next.start();
    }
    setActive(to);
  };

  const lo = minRpm(src);
  const hi = maxRpm(src);
  const rpm = Math.min(Math.max(live.rpm, lo), hi);

  return (
    <Dock side="top-left">
      <Panel title="Sound lab" className="apx-snd-lab">
        <Segmented<Slot>
          label="Audible voice"
          value={active}
          onChange={flip}
          options={[
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
          ]}
        />
        <Select
          label="A"
          value={keys.A}
          options={OPTIONS}
          onChange={(v) => setKeys((k) => ({ ...k, A: v }))}
        />
        <Select
          label="B"
          value={keys.B}
          options={OPTIONS}
          onChange={(v) => setKeys((k) => ({ ...k, B: v }))}
        />
        <Slider
          label="Speed"
          value={rpm}
          min={lo}
          max={hi}
          step={10}
          format={(x) => `${Math.round(x)} rpm`}
          onChange={(x) => (input.rpm = x)}
        />
        <Slider
          label="Throttle"
          value={live.throttle}
          min={0}
          max={1}
          format={(x) => `${Math.round(x * 100)}%`}
          onChange={(x) => (input.throttle = x)}
        />
        <SoundControls audio={cur} />
        <Spectrum input={input} order={mainOrder(src)} />
        <Stats>
          <Stat label="Main order" value={mainOrder(src)} />
          <Stat label="Main line" value={Math.round((mainOrder(src) * rpm) / 60)} unit="Hz" />
        </Stats>
        <Fingerprint a={srcA} b={srcB} rpm={rpm} throttle={live.throttle} />
        <Reference />
      </Panel>
    </Dock>
  );
}

/**
 * useEngineAudio(spec | motor): plays a synthesized voice that follows a live { rpm, throttle }
 * object every animation frame — engineRuntime by default, so the explorer's engine slider and
 * WP5's drive sim drive it with no extra wiring. Audio starts only from start()/blip()/sweep(),
 * which must be called from a user gesture.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engineRuntime } from '../scene/runtime';
import {
  availableAddons,
  defaultAddons,
  voiceConfig,
  type AddonKey,
  type SoundSource,
} from './config';
import type { Addons } from './dsp/types';
import { audioHost, VoiceNode } from './host';
import { RevDriver, revLimits, type Manoeuvre, type RevInput } from './rev';

export interface EngineAudioOptions {
  /** live rpm/throttle to follow (default: engineRuntime) */
  input?: RevInput;
  /** noise seed; same seed → same sound */
  seed?: number;
}

export interface EngineAudio {
  playing: boolean;
  /** true while a blip or sweep is driving the input */
  manoeuvre: Manoeuvre | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** a quick stab of throttle (starts the sound if needed) */
  blip: () => void;
  /** idle → limiter → idle (starts the sound if needed) */
  sweep: () => void;
  /** gas pedal: down floors it (starting the sound if needed), up lets the revs fall back */
  pedal: (down: boolean) => void;
  addons: Addons;
  available: AddonKey[];
  setAddon: (k: AddonKey, on: boolean) => void;
}

export function useEngineAudio(
  source: SoundSource | null,
  options: EngineAudioOptions = {},
): EngineAudio {
  const input = options.input ?? engineRuntime;
  const seed = options.seed ?? 1;
  const config = useMemo(() => (source ? voiceConfig(source) : null), [source]);
  const available = useMemo(() => (source ? availableAddons(source) : []), [source]);
  const defaults = useMemo(() => defaultAddons(source), [source]);
  const [state, setState] = useState(() => ({ id: source?.id, addons: defaults }));
  // a different engine starts from its own defaults
  const addons = state.id === source?.id ? state.addons : defaults;
  const [playing, setPlaying] = useState(false);
  const [manoeuvre, setManoeuvre] = useState<Manoeuvre | null>(null);

  const voice = useRef<VoiceNode | null>(null);
  /** bumps on every start/stop so a late-resolving create() can tell it is stale */
  const generation = useRef(0);
  const pending = useRef(false);
  const driver = useRef<RevDriver | null>(null);
  const latest = useRef({ config, addons, seed, input });
  latest.current = { config, addons, seed, input };

  const stop = useCallback(() => {
    generation.current++;
    pending.current = false;
    voice.current?.stop();
    voice.current = null;
    driver.current?.cancel(latest.current.input);
    setManoeuvre(null);
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    const { config: cfg, addons: a, seed: s } = latest.current;
    if (!cfg || voice.current || pending.current) return;
    let h;
    try {
      h = audioHost();
    } catch {
      return; // no Web Audio (very old browser): stay silent
    }
    const gen = ++generation.current;
    pending.current = true;
    setPlaying(true);
    VoiceNode.create(h, { config: cfg, seed: s, addons: a }).then(
      (v) => {
        if (gen !== generation.current) return v.stop();
        pending.current = false;
        voice.current = v;
        // catch up with anything that changed while the worklet module was loading
        const now = latest.current;
        if (now.config && now.config !== cfg) v.setConfig(now.config, now.seed);
        if (now.addons !== a) v.setAddons(now.addons);
      },
      () => {
        if (gen !== generation.current) return;
        pending.current = false;
        setPlaying(false);
      },
    );
  }, []);

  const toggle = useCallback(
    () => (voice.current || playing ? stop() : start()),
    [playing, start, stop],
  );

  const drive = useCallback(
    (kind: Manoeuvre) => {
      if (!source) return;
      if (!driver.current) driver.current = new RevDriver(revLimits(source));
      else driver.current.setLimits(revLimits(source));
      driver.current.start(kind, latest.current.input);
      setManoeuvre(kind);
      start();
    },
    [source, start],
  );
  const blip = useCallback(() => drive('blip'), [drive]);
  const sweep = useCallback(() => drive('sweep'), [drive]);
  const pedal = useCallback(
    (down: boolean) => (down ? drive('pedal') : driver.current?.release()),
    [drive],
  );

  const setAddon = useCallback(
    (k: AddonKey, on: boolean) => setState({ id: source?.id, addons: { ...addons, [k]: on } }),
    [source, addons],
  );

  // engine switched while playing: crossfade inside the worklet
  useEffect(() => {
    if (config) voice.current?.setConfig(config, latest.current.seed);
    else stop();
  }, [config, stop]);

  useEffect(() => {
    voice.current?.setAddons(addons);
  }, [addons]);

  // follow the live input while playing
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const inp = latest.current.input;
      const d = driver.current;
      if (d?.manoeuvre && !d.step(dt, inp)) setManoeuvre(null);
      voice.current?.set(inp.rpm, inp.throttle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => stop, [stop]);

  return {
    playing,
    manoeuvre,
    start,
    stop,
    toggle,
    blip,
    sweep,
    pedal,
    addons,
    available,
    setAddon,
  };
}

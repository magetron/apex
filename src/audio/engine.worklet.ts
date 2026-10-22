/**
 * AudioWorklet processor: a thin wrapper around the pure-TS kernels in ./dsp. Bundled by Vite
 * as its own file (host.ts imports it with `?worker&url`), so keep imports to ./dsp only.
 * rpm/throttle arrive as k-rate AudioParams; config and add-on changes as port messages.
 */
import { createVoice } from './dsp/voice';
import type { Voice, WorkletInit, WorkletMessage } from './dsp/types';

interface ProcessorBase {
  readonly port: MessagePort;
}
interface WorkletScope {
  AudioWorkletProcessor: new (options?: { processorOptions?: unknown }) => ProcessorBase;
  registerProcessor(name: string, ctor: unknown): void;
  sampleRate: number;
}
// The worklet globals are not in the DOM lib; reach them through globalThis without
// declaring ambient types for the whole program.
const scope = globalThis as unknown as WorkletScope;

/** A config switch crossfades old → new over this long, so swapping engines never clicks. */
const XFADE_S = 0.04;

class EngineProcessor extends scope.AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 40000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  private voice: Voice;
  private old: Voice | null = null;
  private fade = 1;
  private alive = true;
  private scratchL = new Float32Array(128);
  private scratchR = new Float32Array(128);
  private addons: WorkletInit['addons'];

  constructor(options?: { processorOptions?: unknown }) {
    super(options);
    const init = options?.processorOptions as WorkletInit;
    this.addons = init.addons;
    this.voice = createVoice(init.config, scope.sampleRate, {
      seed: init.seed,
      addons: init.addons,
    });
    this.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
      const m = e.data;
      if (m.type === 'addons') {
        this.addons = m.addons;
        this.voice.setAddons(m.addons);
      } else if (m.type === 'config') {
        this.old = this.voice;
        this.fade = 0;
        this.voice = createVoice(m.config, scope.sampleRate, { seed: m.seed, addons: this.addons });
      } else if (m.type === 'stop') this.alive = false;
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>,
  ) {
    const out = outputs[0];
    if (!out || out.length === 0) return this.alive;
    const L = out[0];
    const R = out[1] ?? out[0];
    const n = L.length;
    const rpm = params.rpm[0];
    const throttle = params.throttle[0];
    this.voice.render(L, R, n, rpm, throttle);
    if (this.old) {
      if (this.scratchL.length < n) {
        this.scratchL = new Float32Array(n);
        this.scratchR = new Float32Array(n);
      }
      const oL = this.scratchL;
      const oR = this.scratchR;
      this.old.render(oL, oR, n, rpm, throttle);
      const step = 1 / (XFADE_S * scope.sampleRate);
      for (let i = 0; i < n; i++) {
        this.fade = Math.min(1, this.fade + step);
        L[i] = L[i] * this.fade + oL[i] * (1 - this.fade);
        if (R !== L) R[i] = R[i] * this.fade + oR[i] * (1 - this.fade);
      }
      if (this.fade >= 1) this.old = null;
    }
    return this.alive;
  }
}

scope.registerProcessor('apex-engine', EngineProcessor);

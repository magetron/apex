/**
 * Main-thread audio plumbing: one shared AudioContext (created on the first user gesture),
 * the worklet module, and a master chain voices → volume → limiter → speakers.
 */
import workletUrl from './engine.worklet.ts?worker&url';
import type { Addons, VoiceConfig, WorkletInit, WorkletMessage } from './dsp/types';
import { useAudioSettings } from './settings';

export interface AudioHost {
  ctx: AudioContext;
  /** voices connect here */
  input: GainNode;
  /** post-limiter tap for scopes / meters */
  analyser: AnalyserNode;
  ready: Promise<void>;
}

let host: AudioHost | null = null;

const masterGain = () => {
  const { volume, muted } = useAudioSettings.getState();
  return muted ? 0 : volume * volume;
};

/**
 * The shared audio host. The first call must come from a user gesture (click/key): browsers
 * only let an AudioContext start then. Later calls resume it if the browser suspended it.
 */
export function audioHost(): AudioHost {
  if (!host) {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const input = ctx.createGain();
    input.gain.value = masterGain();
    // safety net for summed voices; each voice also has its own sample-accurate limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.6;
    input.connect(limiter);
    limiter.connect(ctx.destination);
    limiter.connect(analyser);
    const ready = ctx.audioWorklet.addModule(workletUrl);
    useAudioSettings.subscribe(() =>
      input.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.02),
    );
    host = { ctx, input, analyser, ready };
  }
  if (host.ctx.state === 'suspended') void host.ctx.resume();
  return host;
}

/** The host if audio has already been started (never creates one). */
export const existingHost = () => host;

/** One engine/motor voice: a worklet node plus a fade gain. */
export class VoiceNode {
  private readonly node: AudioWorkletNode;
  private readonly fader: GainNode;
  private readonly rpm: AudioParam;
  private readonly throttle: AudioParam;
  private stopped = false;

  private constructor(
    private readonly h: AudioHost,
    init: WorkletInit,
  ) {
    const { ctx } = h;
    this.node = new AudioWorkletNode(ctx, 'apex-engine', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: init,
    });
    this.rpm = this.node.parameters.get('rpm')!;
    this.throttle = this.node.parameters.get('throttle')!;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    this.fader.gain.setTargetAtTime(1, ctx.currentTime, 0.03);
    this.node.connect(this.fader).connect(h.input);
  }

  static async create(h: AudioHost, init: WorkletInit): Promise<VoiceNode> {
    await h.ready;
    return new VoiceNode(h, init);
  }

  /** Smoothly follow the live rpm/throttle (call every animation frame). */
  set(rpm: number, throttle: number) {
    const t = this.h.ctx.currentTime;
    // setTargetAtTime throws on NaN/Infinity; skip a bad frame rather than crash the loop
    if (Number.isFinite(rpm)) this.rpm.setTargetAtTime(Math.min(40000, Math.max(0, rpm)), t, 0.012);
    if (Number.isFinite(throttle))
      this.throttle.setTargetAtTime(Math.min(1, Math.max(0, throttle)), t, 0.02);
  }

  /** Sound or rest: back in quickly when something changes, out slowly when it holds. */
  sound(on: boolean) {
    if (this.stopped) return;
    const { ctx } = this.h;
    this.fader.gain.cancelScheduledValues(ctx.currentTime);
    this.fader.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.03 : 0.35);
  }

  private post(m: WorkletMessage) {
    this.node.port.postMessage(m);
  }

  setConfig(config: VoiceConfig, seed: number) {
    this.post({ type: 'config', config, seed });
  }

  setAddons(addons: Addons) {
    this.post({ type: 'addons', addons });
  }

  /** Fade out, then release the processor. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const { ctx } = this.h;
    this.fader.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    setTimeout(() => {
      this.post({ type: 'stop' });
      this.node.disconnect();
      this.fader.disconnect();
    }, 250);
  }
}

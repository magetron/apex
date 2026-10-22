/**
 * Turbocharger add-ons: spool whine, wastegate chatter, compressor-surge flutter, blow-off
 * valve. The shaft is a first-order lag driven by exhaust energy, so the whine pitch (∝ shaft
 * speed) trails the throttle the way real turbo lag does.
 */
import { Biquad, clamp, decayCoef, Rng, TAU } from './primitives';
import type { Addons, TurboVoiceConfig, VoiceEvent } from './types';

const MAX_TURBOS = 4;
/** Rush left by a road car's silencing, as a share of the open (spool add-on) rush at full boost. */
const RUSH_HINT = 0.08;
/** Blow-off valve: a race valve vents to the air ("pssh"); a road one recirculates (a sigh). */
const BOV_AIR = 0.6;
const BOV_ROAD = 0.005;

export class TurboModel {
  /** compressor shaft speed, 1 = maxShaftKrpm */
  shaft = 0.1;
  /** manifold boost 0..1 */
  boost = 0;
  /** wastegate opening 0..1 */
  gate = 0;
  private armed = false;
  private bovEnv = 0;
  private kBov = 0;
  private surgeEnv = 0;
  private surgePhase = 0;
  private chatterEnv = 0;
  private readonly phases = new Float64Array(MAX_TURBOS);
  private readonly detune: Float64Array;
  private readonly whineBand: Biquad;
  private readonly bovBand: Biquad;
  private readonly surgeBand: Biquad;
  private readonly chatterBand: Biquad;
  private readonly whooshBand: Biquad;
  private readonly kSurge: number;
  private readonly kChatter: number;
  private readonly count: number;

  constructor(
    private readonly cfg: TurboVoiceConfig,
    private readonly fs: number,
    private readonly rng: Rng,
    private readonly events: VoiceEvent[] | null,
  ) {
    this.count = clamp(Math.round(cfg.count), 1, MAX_TURBOS);
    // twins/quads never spin identically: a slight spread makes the whine beat
    this.detune = Float64Array.from(
      { length: MAX_TURBOS },
      (_, k) => 1 + (k - (this.count - 1) / 2) * 0.012,
    );
    this.whineBand = new Biquad(fs, 'bandpass', 2000, 14);
    this.bovBand = new Biquad(fs, 'bandpass', 2400, 0.8);
    this.surgeBand = new Biquad(fs, 'bandpass', 650, 1.4);
    this.chatterBand = new Biquad(fs, 'bandpass', 1700, 2.5);
    this.whooshBand = new Biquad(fs, 'bandpass', 1400, 0.45);
    this.kSurge = decayCoef(0.45, fs);
    this.kChatter = decayCoef(0.0018, fs);
  }

  /** first shaft order (Hz): the audible whistle */
  shaftHz(): number {
    return this.shaft * ((this.cfg.maxShaftKrpm * 1000) / 60);
  }

  /** Control-rate update (once per render block); t = sample time for the event log. */
  update(
    dt: number,
    rpm: number,
    load: number,
    throttle: number,
    antiLag: boolean,
    a: Addons,
    t: number,
  ) {
    const { spoolRpm } = this.cfg;
    const energy = antiLag
      ? 0.95
      : load * clamp((rpm - 0.45 * spoolRpm) / (0.9 * spoolRpm), 0, 1.5);
    let target = 0.1 + 0.95 * Math.pow(energy, 0.8);
    this.gate = clamp((target - 1) / 0.3, 0, 1);
    target = Math.min(target, 1);
    const surging = this.surgeEnv > 0.05;
    // smaller (faster-spinning) turbos spool quicker; a surging compressor is braked hard
    const tauUp = 0.45 * Math.sqrt(180 / this.cfg.maxShaftKrpm) * (this.count > 1 ? 0.8 : 1);
    const tau = target > this.shaft ? tauUp : surging ? 0.5 : 1.7;
    this.shaft += (target - this.shaft) * (1 - Math.exp(-dt / tau));
    const boostTarget =
      throttle > 0.15 || antiLag ? clamp((this.shaft - 0.25) / 0.75, 0, 1) ** 1.5 : 0;
    const boostTau = boostTarget > this.boost ? 0.15 : 0.06;
    this.boost += (boostTarget - this.boost) * (1 - Math.exp(-dt / boostTau));
    this.whineBand.set('bandpass', this.shaftHz() * 1.02, 14);

    // throttle lift while boosted: vent through the BOV, or surge (flutter) without one
    if (throttle > 0.45) this.armed = true;
    if (this.armed && throttle < 0.2) {
      this.armed = false;
      const p = this.boost;
      if (p > 0.2) {
        if (a.bov) {
          this.bovEnv = Math.max(this.bovEnv, p);
          // a bigger charge of boost takes longer to vent
          this.kBov = decayCoef(0.1 + 0.3 * p, this.fs);
          this.events?.push({ kind: 'bov', cyl: -1, t });
        } else if (a.wastegate) {
          this.surgeEnv = Math.max(this.surgeEnv, p);
          this.events?.push({ kind: 'flutter', cyl: -1, t });
        }
      }
    }
  }

  /** Each exhaust pulse rattles a partly open wastegate flap. */
  pulse(amp: number) {
    if (this.gate > 0.02) this.chatterEnv += this.gate * amp * 0.5;
  }

  sample(a: Addons): number {
    // The compressor's rush, only once it makes boost. A road car's intake silencer and
    // turbine leave just a hint of it at full boost; the spool add-on takes the silencing away
    // (whine and rush, as a race car or a student switching it on hears them).
    const rush = this.shaft * this.shaft * Math.sqrt(this.count) * this.boost;
    const hint = a.spool ? 1 : RUSH_HINT * this.boost;
    let y = 0.12 * hint * rush * this.whooshBand.run(this.rng.bi());
    if (a.spool) {
      const hz = this.shaftHz();
      let tone = 0;
      for (let k = 0; k < this.count; k++) {
        const ph = (this.phases[k] + (hz * this.detune[k]) / this.fs) % 1;
        this.phases[k] = ph;
        tone += Math.sin(TAU * ph) + 0.35 * Math.sin(2 * TAU * ph);
      }
      const hiss = this.whineBand.run(this.rng.bi());
      const level = this.shaft * this.shaft * this.boost;
      y += level * ((0.025 * tone) / Math.sqrt(this.count) + 0.12 * hiss);
    }
    if (this.bovEnv > 1e-4) {
      const bov = this.cfg.ventsToAir ? BOV_AIR : BOV_ROAD;
      y += bov * this.bovEnv * this.bovBand.run(this.rng.bi());
      this.bovEnv *= this.kBov;
    }
    if (this.surgeEnv > 1e-4) {
      // "stu-tu-tu": the compressor stalls and recovers ~12–25 times a second
      this.surgePhase = (this.surgePhase + (12 + 14 * (1 - this.surgeEnv)) / this.fs) % 1;
      const gate = Math.max(0, Math.sin(TAU * this.surgePhase)) ** 4;
      y += 1.2 * this.surgeEnv * gate * this.surgeBand.run(this.rng.bi());
      this.surgeEnv *= this.kSurge;
    }
    if (a.wastegate && this.chatterEnv > 1e-5) {
      y += this.chatterEnv * this.chatterBand.run(this.rng.bi());
      this.chatterEnv *= this.kChatter;
    } else this.chatterEnv = 0;
    return y;
  }
}

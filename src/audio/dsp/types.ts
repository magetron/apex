/**
 * Plain-data voice configs shared by the main thread (which derives them from the spec) and the
 * AudioWorklet (which only ever sees these JSON-safe objects, never the spec modules).
 */

export interface TurboVoiceConfig {
  count: number;
  spoolRpm: number;
  /** compressor shaft speed at full boost (krpm) */
  maxShaftKrpm: number;
  /**
   * The blow-off valve vents to the air (a rally/race car's "pssh"); a road car's recirculates
   * into the intake and only sighs
   */
  ventsToAir: boolean;
}

/**
 * When gas moves, in degrees (crank, or e-shaft for a rotary) after each combustion event. A
 * poppet valve lifts gently on its cam and clatters as it seats; a rotor flank uncovers its
 * port in a few degrees, and there is no valve at all.
 */
export interface PortTiming {
  evo: number;
  evc: number;
  ivo: number;
  ivc: number;
  /** degrees from first crack to full port area; 0 = the area follows a cam's lift curve */
  openDeg: number;
  /** the piston (or rotor flank) sweeping the rest out / drawing the next charge in */
  exhaustStroke: [number, number];
  intakeStroke: [number, number];
  /** poppet valves clatter as they seat */
  valves: boolean;
}

export interface EngineVoiceConfig {
  kind: 'engine';
  id: string;
  /**
   * Combustion events in one 720° cycle (deg, 0..720), indexed like spec.cylinders: one per
   * cylinder for a four-stroke, two per rotor for a rotary (each rotor fires every e-shaft turn)
   */
  fireDeg: number[];
  /** exhaust collector group of each event's port (0..groupCount-1) */
  group: number[];
  groupCount: number;
  /**
   * cylinder head (exhaust manifold) of each event (0..headCount-1): bank-mates breathe into the
   * same manifold even when the pipes merge further down
   */
  head: number[];
  headCount: number;
  /** an X-pipe merges every group just before the mufflers */
  crossover: boolean;
  /** primary (header) pipe length per event */
  headerMm: number[];
  ports: PortTiming;
  collectorMm: number;
  mufflerMm: number;
  tailpipeMm: number;
  /**
   * the silencer's low-pass corner (Hz) and its order (1 or 2 poles), the share of the highs its
   * straight-through core passes, and the corner below which the pipe radiates ever less (Hz)
   */
  mufflerHz: number;
  mufflerPoles: 1 | 2;
  mufflerLeak: number;
  radiateHz: number;
  /**
   * Dual pipes heard from a rear quarter, per group: listener gain, and the pan of the highs
   * (-1 left … +1 right; the lows reach both ears alike)
   */
  groupGain: number[];
  groupPan: number[];
  mix: { exhaust: number; intake: number; mechanical: number };
  boreMm: number;
  cylCc: number;
  idleRpm: number;
  redlineRpm: number;
  /** block vibration level per crank order (free forces/couples from balance()) */
  orders: { order: number; level: number }[];
  /** pushrods clatter louder than overhead cams */
  ohv: boolean;
  /**
   * How hard the maker's calibration burbles on the overrun (0..1): performance engines keep a
   * little fuel and a retarded spark when the throttle shuts, and it pops in the manifold
   */
  overrun: number;
  /** present when a turbine sits in the exhaust (it also muffles the pulses) */
  turbo: TurboVoiceConfig | null;
  /** overall loudness trim */
  gain: number;
}

export interface MotorVoiceConfig {
  kind: 'motor';
  id: string;
  polePairs: number;
  inverterHz: number;
  gearWhine: number;
  maxRpm: number;
  reduction: number;
  induction: boolean;
  /** first-stage pinion teeth and the intermediate-shaft ratio of the two-stage reduction */
  pinionTeeth: number;
  stage1Ratio: number;
  stage2Teeth: number;
  statorSlots: number;
  gain: number;
}

export type VoiceConfig = EngineVoiceConfig | MotorVoiceConfig;

/** Toggleable effects. Engine-only: spool…crackle; motor-only: avas. */
export interface Addons {
  /** turbo spool whine */
  spool: boolean;
  /** wastegate chatter at full boost, compressor-surge flutter on lift without a BOV */
  wastegate: boolean;
  /** blow-off valve on throttle lift */
  bov: boolean;
  /** anti-lag: retarded ignition off-throttle, bangs in the collector */
  antiLag: boolean;
  /** overrun burble and crackle: afterfire on a closed throttle (and on the limiter) */
  crackle: boolean;
  /** pedestrian-warning tone at low speed (EV) */
  avas: boolean;
}

export const NO_ADDONS: Addons = {
  spool: false,
  wastegate: false,
  bov: false,
  antiLag: false,
  crackle: false,
  avas: false,
};

export type VoiceEventKind = 'fire' | 'cut' | 'bang' | 'crackle' | 'bov' | 'flutter';

/** Recorded only when a kernel is built with `recordEvents` (tests, never in the worklet). */
export interface VoiceEvent {
  kind: VoiceEventKind;
  /** cylinder index (or -1) */
  cyl: number;
  /** sample time, sub-sample accurate */
  t: number;
}

/** Optional per-sample taps for analysis; filled only when passed to render(). */
export interface Probe {
  /** summed cylinder source (blowdown + pumping) before any pipe */
  source?: Float32Array;
  /** radiated tailpipe pressure of each exhaust group */
  groups?: Float32Array[];
  /** block / valvetrain vibration */
  mechanical?: Float32Array;
  /** turbo noises (whine, rush, BOV, flutter, chatter) as they enter the centre mix, before gain */
  turbo?: Float32Array;
}

export interface Voice {
  setAddons(a: Addons): void;
  /**
   * Render n samples into L/R (from index 0), ramping rpm/throttle linearly from their last
   * values to the given targets across the block.
   */
  render(
    L: Float32Array,
    R: Float32Array,
    n: number,
    rpm: number,
    throttle: number,
    probe?: Probe,
  ): void;
  readonly events: VoiceEvent[] | null;
}

export type WorkletMessage =
  | { type: 'config'; config: VoiceConfig; seed: number }
  | { type: 'addons'; addons: Addons }
  | { type: 'stop' };

export interface WorkletInit {
  config: VoiceConfig;
  seed: number;
  addons: Addons;
}

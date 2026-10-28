import type { DriveScenario } from '../../content/types';
import type { CarState, Inputs } from '../model/car';
import type { CarParams } from '../model/params';
import type { Driver } from './driver';
import type { Path } from './path';
import type { Trace } from './trace';

/**
 * Every scenario the sim knows: the content contract's five (tours can name those) plus the
 * driving techniques the drive hub adds. Proposed for content/types.ts DriveScenario.
 */
export type ScenarioId = DriveScenario | 'trail-brake' | 'left-foot' | 'catch';

/** Per-run controller state (each car, ghosts included, gets its own). */
export interface Ctl {
  driver: Driver;
  phase: number;
  /** time the scripted event fired (s), NaN before */
  tEvent: number;
  /** steering held through an open-loop window (rad) */
  hold: number;
  /** speed multiplier for this car: grip-scaled plans run each car at the same fraction of its
   *  own cornering limit (√(limit/ref)), so more grip doesn't hide what the layout does */
  vScale: number;
  /** scenario scratch: e.g. the speed a car reached its limit at */
  memo: number;
}

/** The headline numbers a scenario reports (keys into METRICS). */
export type MetricId =
  | 'usGradient'
  | 'usGradientLimit'
  | 'maxAy'
  | 'limitAxle'
  | 'lineChange'
  | 'slipChange'
  | 'yawSpike'
  | 'yawLag'
  | 'yawResponse'
  | 'swingRate'
  | 'speedIn'
  | 'speedOut'
  | 'maxSlip'
  | 'maxSwing'
  | 'sameSpeedTighter'
  | 'exitErr'
  | 'exitSwing'
  | 'lineShift'
  | 'sameSpeedShift'
  | 'pathError'
  | 'stopDist'
  | 'meanDecel'
  | 'diveDeg'
  | 'counterDeg';

export interface ScenarioResult {
  values: Partial<Record<MetricId, number>>;
  headline: MetricId;
  spun: boolean;
}

/** What a car did, in a word or two: understeer-ish, oversteer-ish, spun, or calm. */
export type Verdict =
  | 'wide'
  | 'tight'
  | 'neutral'
  | 'tail'
  | 'spin'
  | 'front-first'
  | 'rear-first'
  | 'caught'
  | 'no-slide';

/** A labelled spot on the road: what the driver does there. */
export interface Mark {
  /** arc length along the plan's path (m) */
  s: number;
  label: string;
  kind: 'drive' | 'brake' | 'steer' | 'event';
  /** for the event: how long the steering is then held still (s) */
  holdS?: number;
}

export interface Plan {
  id: ScenarioId;
  kmh: number;
  /** the line the driver follows */
  path: Path;
  /** what to draw as the road: centreline, width and sideways offset of its middle (m) */
  road: Path;
  roadWidth: number;
  roadOffset: number;
  /** dashed lane dividers, as sideways offsets from the road centreline (m) */
  lanes: number[];
  /** cones on the ground: x, n pairs */
  cones: Float64Array;
  /** where along `path` the scripted event happens (for a marker), NaN if none */
  eventS: number;
  /** stretch of `path` (arc lengths) an overhead view should frame: where the action is */
  overview: [number, number];
  duration: number;
  startS: number;
  startV: number;
  /** corner speeds scale with each car's limit (see Ctl.vScale); straight-line tests don't */
  gripScaled: boolean;
  /** the steps of the manoeuvre on the road, for a car of this speed scale (Ctl.vScale) */
  marks?(vScale: number): Mark[];
  control(c: Ctl, p: CarParams, st: CarState, u: Inputs, dt: number): void;
  summarize(tr: Trace, p: CarParams): ScenarioResult;
}

/**
 * The moment that answers a scenario's question, for slow motion and a marker: the scripted
 * event (the lift, the brake, the throttle…) or the first axle running out of grip, and how
 * much sim time either side of it to show slowed down (s).
 */
export interface KeySpec {
  at: 'event' | 'let-go';
  before: number;
  after: number;
  /** name on the timeline when the scenario has no event marker ("Swerve") */
  label?: string;
  /**
   * When to stop and show cause next to effect: this long after the event (s); null for never
   * (nothing lets go, and the effect isn't one a still frame shows). Without it: once the
   * cars that let go have visibly done so, or three quarters of `after` if none does.
   */
  freeze?: number | null;
  /**
   * Stop instead where the driver's opposite lock peaks (catching a slide: the catch itself,
   * not its aftermath), within `after` of the event; `freeze` if nobody steers into a slide.
   */
  freezeAt?: 'peak-lock';
  /**
   * A car whose rear lets go is stopped on once its body has swung this far from where it
   * points to where it goes (deg), or this long after it let go (s), whichever comes first.
   * Default: 4° or 0.4 s.
   */
  swung?: { deg: number; within: number };
}

export interface ScenarioDef {
  id: ScenarioId;
  /** the question the scenario answers: its name in the hub and on the info card */
  question: string;
  /** the technique or test that answers it (the subtitle) */
  label: string;
  /** chip-sized name */
  short: string;
  /** what happens, in a few words (tooltip) */
  title: string;
  /** what the speed setting means, km/h */
  speed: { min: number; max: number; def: number; label: string };
  /** label for the event marker ("Lift", "Brake"…) */
  event?: string;
  /** the number this scenario is about (what its summary leads with) */
  headline: MetricId;
  key: KeySpec;
  /** radius of the corner the event happens in (m): speeds read as a share of the grip there */
  radius?: number;
  /** the steering is held this long after the event (s): what the car does then is its own;
   *  after it the test driver corrects */
  holdS?: number;
  /** what every car is asked for, the same for all, in plain words ("every car asks for the
   *  same 0.5 g"): so a result is the layout's, not a stronger engine's */
  demand?: string;
  plan(kmh: number): Plan;
  /** the same run without the technique (e.g. steering held but no brake): what the technique
   *  itself changes, shown as a twin of the visitor's car */
  baseline?: { label: string; plan(kmh: number): Plan };
  /** a car's result in a word (chips next to the numbers) */
  verdict?(r: ScenarioResult): Verdict | null;
}

export const METRICS: Record<MetricId, { label: string; unit: string; digits: number }> = {
  usGradient: { label: 'Understeer gradient', unit: '°/g', digits: 1 },
  usGradientLimit: { label: 'Gradient near limit', unit: '°/g', digits: 1 },
  maxAy: { label: 'Max lateral', unit: 'g', digits: 2 },
  limitAxle: { label: 'First to slide', unit: '', digits: 0 },
  lineChange: { label: 'Line on power', unit: '%', digits: 0 },
  slipChange: { label: 'Tail-out change', unit: '°', digits: 1 },
  yawSpike: { label: 'Yaw spike', unit: '°/s', digits: 1 },
  yawLag: { label: 'Yaw lag', unit: 'ms', digits: 0 },
  yawResponse: { label: 'Yaw response (to 90%)', unit: 'ms', digits: 0 },
  swingRate: { label: 'Still swinging out at the end', unit: '°/s', digits: 0 },
  speedIn: { label: 'Speed at the event', unit: 'km/h', digits: 0 },
  speedOut: { label: 'Speed as the held wheel ends', unit: 'km/h', digits: 0 },
  maxSlip: { label: 'Max body slip', unit: '°', digits: 1 },
  maxSwing: { label: 'Swung out at most', unit: '°', digits: 0 },
  sameSpeedTighter: { label: 'Tighter than at the same speed', unit: '%', digits: 0 },
  exitErr: { label: 'Inside the line at the end', unit: 'm', digits: 1 },
  exitSwing: { label: 'Nose inside its path at the end', unit: '°', digits: 0 },
  lineShift: { label: 'Moved inside its line', unit: 'm', digits: 1 },
  sameSpeedShift: { label: 'Inside the same-speed line', unit: 'm', digits: 1 },
  pathError: { label: 'Max off line', unit: 'm', digits: 2 },
  stopDist: { label: 'Stopping', unit: 'm', digits: 1 },
  meanDecel: { label: 'Mean decel', unit: 'g', digits: 2 },
  diveDeg: { label: 'Nose dive', unit: '°', digits: 1 },
  counterDeg: { label: 'Opposite lock', unit: '°', digits: 1 },
};

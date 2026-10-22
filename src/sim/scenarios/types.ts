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
  | 'maxSlip'
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

export const VERDICTS: Record<
  Verdict,
  { label: string; tone: 'under' | 'over' | 'spin' | 'calm' }
> = {
  wide: { label: 'Runs wide', tone: 'under' },
  tight: { label: 'Tightens', tone: 'over' },
  neutral: { label: 'Holds line', tone: 'calm' },
  tail: { label: 'Tail out', tone: 'over' },
  spin: { label: 'Spins', tone: 'spin' },
  'front-first': { label: 'Front slides', tone: 'under' },
  'rear-first': { label: 'Rear slides', tone: 'over' },
  caught: { label: 'Caught', tone: 'over' },
  'no-slide': { label: 'No slide', tone: 'calm' },
};

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

export interface ScenarioDef {
  id: ScenarioId;
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
  /** radius of the corner the event happens in (m): speeds read as a share of the grip there */
  radius?: number;
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
  maxSlip: { label: 'Max body slip', unit: '°', digits: 1 },
  pathError: { label: 'Max off line', unit: 'm', digits: 2 },
  stopDist: { label: 'Stopping', unit: 'm', digits: 1 },
  meanDecel: { label: 'Mean decel', unit: 'g', digits: 2 },
  diveDeg: { label: 'Nose dive', unit: '°', digits: 1 },
  counterDeg: { label: 'Opposite lock', unit: '°', digits: 1 },
};

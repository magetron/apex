/**
 * What a run showed, in plain words: one line per car, its one number (as the picture labels
 * it), and where it ranks among the layouts, all derived from the results, never written per
 * car. No codes, no units a first-year student would have to look up: "front-drive", "ran 0.7 m
 * wide", "0.20 s after the wheel".
 */
import type { CarParams } from '../../sim/model';
import { FZ0_PER_MM } from '../../sim/model/params';
import { LINE_M } from '../../sim/scenarios/corner';
import type { MetricId, ScenarioId, Verdict } from '../../sim/scenarios';

export interface Outcome {
  /** layout code ("FR") and the model without its make ("M340i") */
  code: string;
  model: string;
  /** what a twin is ("No lift", "Less rear grip"), named instead of its model */
  label?: string;
  driven: 'front' | 'rear' | 'all';
  /** static share of the weight on the front axle, and the most it carried in the run (0..1) */
  front: number;
  frontMax: number;
  /** its share just before the scenario's event (the freeze frame's "before"); the static
   *  share where there is no event */
  frontBefore?: number;
  /** the front's share of the load that moves across the car in a turn (roll stiffness) */
  rollF: number;
  /** yaw inertia over m·a·b: above 1, mass sits out beyond the axles */
  dynIndex: number;
  /** CG height over wheelbase: how much load a stop can move */
  cgOverL: number;
  /** rear tyres wider than the fronts */
  widerRear: boolean;
  /** tyre widths, front and rear (mm, the spec's) */
  tyreF: number;
  tyreR: number;
  /** the rear tyres' grip relative to the car as built (the push-wide twins) */
  rearGrip: number;
  /** the car's sim parameters, for what-if runs (why one car answers the wheel later) */
  p?: CarParams;
  values: Partial<Record<MetricId, number>>;
  verdict: Verdict | null;
  spun: boolean;
  letGo: { axle: 'front' | 'rear'; g: number } | null;
}

/** Layout facts the lessons lean on, from a car's sim parameters (and the as-built car's,
 *  for a tuned twin). */
export function layoutFacts(
  p: CarParams,
  asBuilt: CarParams = p,
): Pick<
  Outcome,
  | 'driven'
  | 'front'
  | 'rollF'
  | 'dynIndex'
  | 'cgOverL'
  | 'widerRear'
  | 'tyreF'
  | 'tyreR'
  | 'rearGrip'
> {
  return {
    driven: p.front.driven && p.rear.driven ? 'all' : p.front.driven ? 'front' : 'rear',
    front: p.b / p.L,
    rollF: p.front.rollShare,
    dynIndex: p.izz / (p.m * p.a * p.b),
    cgOverL: p.h / p.L,
    widerRear: p.rear.fz0 > p.front.fz0 * 1.02,
    tyreF: Math.round(p.front.fz0 / FZ0_PER_MM),
    tyreR: Math.round(p.rear.fz0 / FZ0_PER_MM),
    rearGrip: p.rear.mu / asBuilt.rear.mu,
  };
}

const TWO_WORD_MAKES = ['Alfa Romeo', 'Aston Martin', 'Land Rover'];

/** "M340i", "718 Boxster T": the model without its make or generation. */
export function modelName(name: string): string {
  const short = name.replace(/\s*\(.*\)$/, '');
  const make = TWO_WORD_MAKES.find((m) => short.startsWith(`${m} `));
  if (make) return short.slice(make.length + 1);
  return short.split(' ').slice(1).join(' ') || short;
}

const share = (x: number) => `${Math.round(100 * x)}%`;

/** The corner questions, whose result is where each car's line ended up, in metres. */
export const PICTURED: readonly ScenarioId[] = [
  'lift-off',
  'power-exit',
  'catch',
  'trail-brake',
  'left-foot',
];

/** The questions whose line is judged at matched speed: against the same car at the speed it
 *  had at each moment, without the brake (slowing down alone tightens a line). */
export const MATCHED: readonly ScenarioId[] = ['trail-brake', 'left-foot'];

/** a line ending closer than this to its reference (m) is on it: no number, no gap marked
 *  (the same threshold that sorts "tighter" from "wider" from neither: corner.ts LINE_M) */
export const MIN_GAP = LINE_M;

/** A distance as written on the picture and in the summary, one decimal. */
export const metres = (m: number) => `${m.toFixed(1)} m`;

/**
 * Where a car's line ended against its reference (m, + = inside the turn), the one measure the
 * summary, the every-layout list and the picture all use: the line the driver aimed for; braking
 * into a turn, the car's own line at the same speed without the brake (slowing down alone
 * tightens a line, so that doesn't count). Undefined off the corner questions.
 */
export function lineOff(id: ScenarioId, o: Outcome): number | undefined {
  if (!PICTURED.includes(id)) return undefined;
  const d = MATCHED.includes(id) ? o.values.sameSpeedShift : o.values.exitErr;
  return d !== undefined && Number.isFinite(d) ? d : undefined;
}

/**
 * The one number a car's summary line says, as the line writes it (`value`) and as the picture
 * labels the car with it (`label`): where its line ended against its reference, the distance it
 * moved onto its front tyres, the g its first end let go at, how soon it answered the wheel. Null where
 * the line says no number.
 */
export interface CarNumber {
  value: string;
  label: string;
  /** a distance off the line: which side of its reference it ended; or an angle, the nose
   *  turned in from its path */
  side?: 'inside' | 'wide' | 'nose';
}

export function carNumber(id: ScenarioId, o: Outcome): CarNumber | null {
  const v = o.values;
  switch (id) {
    case 'braking': {
      // the load moved, from its share at rest (the layout chip's) to the most braking put there;
      // no stopping distance: every car's tyres here are the spec's rough grip figure, so the
      // distances say little about the real cars
      const value = share(o.frontMax);
      return { value, label: `front load ${share(o.front)} at rest → ${value}` };
    }
    case 'skidpad': {
      if (o.letGo) {
        const value = `${o.letGo.g.toFixed(2)} g`;
        return { value, label: `${o.letGo.axle} tyres let go at ${value}` };
      }
      const value = `${(v.maxAy ?? 0).toFixed(2)} g`;
      return { value, label: `held to ${value}` };
    }
    case 'lane-change': {
      if (!Number.isFinite(v.yawResponse)) return null;
      const value = `${(v.yawResponse! / 1000).toFixed(2)} s`;
      return { value, label: `90% of its turn rate ${value} after the wheel` };
    }
    default: {
      // power out: a rear sliding out shows as the nose turned in from the path, not as metres
      // (its path can still run wide); the run-wide car says its metres, its nose along its path
      if (id === 'power-exit' && slidOut(o)) {
        const value = `${Math.round(Math.abs(v.exitSwing ?? 0))}°`;
        return {
          value,
          label: `nose ${value} inside its path: rear slid out${o.spun ? ', then spun' : ''}`,
          side: 'nose',
        };
      }
      const d = lineOff(id, o);
      if (d === undefined || Math.abs(d) < MIN_GAP) return null;
      const value = metres(Math.abs(d));
      const then = o.spun ? ', then spun' : '';
      if (id === 'power-exit' && d < 0)
        return {
          value,
          label: `${along(o) ? 'nose along its path, ' : ''}ran ${value} wide: front pushed`,
          side: 'wide',
        };
      if (MATCHED.includes(id))
        return d > 0
          ? { value, label: `${value} tighter`, side: 'inside' }
          : { value, label: `${value} wider`, side: 'wide' };
      return d > 0
        ? { value, label: `${value} inside${then}`, side: 'inside' }
        : { value, label: `${value} wide${then}`, side: 'wide' };
    }
  }
}

/**
 * A car's outcome in a few words, written on its path in the picture of both lines: its one
 * number (carNumber) said as the picture shows it ("1.3 m tighter", "rear out 12°", "spun").
 */
export function pathWord(id: ScenarioId, o: Outcome): string {
  if (o.spun) return 'spun';
  const v = o.values;
  switch (id) {
    case 'braking':
      return `front ${share(o.front)}→${share(o.frontMax)}`;
    case 'skidpad':
      return o.letGo
        ? `${o.letGo.axle} first, ${o.letGo.g.toFixed(2)} g`
        : `held ${(v.maxAy ?? 0).toFixed(2)} g`;
    case 'lane-change': {
      const n = carNumber(id, o);
      return n ? `turns in ${n.value}` : '';
    }
    case 'catch':
      if (o.verdict === 'caught') return 'caught';
      return carNumber(id, o) ? lineWords(id, o) : 'no slide';
    default:
      return lineWords(id, o);
  }
}

/**
 * The colour a car's outcome words take on the picture: red only where an end of it let go or
 * it spun (a rear out, a spin, the end that went first on the skidpad), the recovery colour for
 * a slide caught, plain for where its line went.
 */
export function pathTone(id: ScenarioId, o: Outcome): 'out' | 'caught' | 'plain' {
  if (o.spun) return 'out';
  if (id === 'skidpad') return o.letGo ? 'out' : 'plain';
  if (o.verdict === 'caught') return 'caught';
  return carNumber(id, o)?.side === 'nose' ? 'out' : 'plain';
}

/** Where a corner's line ended against its reference, in a few words. */
function lineWords(id: ScenarioId, o: Outcome): string {
  const n = carNumber(id, o);
  if (!n) return 'on line';
  if (n.side === 'nose') return `rear out ${n.value}`;
  return `${n.value} ${n.side === 'inside' ? 'tighter' : 'wider'}`;
}

/** power out: its rear slid out (the tail swung, or it spun), its nose turned in from its path */
const slidOut = (o: Outcome) =>
  o.verdict === 'tail' || o.verdict === 'spin' || o.spun || (o.values.exitSwing ?? 0) >= 2;
/** its nose still points along its path (under 2°) */
const along = (o: Outcome) => Math.abs(o.values.exitSwing ?? 0) < 2;

/**
 * The one car the visitor's car is compared with, per scenario. Two kinds of comparison teach:
 *  - another car whose layout makes the opposite point (a 911 lifting meets a nose-heavy saloon),
 *    picked from derived traits (weight split, driven wheels, CG height, where the mass sits);
 *  - the same car without the technique (no lift, no brake, no catch), or with more or less
 *    grip at the back.
 * Each scenario lists the kinds that can answer it, clearest first; the default is the first
 * one whose headless runs (at the scenario's default speed, so the choice doesn't flicker with
 * the slider) actually show the point, and its `why` says what sets it apart. Where the lesson
 * is the technique itself (catching a slide, braking into a turn, left-foot braking), the
 * default is the same car without it; where it is the layout, another car; on the push-wide
 * question, the same car with less grip at the back.
 */
import { carParams, lateralLimit, REF_LATERAL_LIMIT, type Tuning } from '../../sim/model';
import { runHeadless, SCENARIOS, type ScenarioId, type ScenarioResult } from '../../sim/scenarios';
import { massProps } from '../../spec/derive/mass';
import { listVehicles } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { FAMILIES, familyOf, representative } from './state';
import { MATCHED, modelName } from './takeaway';

export type RivalKind = 'contrast' | 'without' | 'less-rear' | 'more-rear' | 'car';
export type CompareKind = 'auto' | RivalKind;

/** The rear tyres' grip for the "less" and "more rear grip" twins (× as built). */
export const REAR_GRIP = { 'less-rear': 0.8, 'more-rear': 1.2 } as const;

export interface Rival {
  kind: RivalKind;
  vehicle: VehicleSpec;
  /** chip-sized name on the road and in the card: "Golf GTI", "No lift", "Less rear grip" */
  label: string;
  /** what sets it apart, for the chooser ("front-drive", "tail-heavy") */
  why?: string;
  tuning?: Tuning;
}

/** Which kinds answer each question, clearest first ('car' joins when the visitor picked one). */
export const KINDS: Record<ScenarioId, RivalKind[]> = {
  'lift-off': ['contrast', 'without'],
  'power-exit': ['contrast', 'without'],
  catch: ['without', 'contrast'],
  'trail-brake': ['without', 'contrast'],
  skidpad: ['less-rear', 'more-rear'],
  braking: ['contrast'],
  'left-foot': ['without', 'contrast'],
  'lane-change': ['contrast'],
};

/** Road cars only: slicks and off-road tyres would make a different point. */
const road = (v: VehicleSpec) => v.tires.kind !== 'slick' && v.tires.kind !== 'offroad';

const frontShare = (v: VehicleSpec) => {
  const p = paramsOf(v);
  return p.b / p.L;
};
const cgOverWheelbase = (v: VehicleSpec) => massProps(v).cgMm[1] / v.dims.wheelbaseMm;
const massOut = (v: VehicleSpec) => {
  const p = paramsOf(v);
  return p.izz / (p.m * p.a * p.b);
};
const drivenAxle = (v: VehicleSpec) => v.powertrain.driven;

const paramsCache = new Map<string, ReturnType<typeof carParams>>();
function paramsOf(v: VehicleSpec, tuning?: Tuning) {
  const key = `${v.id}|${tuning?.rearGrip ?? 1}`;
  let p = paramsCache.get(key);
  if (!p) {
    p = carParams(v, tuning);
    paramsCache.set(key, p);
  }
  return p;
}

/** Weight split in words, for a contrast picked by it. */
const heavyEnd = (v: VehicleSpec) => {
  const f = frontShare(v);
  return f < 0.48 ? 'tail-heavy' : f > 0.55 ? 'nose-heavy' : 'evenly balanced';
};
const drivenWords = { front: 'front-drive', rear: 'rear-drive', all: 'all-wheel drive' } as const;

/** One headless run at a scenario's default speed (cached): the comparisons' evidence. */
const runs = new Map<string, ScenarioResult & { verdict: string | null }>();
function outcome(
  v: VehicleSpec,
  id: ScenarioId,
  opts: { baseline?: boolean; tuning?: Tuning } = {},
) {
  const key = `${v.id}|${id}|${opts.baseline ? 'b' : ''}|${opts.tuning?.rearGrip ?? 1}`;
  let r = runs.get(key);
  if (!r) {
    const def = SCENARIOS[id];
    const kmh = def.speed.def;
    const plan = opts.baseline && def.baseline ? def.baseline.plan(kmh) : def.plan(kmh);
    const p = paramsOf(v, opts.tuning);
    // a tuned twin drives the as-built car's speeds
    const ayRef = opts.tuning
      ? REF_LATERAL_LIMIT * (lateralLimit(p) / lateralLimit(paramsOf(v)))
      : undefined;
    const res = runHeadless(p, plan, { ayRef }).result;
    r = { ...res, verdict: def.verdict?.(res) ?? null };
    runs.set(key, r);
  }
  return r;
}

/** What a car did, coarsely: the tail went, it tightened, it ran wide, or it held on. */
function behaviour(r: { verdict: string | null; spun: boolean }) {
  if (r.spun || r.verdict === 'spin' || r.verdict === 'tail') return 'over';
  return r.verdict ?? 'calm';
}

/** Another car, of a different layout and like the visitor's in class, that makes the point. */
function contrast(v: VehicleSpec, id: ScenarioId): Rival | null {
  const others = FAMILIES.filter((f) => f !== familyOf(v))
    .map((f) => representative(f, v))
    .filter((c): c is VehicleSpec => !!c && road(c));
  const pick = (
    list: VehicleSpec[],
    gap: (c: VehicleSpec) => number,
    why: (c: VehicleSpec) => string,
    shows?: (c: VehicleSpec) => boolean,
  ): Rival | null => {
    const sorted = [...list].sort((a, b) => gap(b) - gap(a) || a.id.localeCompare(b.id));
    const c = sorted.find((x) => !shows || shows(x)) ?? sorted[0];
    return c ? { kind: 'contrast', vehicle: c, label: modelName(c.name), why: why(c) } : null;
  };
  const differs = (c: VehicleSpec) => behaviour(outcome(c, id)) !== behaviour(outcome(v, id));
  switch (id) {
    case 'lift-off':
    case 'trail-brake':
      return pick(others, (c) => Math.abs(frontShare(c) - frontShare(v)), heavyEnd, differs);
    case 'catch':
      // a car that slides and is caught meets one that doesn't (never slides, or spins); a car
      // that never slides meets one that slides and is caught
      return outcome(v, id).verdict === 'caught'
        ? pick(others, (c) => Math.abs(frontShare(c) - frontShare(v)), heavyEnd, differs)
        : pick(
            others,
            (c) => -frontShare(c),
            heavyEnd,
            (c) => outcome(c, id).verdict === 'caught',
          );
    case 'power-exit':
      return pick(
        others,
        (c) =>
          (drivenAxle(c) === drivenAxle(v)
            ? 0
            : drivenAxle(c) === 'all' || drivenAxle(v) === 'all'
              ? 1
              : 2) + Math.abs(frontShare(c) - frontShare(v)),
        (c) => drivenWords[drivenAxle(c)],
        differs,
      );
    case 'left-foot':
      // the rally driver's case: a front-driver (a front-driver gets a rear-driven car)
      return pick(
        others,
        (c) => (drivenAxle(c) === 'front' ? 2 : drivenAxle(c) === 'rear' ? 1 : 0),
        (c) => drivenWords[drivenAxle(c)],
      );
    case 'braking': {
      // any road car: how much weight moves depends on CG height over wheelbase, not class
      const all = listVehicles().filter((c) => c.id !== v.id && road(c));
      const own = cgOverWheelbase(v);
      return pick(
        all,
        (c) => Math.abs(cgOverWheelbase(c) - own),
        (c) => (cgOverWheelbase(c) > own ? 'taller for its wheelbase' : 'lower for its wheelbase'),
      );
    }
    case 'lane-change':
      return pick(
        others,
        (c) => Math.abs(massOut(c) - massOut(v)),
        // (yaw inertia over m·a·b: a ratio, not "closer in", for a long, heavy car with a low one)
        (c) =>
          massOut(c) > massOut(v)
            ? 'more yaw inertia for its wheelbase'
            : 'less yaw inertia for its wheelbase',
      );
    case 'skidpad':
      return pick(others, (c) => Math.abs(frontShare(c) - frontShare(v)), heavyEnd);
  }
}

function twin(v: VehicleSpec, id: ScenarioId, kind: RivalKind): Rival | null {
  const def = SCENARIOS[id];
  if (kind === 'without') {
    if (!def.baseline) return null;
    // braking into a turn, the twin is car A at car A's speed: its tag links the two speeds (a
    // chain) and crosses out its brake, so its name only says what it leaves out, as a twin's does
    const label = MATCHED.includes(id) ? 'No brake' : def.baseline.label;
    return { kind, vehicle: v, label, why: 'same car' };
  }
  if (kind === 'less-rear' || kind === 'more-rear') {
    const pct = Math.round(Math.abs(REAR_GRIP[kind] - 1) * 100);
    return {
      kind,
      vehicle: v,
      label: `${pct}% ${kind === 'less-rear' ? 'less' : 'more'} rear grip`,
      why: 'same car',
      tuning: { rearGrip: REAR_GRIP[kind] },
    };
  }
  return null;
}

/** Whether a comparison shows the scenario's point for this car (at the default speed). */
function shows(v: VehicleSpec, id: ScenarioId, r: Rival): boolean {
  const main = outcome(v, id);
  switch (r.kind) {
    case 'without': {
      const off = outcome(v, id, { baseline: true });
      if (id === 'catch') return main.verdict === 'caught' && !main.spun;
      const lc = (x: ScenarioResult) => x.values.lineChange ?? 0;
      return behaviour(main) !== behaviour(off) || Math.abs(lc(main) - lc(off)) > 8;
    }
    case 'less-rear':
    case 'more-rear': {
      const tuned = outcome(v, id, { tuning: r.tuning });
      const a = main.values.limitAxle ?? 0;
      const b = tuned.values.limitAxle ?? 0;
      return a !== 0 && b !== 0 && a !== b;
    }
    case 'contrast': {
      if (id === 'catch')
        return main.verdict === 'caught'
          ? behaviour(outcome(r.vehicle, id)) !== behaviour(main)
          : outcome(r.vehicle, id).verdict === 'caught';
      if (id === 'braking' || id === 'lane-change' || id === 'left-foot') return true;
      return behaviour(outcome(r.vehicle, id)) !== behaviour(main);
    }
    default:
      return true;
  }
}

const optionCache = new Map<string, Rival[]>();

/**
 * Every comparison this scenario offers for this car, the default first (the first kind that
 * shows the point); a picked car (vehicle chosen by the visitor) is offered too, and leads.
 */
export function rivalOptions(v: VehicleSpec, id: ScenarioId, picked?: VehicleSpec | null): Rival[] {
  const key = `${v.id}|${id}`;
  let list = optionCache.get(key);
  if (!list) {
    const all = KINDS[id]
      .map((k) => (k === 'contrast' ? contrast(v, id) : twin(v, id, k)))
      .filter((r): r is Rival => !!r);
    const best = all.find((r) => shows(v, id, r)) ?? all[0];
    list = best ? [best, ...all.filter((r) => r !== best)] : all;
    optionCache.set(key, list);
  }
  if (!picked || picked.id === v.id) return list;
  const own: Rival = {
    kind: 'car',
    vehicle: picked,
    label: modelName(picked.name),
    why: 'your pick',
  };
  return [own, ...list.filter((r) => !(r.kind === 'contrast' && r.vehicle.id === picked.id))];
}

/** The comparison for a setting: 'auto' is the picked car if any, else the clearest. */
export function chooseRival(
  v: VehicleSpec,
  id: ScenarioId,
  compare: CompareKind,
  picked?: VehicleSpec | null,
): Rival {
  const list = rivalOptions(v, id, picked);
  return (compare !== 'auto' && list.find((r) => r.kind === compare)) || list[0];
}

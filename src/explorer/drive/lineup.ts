/**
 * Who drives the scenario: the visitor's car and the one car it is compared with (versus.ts).
 * The scene builds a lane per entry and publishes each car's result for the info card.
 */
import { create } from 'zustand';
import { carParams, lateralLimit, REF_LATERAL_LIMIT, type CarParams } from '../../sim/model';
import {
  SCENARIOS,
  type MetricId,
  type Plan,
  type ScenarioId,
  type Verdict,
} from '../../sim/scenarios';
import { layoutCode } from '../../spec/describe';
import type { VehicleSpec } from '../../spec/types';
import type { DriveColors } from './colors';
import { LEAD } from './freeze';
import { Lane, type LaneInfo } from './lanes';
import type { DriveSettings } from './state';
import { layoutFacts, modelName, type Outcome } from './takeaway';
import { chooseRival, type Rival } from './versus';

const paramsCache = new WeakMap<VehicleSpec, CarParams>();
export function paramsOf(v: VehicleSpec): CarParams {
  let p = paramsCache.get(v);
  if (!p) {
    p = carParams(v);
    paramsCache.set(v, p);
  }
  return p;
}

export interface LineupEntry {
  key: string;
  vehicle: VehicleSpec;
  params: CarParams;
  plan: Plan;
  info: LaneInfo;
  /** lateral limit its speeds are quoted for: a tuned twin drives the as-built car's speeds */
  ayRef?: number;
  /** the car as built, for a tuned twin */
  asBuilt?: CarParams;
  /** what the twin is ("No lift"), shown instead of its model */
  label?: string;
}

export const shortName = (v: VehicleSpec) => v.name.replace(/\s*\(.*\)$/, '');

/** A lane's colour in the current theme: neutral for the visitor's car, one accent for the
 *  comparison. */
export function laneColor(info: LaneInfo, colors: DriveColors): string {
  return info.kind === 'main' ? colors.you : colors.rival;
}

/** The entry for the comparison car. */
function rivalEntry(vehicle: VehicleSpec, rival: Rival, id: ScenarioId, kmh: number): LineupEntry {
  const def = SCENARIOS[id];
  const v = rival.vehicle;
  const info: LaneInfo = {
    kind: 'rival',
    code: layoutCode(v),
    name: shortName(v),
    label: rival.label,
    rival: rival.kind,
    vehicle: v,
  };
  const base = { key: `rival:${rival.kind}:${v.id}`, vehicle: v, info, label: rival.label };
  if (rival.kind === 'without' && def.baseline)
    return { ...base, params: paramsOf(vehicle), plan: def.baseline.plan(kmh) };
  if (rival.tuning) {
    const asBuilt = paramsOf(vehicle);
    const params = carParams(vehicle, rival.tuning);
    return {
      ...base,
      params,
      plan: def.plan(kmh),
      asBuilt,
      ayRef: REF_LATERAL_LIMIT * (lateralLimit(params) / lateralLimit(asBuilt)),
    };
  }
  return { ...base, params: paramsOf(v), plan: def.plan(kmh) };
}

export function buildLineup(
  vehicle: VehicleSpec,
  s: Pick<DriveSettings, 'scenario' | 'compare'>,
  kmh: number,
  /** the car the visitor picked to drive against, if any */
  picked: VehicleSpec | null = null,
): LineupEntry[] {
  const def = SCENARIOS[s.scenario];
  const main: LineupEntry = {
    key: `main:${vehicle.id}`,
    vehicle,
    params: paramsOf(vehicle),
    plan: def.plan(kmh),
    info: {
      kind: 'main',
      code: layoutCode(vehicle),
      name: shortName(vehicle),
      label: modelName(vehicle.name),
      vehicle,
    },
  };
  const rival = chooseRival(vehicle, s.scenario, s.compare, picked);
  return [main, rivalEntry(vehicle, rival, s.scenario, kmh)];
}

/** A lane for an entry. */
export function laneOf(e: LineupEntry, esc = false): Lane {
  const lane = new Lane(e.params, e.plan, esc, e.info, e.ayRef);
  lane.asBuilt = e.asBuilt;
  return lane;
}

export interface ResultRow {
  key: string;
  info: LaneInfo;
  label?: string;
  value: number;
  spun: boolean;
  verdict: Verdict | null;
  /** which axle let go first and at what g, if one did */
  letGo: { axle: 'front' | 'rear'; g: number } | null;
  /** everything the takeaway lines are written from; null until the car has finished */
  outcome?: Outcome | null;
}

/** A lane's result for the info card and its takeaway, from what it has driven. */
export function laneResult(lane: Lane, asBuilt?: CarParams): ResultRow {
  const def = SCENARIOS[lane.plan.id];
  const tr = lane.rec.toTrace(2);
  const res = lane.plan.summarize(tr, lane.p);
  res.spun = res.spun || lane.run.st.spun;
  const verdict = def.verdict?.(res) ?? null;
  const letGo = lane.letGo ? { axle: lane.letGo.axle, g: lane.letGo.g } : null;
  let frontMax = 0;
  for (const f of tr.front) frontMax = Math.max(frontMax, f);
  // the share just before the event, read where the freeze frame reads its "before"
  const i0 = tr.phase.findIndex((ph) => ph >= 1);
  const dt = tr.t.length > 1 ? tr.t[1] - tr.t[0] : 1;
  const frontBefore = i0 > 0 ? tr.front[Math.max(0, i0 - Math.round(LEAD / dt))] : undefined;
  const label =
    lane.info.kind === 'rival' && lane.info.rival !== 'contrast' && lane.info.rival !== 'car'
      ? lane.info.label
      : undefined;
  return {
    key: `${lane.info.kind}:${lane.info.code}:${lane.info.name}`,
    info: lane.info,
    label: lane.info.label,
    value: res.values[res.headline] ?? NaN,
    spun: res.spun,
    verdict,
    letGo,
    outcome: {
      code: lane.info.code,
      model: modelName(lane.info.name),
      label,
      ...layoutFacts(lane.p, asBuilt),
      p: lane.p,
      frontMax,
      frontBefore,
      values: res.values,
      verdict,
      spun: res.spun,
      letGo,
    },
  };
}

/**
 * Each car's result for the current scenario, and whether the run has reached its end yet with
 * these cars (the lesson waits for that).
 */
export const useDriveResults = create<{
  /** the question these results are for */
  scenario: ScenarioId | null;
  rows: ResultRow[] | null;
  metric: MetricId;
  revealed: boolean;
  /** the playhead is at the run's end right now (each car's line shows its result) */
  ended: boolean;
}>()(() => ({
  scenario: null,
  rows: null,
  metric: 'lineChange',
  revealed: false,
  ended: false,
}));

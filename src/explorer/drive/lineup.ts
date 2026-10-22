/**
 * Who drives the scenario: the visitor's car, plus either other layouts doing the same thing or
 * the same car without the technique. The scene builds its lanes from this list and publishes
 * each car's result once the runs are done, for the info card.
 */
import { create } from 'zustand';
import { carParams, type CarParams } from '../../sim/model';
import { SCENARIOS, type MetricId, type Plan, type Verdict } from '../../sim/scenarios';
import { layoutCode } from '../../spec/describe';
import type { VehicleSpec } from '../../spec/types';
import { colorSlots, GHOST_COLORS, slotColor, type DriveColors } from './colors';
import type { Lane, LaneInfo } from './lanes';
import { familyOf, lineupGhosts, type DriveSettings } from './state';
import { layoutFacts, modelName, type Outcome } from './takeaway';

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
  /** what the twin is ("No lift"), shown instead of its layout code */
  label?: string;
}

export const shortName = (v: VehicleSpec) => v.name.replace(/\s*\(.*\)$/, '');

/** A lane's colour in the current theme. */
export function laneColor(info: LaneInfo, colors: DriveColors, theme: keyof typeof GHOST_COLORS) {
  if (info.family) return slotColor(info.family, info.slot ?? 0, theme);
  return info.kind === 'twin' ? colors.twin : colors.you;
}

export function buildLineup(
  vehicle: VehicleSpec,
  s: Pick<DriveSettings, 'scenario' | 'ghosts' | 'compare'>,
  kmh: number,
  /** cars the visitor picked to compare with (vehicle ids), ahead of the stand-ins */
  picked: readonly string[] = [],
): LineupEntry[] {
  const def = SCENARIOS[s.scenario];
  const plan = def.plan(kmh);
  const main: LineupEntry = {
    key: `main:${vehicle.id}`,
    vehicle,
    params: paramsOf(vehicle),
    plan,
    info: { kind: 'main', code: layoutCode(vehicle), name: shortName(vehicle), family: null },
  };
  if (s.compare === 'technique' && def.baseline) {
    return [
      main,
      {
        key: `twin:${vehicle.id}`,
        vehicle,
        params: main.params,
        plan: def.baseline.plan(kmh),
        info: { kind: 'twin', code: layoutCode(vehicle), name: shortName(vehicle), family: null },
        label: def.baseline.label,
      },
    ];
  }
  const ghosts = lineupGhosts(vehicle, s.ghosts, picked);
  const slots = colorSlots(ghosts.map(familyOf));
  return [
    main,
    ...ghosts.map((v, i): LineupEntry => ({
      key: `ghost:${v.id}`,
      vehicle: v,
      params: paramsOf(v),
      plan,
      info: {
        kind: 'ghost',
        code: layoutCode(v),
        name: shortName(v),
        family: familyOf(v),
        slot: slots[i],
      },
    })),
  ];
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
export function laneResult(lane: Lane, label?: string): ResultRow {
  const def = SCENARIOS[lane.plan.id];
  const tr = lane.rec.toTrace(2);
  const res = lane.plan.summarize(tr, lane.p);
  res.spun = res.spun || lane.run.st.spun;
  const verdict = def.verdict?.(res) ?? null;
  const letGo = lane.letGo ? { axle: lane.letGo.axle, g: lane.letGo.g } : null;
  let frontMax = 0;
  for (const f of tr.front) frontMax = Math.max(frontMax, f);
  return {
    key: `${lane.info.kind}:${lane.info.code}:${lane.info.name}`,
    info: lane.info,
    label,
    value: res.values[res.headline] ?? NaN,
    spun: res.spun,
    verdict,
    letGo,
    outcome: {
      code: lane.info.code,
      model: modelName(lane.info.name),
      label,
      ...layoutFacts(lane.p),
      frontMax,
      values: res.values,
      verdict,
      spun: res.spun,
      letGo,
    },
  };
}

/**
 * Each car's result for the current scenario (null while running), and whether the run has
 * reached its end yet with these cars (the takeaway waits for that).
 */
export const useDriveResults = create<{
  rows: ResultRow[] | null;
  metric: MetricId;
  revealed: boolean;
}>()(() => ({
  rows: null,
  metric: 'lineChange',
  revealed: false,
}));

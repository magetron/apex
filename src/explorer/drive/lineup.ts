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
import { GHOST_COLORS, type DriveColors } from './colors';
import type { LaneInfo } from './lanes';
import { familyOf, resolveGhosts, type DriveSettings } from './state';

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
  if (info.family) return GHOST_COLORS[theme][info.family];
  return info.kind === 'twin' ? colors.twin : colors.you;
}

export function buildLineup(
  vehicle: VehicleSpec,
  s: Pick<DriveSettings, 'scenario' | 'ghosts' | 'compare'>,
  kmh: number,
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
  return [
    main,
    ...resolveGhosts(vehicle, s.ghosts).map((v): LineupEntry => ({
      key: `ghost:${v.id}`,
      vehicle: v,
      params: paramsOf(v),
      plan,
      info: { kind: 'ghost', code: layoutCode(v), name: shortName(v), family: familyOf(v) },
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
}

/** Each car's result for the current scenario (null while running). */
export const useDriveResults = create<{ rows: ResultRow[] | null; metric: MetricId }>()(() => ({
  rows: null,
  metric: 'lineChange',
}));

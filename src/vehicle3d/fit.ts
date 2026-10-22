/**
 * Engine swap + bay fit check (pure). Answers "how does a transverse engine limit engine size":
 * a transverse engine's *length* plus its end-on gearbox must fit *across* the bay, while a
 * longitudinal engine only has to be narrow enough. Allowances cover what envelope() leaves out
 * (accessory drive, mounts, manifolds); they are deliberately simple and listed here.
 */
import { getEngine } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';
import { GEARBOX, layoutPowertrain } from '../spec/derive/layout';
import type { EngineFamily, EngineSpec, Vec3, VehicleSpec } from '../spec/types';
import { DEG } from '../spec/units';

/** Belt/chain drive, pulleys and alternator at the timing end (mm along the crank). */
export const ACCESSORY_MM = 70;
/** Mount and service clearance, both ends together (mm along the crank). */
export const MOUNTS_MM = 50;
/** Manifolds/turbos beside the block, per side (mm across the crank). */
export const SIDE_MM: Record<EngineFamily, number> = {
  inline: 125,
  vr: 125,
  v: 70,
  w: 70,
  flat: 40,
  rotary: 100,
};
/** Bonnet/deck skin and clearance above the engine (mm). */
export const SKIN_MM = 20;
/** Under this much spare room a fit counts as tight (mm). */
export const TIGHT_MM = 60;

export type FitStatus = 'ok' | 'tight' | 'clash';

export interface FitAxis {
  need: number;
  have: number;
  margin: number;
  status: FitStatus;
}

export interface FitBox {
  centerMm: Vec3;
  /** [along X, height Y, across Z] */
  sizeMm: Vec3;
}

export interface FitResult {
  engine: EngineSpec;
  orientation: 'transverse' | 'longitudinal';
  /** across the car (Z) and along it (X) */
  across: FitAxis;
  along: FitAxis;
  height: FitAxis;
  status: FitStatus;
  /** what has to fit (engine + allowances, plus the end-on gearbox when transverse) */
  need: FitBox;
  /** the free bay envelope at the same place */
  bay: FitBox;
}

const axis = (need: number, have: number): FitAxis => {
  const margin = have - need;
  return { need, have, margin, status: margin < 0 ? 'clash' : margin < TIGHT_MM ? 'tight' : 'ok' };
};

const worst = (...s: FitStatus[]): FitStatus =>
  s.includes('clash') ? 'clash' : s.includes('tight') ? 'tight' : 'ok';

/** The vehicle with another engine dropped in, kerb weight adjusted by the engine mass change. */
export function withEngine(v: VehicleSpec, engineId: string | null | undefined): VehicleSpec {
  const pt = v.powertrain;
  if (!engineId || pt.kind !== 'ice' || pt.engine === engineId) return v;
  const dKg = getEngine(engineId).massKg - getEngine(pt.engine).massKg;
  return {
    ...v,
    powertrain: { ...pt, engine: engineId },
    published: { ...v.published, curbKg: v.published.curbKg + dKg },
  };
}

/** Top of the engine above its crank axis once laid over by the install tilt (mm). */
function tiltedTop(env: ReturnType<typeof envelope>, tiltDeg: number): number {
  const t = tiltDeg * DEG;
  let top = -Infinity;
  for (const y of [env.min[1], env.max[1]]) {
    for (const z of [env.min[2], env.max[2]])
      top = Math.max(top, y * Math.cos(t) - z * Math.sin(t));
  }
  return top;
}

/** Fit of the vehicle's own engine, or of `engineId` swapped in (same orientation and gearbox). */
export function checkFit(vehicle: VehicleSpec, engineId?: string | null): FitResult | null {
  const v = withEngine(vehicle, engineId);
  const pt = v.powertrain;
  if (pt.kind !== 'ice') return null;
  const eng = getEngine(pt.engine);
  const env = envelope(eng);
  const transverse = pt.orientation === 'transverse';
  const gbLen = pt.gearbox === 'transverse-endon' ? GEARBOX['transverse-endon'].sizeMm[0] : 0;

  const alongCrank = env.lengthMm + ACCESSORY_MM + MOUNTS_MM + gbLen;
  const acrossCrank = env.widthMm + 2 * SIDE_MM[eng.family];
  const acrossNeed = transverse ? alongCrank : acrossCrank;
  const alongNeed = transverse ? acrossCrank : alongCrank;

  const front = pt.position === 'front-overhang' || pt.position === 'front-mid';
  const topNeed = pt.crankYMm + tiltedTop(env, pt.engineTiltDeg ?? 0);
  const topHave =
    (pt.position === 'rear-underfloor'
      ? v.body.beltHMm - 250
      : front
        ? v.body.bonnetHMm
        : v.body.tailHMm) - SKIN_MM;

  const across = axis(acrossNeed, v.bay.widthMm);
  const along = axis(alongNeed, v.bay.lengthMm);
  const height = axis(topNeed, topHave);

  // place the boxes where the engine actually sits in the layout
  const e = layoutPowertrain(v).parts.find((p) => p.id === 'engine')!;
  const off = e.boxOffsetMm ?? [0, 0, 0];
  const c = Math.cos(e.yawDeg * DEG);
  const s = Math.sin(e.yawDeg * DEG);
  const boxCentre: Vec3 = [
    e.posMm[0] + c * off[0] + s * off[2],
    e.posMm[1] + off[1],
    e.posMm[2] - s * off[0] + c * off[2],
  ];
  const unitZ = transverse ? 0 : boxCentre[2];
  const floorY = 150;
  const need: FitBox = {
    centerMm: [boxCentre[0], (floorY + topNeed) / 2, unitZ],
    sizeMm: [alongNeed, topNeed - floorY, acrossNeed],
  };
  const bay: FitBox = {
    centerMm: [boxCentre[0], (floorY + topHave) / 2, 0],
    sizeMm: [v.bay.lengthMm, topHave - floorY, v.bay.widthMm],
  };
  return {
    engine: eng,
    orientation: pt.orientation,
    across,
    along,
    height,
    // height is a coarse check (bonnet line, not the real skin), so only an outright clash counts
    status: worst(across.status, along.status, height.status === 'clash' ? 'clash' : 'ok'),
    need,
    bay,
  };
}

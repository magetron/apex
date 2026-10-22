/**
 * The torque path from crank (or motor) to the driven wheels, as straight segments with the
 * share of drive torque each one carries. Pure: derived from layoutPowertrain(), so the flow
 * always follows the parts as drawn.
 */
import { AWD_FRONT } from '../spec/derive/awd';
import { layoutPowertrain } from '../spec/derive/layout';
import type { Axle, PlacedPart, PowertrainLayout, Shaft, Vec3, VehicleSpec } from '../spec/types';
import { DEG } from '../spec/units';

export interface FlowSeg {
  a: Vec3;
  b: Vec3;
  /** share of total drive torque (0..1) */
  share: number;
  /** distance from the source along the path at `a` (mm), so dashes flow continuously */
  d0: number;
}

export interface AxleSplit {
  axle: Axle;
  share: number;
  /** where to anchor its label (diff or motor), mm */
  at: Vec3;
}

export interface TorqueFlow {
  segs: FlowSeg[];
  axles: AxleSplit[];
  /** the AWD split point (coupling / centre diff / PTU), if any */
  split: { at: Vec3; front: number } | null;
  wheels: { id: string; share: number }[];
}

/** Nominal front share when the spec doesn't give one (shared with the AWD model). */
export { AWD_FRONT };

const dist = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

export function torqueFlow(
  v: VehicleSpec,
  layout: PowertrainLayout = layoutPowertrain(v),
): TorqueFlow {
  const pt = v.powertrain;
  const segs: FlowSeg[] = [];
  const part = (id: string) => layout.parts.find((p) => p.id === id);
  const shaft = (id: string) => layout.shafts.find((s) => s.id === id);
  const front =
    pt.driven === 'all'
      ? (pt.frontTorqueShare ?? AWD_FRONT[pt.awd ?? 'center-diff'])
      : pt.driven === 'front'
        ? 1
        : 0;
  const shareOf = (axle: Axle) => (axle === 'front' ? front : 1 - front);

  /** run through points; returns the distance at the end */
  const chain = (pts: (Vec3 | undefined)[], share: number, d0: number) => {
    const list = pts.filter((p): p is Vec3 => !!p);
    let d = d0;
    for (let i = 0; i < list.length - 1; i++) {
      const L = dist(list[i], list[i + 1]);
      if (L < 1) continue;
      segs.push({ a: list[i], b: list[i + 1], share, d0: d });
      d += L;
    }
    return d;
  };
  const wheels: TorqueFlow['wheels'] = [];
  const axles: AxleSplit[] = [];
  /** diff/motor → both half shafts → wheel centres */
  const toWheels = (axle: Axle, from: Vec3, d0: number, at: Vec3 = from) => {
    const share = shareOf(axle);
    if (share <= 0) return;
    axles.push({ axle, share, at });
    for (const side of ['left', 'right'] as const) {
      const h: Shaft | undefined = shaft(`half-${axle}-${side}`);
      const w = part(`wheel-${axle}-${side}`);
      chain([from, h?.fromMm, h?.toMm, w?.posMm], share / 2, d0);
      if (w) wheels.push({ id: w.id, share: share / 2 });
    }
  };

  let split: TorqueFlow['split'] = null;
  if (pt.kind === 'ev') {
    for (const m of layout.parts.filter((p) => p.kind === 'motor')) toWheels(m.axle!, m.posMm, 0);
    return { segs, axles, split, wheels };
  }

  const eng = part('engine')!;
  const gb = part('gearbox')!;
  const yaw = eng.yawDeg * DEG;
  const off = eng.boxOffsetMm ?? [0, 0, 0];
  const rearEnd = off[0] - eng.sizeMm[0] / 2;
  const flywheel: Vec3 = [
    eng.posMm[0] + Math.cos(yaw) * rearEnd,
    eng.posMm[1],
    eng.posMm[2] - Math.sin(yaw) * rearEnd,
  ];
  let d = chain([eng.posMm, flywheel], 1, 0);

  const diffPos = (axle: Axle) => part(`diff-${axle}`)?.posMm;
  const mainAxle: Axle =
    pt.gearbox === 'transverse-endon' && pt.position.startsWith('front') ? 'front' : 'rear';
  const other: Axle = mainAxle === 'front' ? 'rear' : 'front';
  const propOther = shaft(`prop-${other}`);
  const coupling: PlacedPart | undefined = part('coupling');

  if (pt.gearbox === 'rear-transaxle') {
    const pr = shaft('prop-rear');
    d = chain([flywheel, pr?.fromMm, pr?.toMm, gb.posMm], 1, d);
  } else {
    d = chain([flywheel, gb.posMm], 1, d);
  }

  if (pt.gearbox === 'inline') {
    let src = gb.posMm;
    let ds = d;
    if (pt.driven === 'all' && coupling) {
      ds = chain([gb.posMm, coupling.posMm], 1, d);
      src = coupling.posMm;
    }
    if (pt.driven === 'all') split = { at: src, front };
    const pr = shaft('prop-rear');
    const dr = chain([src, pr?.fromMm, pr?.toMm, diffPos('rear')], shareOf('rear'), ds);
    toWheels('rear', diffPos('rear')!, dr);
    if (pt.driven === 'all' && propOther) {
      const df = chain([src, propOther.fromMm, propOther.toMm, diffPos('front')], front, ds);
      toWheels('front', diffPos('front')!, df);
    }
  } else {
    // the gearbox drives its own axle's differential directly
    const dMain = diffPos(mainAxle)!;
    const dm = chain(
      [gb.posMm, dMain],
      mainAxle === 'front' ? 1 : pt.driven === 'all' ? 1 : shareOf('rear'),
      d,
    );
    toWheels(mainAxle, dMain, dm);
    if (pt.driven === 'all' && propOther) {
      // transfer to the other axle: PTU / prop / coupling / diff
      const via = coupling && pt.awd === 'clutch-on-demand' ? coupling.posMm : undefined;
      split = { at: mainAxle === 'front' ? dMain : gb.posMm, front };
      const start = mainAxle === 'front' ? dMain : gb.posMm;
      const dOther = diffPos(other)!;
      const de = chain([start, propOther.fromMm, propOther.toMm, via, dOther], shareOf(other), dm);
      toWheels(other, dOther, de);
    }
  }
  return { segs, axles, split, wheels };
}

/**
 * Where an axle's share is tagged (mm): on the hub of its right-hand wheel, just outside the tyre
 * (the camera arrives from the right). Over the diff, a rear or mid engine sat right under it and
 * the tag read as the engine's place.
 */
export function axleTagMm(layout: PowertrainLayout, a: AxleSplit): Vec3 {
  const w = layout.parts.find((p) => p.id === `wheel-${a.axle}-right`);
  if (!w) return [a.at[0], a.at[1] + 600, a.at[2]];
  return [w.posMm[0], w.posMm[1], w.posMm[2] + w.sizeMm[2] / 2 + 120];
}

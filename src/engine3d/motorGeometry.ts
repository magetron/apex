/** MotorLayout → geometry (metres), merged per part and material. */
import {
  BufferGeometry,
  CatmullRomCurve3,
  LatheGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MotorSpec } from '../spec/types';
import { DEG } from '../spec/units';
import type { Lod } from './geometry';
import { motorLayout, type GearLayout, type MotorLayout } from './motorLayout';
import { circle, cylX, extrudeYZ, gear, hull, mergeM, type YZ } from './prims';

export interface MotorGeometry {
  layout: MotorLayout;
  housing: BufferGeometry;
  stator: BufferGeometry;
  windings: BufferGeometry;
  /** rotor parts are built around the motor axis (local origin on the axis) */
  rotorCore: BufferGeometry;
  rotorSteel: BufferGeometry;
  magnetsA: BufferGeometry;
  magnetsB: BufferGeometry | null;
  /** intermediate shaft, local to its axis */
  inter: BufferGeometry;
  /** ring gear + diff case + output shafts, local to the output axis */
  ring: BufferGeometry;
  diff: BufferGeometry;
  outputs: BufferGeometry;
  gearCase: BufferGeometry;
  inverter: BufferGeometry;
  cables: BufferGeometry;
}

const segs = (lod: Lod, n: number) => (lod === 'high' ? n : Math.max(8, n >> 1));

/** Gear outline centred on the shaft's own axis (geometry is local to that axis). */
const gearSolid = (g: GearLayout, lod: Lod) =>
  extrudeYZ(
    gear(g.radiusMm, g.teeth, Math.max(1.8, g.radiusMm * 0.09), g.phaseDeg * DEG),
    g.x - g.widthMm / 2,
    g.x + g.widthMm / 2,
    { bevel: lod === 'high' ? 0.8 : 0 },
  );

/** Annular sector in the YZ plane. */
function sector(r0: number, r1: number, a0: number, a1: number, n = 6): YZ[] {
  const pts: YZ[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]);
  }
  for (let k = n; k >= 0; k--) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push([r0 * Math.cos(a), r0 * Math.sin(a)]);
  }
  return pts;
}

export function buildMotorGeometry(spec: MotorSpec, lod: Lod = 'high'): MotorGeometry {
  const l = motorLayout(spec);
  const [my, mz] = l.motorAxis;
  const [iy, iz] = l.interAxis;
  const n = segs(lod, 40);
  const D = l.diameterMm;
  const L = l.lengthMm;

  const housing = [cylX(l.housingR, l.motorX0, l.motorX1, n, my, mz)];
  const stator = [
    extrudeYZ(circle(my, mz, l.statorR, n), l.statorX0, l.statorX1, {
      holes: [gear(l.statorBoreR + 0.05 * D, l.slots, 0.05 * D, 0, my, mz)],
    }),
  ];

  const windings: BufferGeometry[] = [];
  const midR = (l.statorBoreR + l.statorR) / 2;
  for (const x of [l.statorX0, l.statorX1]) {
    const t = new TorusGeometry(midR * 0.97, (l.statorR - l.statorBoreR) * 0.34, segs(lod, 10), n);
    t.rotateY(Math.PI / 2);
    t.translate(x + (x === l.statorX0 ? -4 : 4), my, mz);
    windings.push(t);
  }
  // three phase leads up to the terminal box on top of the housing
  for (let k = 0; k < 3; k++) {
    const x = l.statorX1 + 6;
    const z = mz + (k - 1) * 0.05 * D;
    const curve = new CatmullRomCurve3([
      new Vector3(x, my + midR * 0.9, z),
      new Vector3(x + 0.02 * L, my + l.statorR * 1.02, z),
      new Vector3(x + 0.02 * L, my + l.housingR * 0.98, z),
    ]);
    windings.push(new TubeGeometry(curve, 8, 0.012 * D, 6, false));
  }

  // rotor (local to the motor axis)
  const rx0 = l.statorX0 - 4;
  const rx1 = l.statorX1 + 4;
  const rotorCore = [cylX(l.rotorR * 0.94, rx0, rx1, n)];
  const rotorSteel = [
    cylX(l.shaftR, l.motorX0 + 4, l.pinion.x + l.pinion.widthMm / 2, segs(lod, 16)),
    gearSolid(l.pinion, lod),
  ];
  const magA: BufferGeometry[] = [];
  const magB: BufferGeometry[] = [];
  if (spec.kind === 'induction') {
    // squirrel cage: skewed-looking bars + shorting end rings
    const bars = 28;
    for (let k = 0; k < bars; k++) {
      const a = (2 * Math.PI * k) / bars;
      magA.push(extrudeYZ(sector(l.rotorR * 0.86, l.rotorR, a - 0.045, a + 0.045, 2), rx0, rx1));
    }
    for (const x of [rx0, rx1]) {
      const t = new TorusGeometry(l.rotorR * 0.93, l.rotorR * 0.08, 6, n);
      t.rotateY(Math.PI / 2);
      t.translate(x, 0, 0);
      magA.push(t);
    }
  } else if (spec.kind === 'synchronous-reluctance') {
    // no magnets: nested flux barriers cut into the rotor stack, one set per pole
    const span = (Math.PI * 2) / l.poles;
    for (let k = 0; k < l.poles; k++) {
      const a = (k + 0.5) * span;
      for (const [r, w] of [
        [0.5, 0.3],
        [0.68, 0.36],
        [0.86, 0.42],
      ] as const) {
        magA.push(
          extrudeYZ(
            sector(l.rotorR * (r - 0.06), l.rotorR * r, a - span * w, a + span * w, 6),
            rx0 + 2,
            rx1 - 2,
          ),
        );
      }
    }
  } else {
    // surface magnets, alternating N/S poles
    const span = (Math.PI * 2) / l.poles;
    for (let k = 0; k < l.poles; k++) {
      const a = k * span;
      const s = sector(l.rotorR * 0.86, l.rotorR, a - span * 0.42, a + span * 0.42, 6);
      (k % 2 === 0 ? magA : magB).push(extrudeYZ(s, rx0 + 3, rx1 - 3));
    }
  }

  // intermediate shaft (local)
  const inter = [
    gearSolid(l.inter1, lod),
    gearSolid(l.inter2, lod),
    cylX(
      l.shaftR * 0.9,
      l.inter1.x - l.inter1.widthMm,
      l.inter2.x + l.inter2.widthMm,
      segs(lod, 16),
    ),
  ];

  // ring gear + diff (local to the output axis)
  const ring = [gearSolid(l.ring, lod)];
  const prof = [
    new Vector2(l.shaftR * 1.3, -l.diffR * 0.95),
    new Vector2(l.diffR * 0.8, -l.diffR * 0.7),
    new Vector2(l.diffR, 0),
    new Vector2(l.diffR * 0.8, l.diffR * 0.7),
    new Vector2(l.shaftR * 1.3, l.diffR * 0.95),
  ];
  const diffCase = new LatheGeometry(prof, n);
  diffCase.rotateZ(-Math.PI / 2);
  diffCase.translate(l.diffX, 0, 0);
  const diff: BufferGeometry[] = [diffCase];
  if (lod === 'high') diff.push(cylX(l.shaftR * 0.7, l.diffX - 2, l.diffX + 2, 10, 0, 0));
  const outputs = [
    cylX(l.shaftR, -L / 2, l.diffX - l.diffR * 0.8, segs(lod, 16)),
    cylX(l.shaftR, l.diffX + l.diffR * 0.8, L / 2, segs(lod, 16)),
  ];
  for (const x of [-L / 2, L / 2])
    outputs.push(cylX(l.shaftR * 1.9, x - Math.sign(x) * 0.03 * L, x, segs(lod, 16)));

  const casePts: YZ[] = [
    ...circle(my, mz, l.pinion.radiusMm + 8, 16),
    ...circle(iy, iz, l.inter1.radiusMm + 8, 24),
    ...circle(0, 0, l.ring.radiusMm + 8, 24),
    ...circle(my, mz, l.housingR, 24),
  ];
  const gearCase = [extrudeYZ(hull(casePts), l.caseX0, l.caseX1, { bevel: 6 })];

  const { min, max } = l.inverter;
  const ib = new RoundedBoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2], 2, 8);
  ib.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const inverter: BufferGeometry[] = [ib];
  if (lod === 'high') {
    const fins = 9;
    for (let k = 0; k < fins; k++) {
      const x = min[0] + 10 + ((max[0] - min[0] - 20) * k) / (fins - 1);
      const f = new RoundedBoxGeometry(3, (max[1] - min[1]) * 0.8, 10, 1, 1);
      f.translate(x, (min[1] + max[1]) / 2, max[2] + 4);
      inverter.push(f);
    }
  }
  // orange HV cables: inverter → motor terminal, and the DC feed from the battery
  const cables: BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const z = mz + (k - 1) * 0.05 * D;
    const x = l.statorX1 + 6 + 0.02 * L;
    const curve = new CatmullRomCurve3([
      new Vector3(x, my + l.housingR, z),
      new Vector3(x, my + l.housingR + 0.06 * D, z + 0.08 * D),
      new Vector3(x - 0.05 * L, max[1] - 0.05 * D, min[2] + 0.02 * D),
    ]);
    cables.push(new TubeGeometry(curve, 16, 0.014 * D, 6, false));
  }
  for (const dz of [-0.03, 0.03]) {
    const z = (min[2] + max[2]) / 2 + dz * D;
    const curve = new CatmullRomCurve3([
      new Vector3(min[0] + 6, (min[1] + max[1]) / 2, z),
      new Vector3(min[0] - 0.06 * L, (min[1] + max[1]) / 2 + 0.04 * D, z),
      new Vector3(-L / 2 - 0.04 * L, max[1], z),
    ]);
    cables.push(new TubeGeometry(curve, 16, 0.02 * D, 8, false));
  }

  return {
    layout: l,
    housing: mergeM(housing),
    stator: mergeM(stator),
    windings: mergeM(windings),
    rotorCore: mergeM(rotorCore),
    rotorSteel: mergeM(rotorSteel),
    magnetsA: mergeM(magA),
    magnetsB: magB.length ? mergeM(magB) : null,
    inter: mergeM(inter),
    ring: mergeM(ring),
    diff: mergeM(diff),
    outputs: mergeM(outputs),
    gearCase: mergeM(gearCase),
    inverter: mergeM(inverter),
    cables: mergeM(cables),
  };
}

export function disposeMotorGeometry(g: MotorGeometry) {
  for (const x of [
    g.housing,
    g.stator,
    g.windings,
    g.rotorCore,
    g.rotorSteel,
    g.magnetsA,
    g.magnetsB,
    g.inter,
    g.ring,
    g.diff,
    g.outputs,
    g.gearCase,
    g.inverter,
    g.cables,
  ]) {
    x?.dispose();
  }
}

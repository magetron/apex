/**
 * Balance visualiser: the free 1st/2nd-order force from balanceAt() as an arrow at the crank
 * centre, and each free couple as a see-saw pair of opposite arrows at the engine's ends, with
 * the locus each arrow tip traces over a revolution (a line = reciprocating, a circle =
 * rotating, which a counterweight can cancel). Drawn on top of everything; no allocation per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineLoop,
  Mesh,
  Vector3,
  type Object3D,
} from 'three';
import { engineRuntime } from '../scene/runtime';
import { arrowMat, ORDER_COLORS, traceMat } from './materials';
import { sampleBalance, type BalanceTable } from './motion';

/** metres of arrow per unit force (one cylinder's peak inertia force of that order) */
export const FORCE_SCALE = 0.05;
/** metres of end-arrow per unit couple (force × bore pitch) */
export const COUPLE_SCALE = 0.045;

const HEAD = 0.034;
let shaftGeo: BufferGeometry | null = null;
let headGeo: BufferGeometry | null = null;
const UP = new Vector3(0, 1, 0);
const tmpDir = new Vector3();

class Arrow {
  readonly group = new Group();
  private readonly shaft: Mesh;
  private readonly head: Mesh;
  constructor(color: string) {
    if (!shaftGeo) {
      shaftGeo = new CylinderGeometry(0.0055, 0.0055, 1, 8);
      shaftGeo.translate(0, 0.5, 0);
    }
    if (!headGeo) {
      headGeo = new ConeGeometry(0.015, HEAD, 14);
      headGeo.translate(0, HEAD / 2, 0);
    }
    const m = arrowMat(color);
    this.shaft = new Mesh(shaftGeo, m);
    this.head = new Mesh(headGeo, m);
    for (const o of [this.group, this.shaft, this.head]) {
      o.renderOrder = 40;
      o.raycast = () => {};
    }
    this.group.add(this.shaft, this.head);
  }
  set(ox: number, oy: number, oz: number, vy: number, vz: number) {
    const len = Math.hypot(vy, vz);
    this.group.visible = len > 0.004;
    if (!this.group.visible) return;
    this.group.position.set(ox, oy, oz);
    tmpDir.set(0, vy / len, vz / len);
    this.group.quaternion.setFromUnitVectors(UP, tmpDir);
    this.shaft.scale.set(1, Math.max(1e-3, len - HEAD), 1);
    this.head.position.y = Math.max(0, len - HEAD);
  }
}

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));

export interface BalanceVizProps {
  /** crank centre → where the end arrows of a couple stand (metres) */
  halfSpanM: number;
  tables: BalanceTable;
  active: boolean;
}

export function BalanceViz({ halfSpanM, tables, active }: BalanceVizProps) {
  const rig = useMemo(() => {
    const group = new Group();
    const a = halfSpanM;
    const f1 = new Arrow(ORDER_COLORS.primary);
    const f2 = new Arrow(ORDER_COLORS.secondary);
    const c1 = [new Arrow(ORDER_COLORS.primary), new Arrow(ORDER_COLORS.primary)];
    const c2 = [new Arrow(ORDER_COLORS.secondary), new Arrow(ORDER_COLORS.secondary)];
    group.add(f1.group, f2.group, ...c1.map((x) => x.group), ...c2.map((x) => x.group));

    // tip loci over one revolution
    const traces = new Group();
    const s = new Float32Array(8);
    const steps = 120;
    const loci: { x: number; pick: (b: Float32Array) => [number, number]; color: string }[] = [
      { x: 0, pick: (b) => [b[0] * FORCE_SCALE, b[1] * FORCE_SCALE], color: ORDER_COLORS.primary },
      {
        x: 0,
        pick: (b) => [b[2] * FORCE_SCALE, b[3] * FORCE_SCALE],
        color: ORDER_COLORS.secondary,
      },
      {
        x: a,
        pick: (b) => [b[5] * COUPLE_SCALE, -b[4] * COUPLE_SCALE],
        color: ORDER_COLORS.primary,
      },
      {
        x: -a,
        pick: (b) => [-b[5] * COUPLE_SCALE, b[4] * COUPLE_SCALE],
        color: ORDER_COLORS.primary,
      },
      {
        x: a,
        pick: (b) => [b[7] * COUPLE_SCALE, -b[6] * COUPLE_SCALE],
        color: ORDER_COLORS.secondary,
      },
      {
        x: -a,
        pick: (b) => [-b[7] * COUPLE_SCALE, b[6] * COUPLE_SCALE],
        color: ORDER_COLORS.secondary,
      },
    ];
    const geos: BufferGeometry[] = [];
    for (const l of loci) {
      const pos: number[] = [];
      let peak = 0;
      for (let k = 0; k < steps; k++) {
        sampleBalance(tables, (360 * k) / steps, s);
        const [y, z] = l.pick(s);
        peak = Math.max(peak, Math.hypot(y, z));
        pos.push(l.x, y, z);
      }
      if (peak < 0.004) continue;
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geos.push(g);
      const line = new LineLoop(g, traceMat(l.color));
      line.renderOrder = 39;
      line.raycast = () => {};
      traces.add(line);
    }
    group.add(traces);
    return { group, f1, f2, c1, c2, a, traces, geos, k: 0, sample: new Float32Array(8) };
  }, [halfSpanM, tables]);

  useEffect(() => () => rig.geos.forEach((g) => g.dispose()), [rig]);

  useFrame((_, dt) => {
    rig.k = damp(rig.k, active ? 1 : 0, 6, Math.min(dt, 0.1));
    const on = rig.k > 0.01;
    rig.group.visible = on;
    // bounding boxes ignore visibility: collapse the hidden arrows (unit-length shafts at rest)
    // so they don't stretch the engine's box a metre upward when the camera frames it
    rig.group.scale.setScalar(on ? 1 : 1e-6);
    if (!on) return;
    for (let o: Object3D | null = rig.group.parent; o; o = o.parent) if (!o.visible) return;
    const b = rig.sample;
    sampleBalance(tables, engineRuntime.crankDeg, b);
    const k = rig.k;
    const F = FORCE_SCALE * k;
    const C = COUPLE_SCALE * k;
    rig.f1.set(0, 0, 0, b[0] * F, b[1] * F);
    rig.f2.set(0, 0, 0, b[2] * F, b[3] * F);
    // couple (0, my, mz) as +F at the front end and −F at the rear: F ∝ (mz, −my)
    rig.c1[0].set(rig.a, 0, 0, b[5] * C, -b[4] * C);
    rig.c1[1].set(-rig.a, 0, 0, -b[5] * C, b[4] * C);
    rig.c2[0].set(rig.a, 0, 0, b[7] * C, -b[6] * C);
    rig.c2[1].set(-rig.a, 0, 0, -b[7] * C, b[6] * C);
    rig.traces.scale.set(1, k, k);
  });

  return <primitive object={rig.group} />;
}

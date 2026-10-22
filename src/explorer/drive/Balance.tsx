/**
 * A car's balance, drawn on the road as it happens.
 *  - At each axle a wedge between where its wheels point and where that axle is actually
 *    travelling: the slip angle, true size. A bigger front wedge is understeer, a bigger rear
 *    one oversteer; amber means that axle is at its grip limit, red that it is sliding.
 *  - For the visitor's car, two lines ahead of it: dashed, the curve the steering asks for
 *    (wheel angle over wheelbase, as if the tyres didn't slip); solid, the curve it is actually
 *    on (yaw rate over speed). Dashed inside solid = understeer; solid inside, or the dashed one
 *    bending the other way (countersteer) = oversteer.
 * Geometry is preallocated and rewritten in place each frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import { axleUse, FL, RL } from '../../sim/model';
import type { DriveColors } from './colors';
import type { Lane } from './lanes';
import { gripColor } from './Tracks';

const SEG = 16;
const Y = 0.035;
/** ray width (m) and arrowhead size */
const RAY_W = 0.05;
const HEAD = 0.28;
/** the intent/actual lines: how far ahead (s of travel, within limits) and how wide */
const AHEAD_S = 1.6;
const ARC_N = 32;
const ARC_W = 0.11;

const shaft = new PlaneGeometry(1, RAY_W).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
const headShape = new Shape();
headShape.moveTo(0, -HEAD * 0.45);
headShape.lineTo(HEAD, 0);
headShape.lineTo(0, HEAD * 0.45);
headShape.closePath();
const head = new ShapeGeometry(headShape).rotateX(-Math.PI / 2);

/** A filled circular sector whose angles change every frame. */
class Fan {
  readonly geo = new BufferGeometry();
  private readonly pos = new Float32Array((SEG + 2) * 3);
  constructor() {
    const idx = new Uint16Array(SEG * 3);
    for (let i = 0; i < SEG; i++) idx.set([0, i + 1, i + 2], i * 3);
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
  }
  /** Sector from heading a0 to a1 (sim radians: 0 = +X, + = toward −Z), radius r, at (x, z). */
  set(x: number, z: number, a0: number, a1: number, r: number) {
    const p = this.pos;
    p[0] = x;
    p[1] = Y;
    p[2] = z;
    for (let i = 0; i <= SEG; i++) {
      const a = a0 + ((a1 - a0) * i) / SEG;
      const o = (i + 1) * 3;
      p[o] = x + r * Math.cos(a);
      p[o + 1] = Y;
      p[o + 2] = z - r * Math.sin(a);
    }
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

/** A ribbon along a circular arc (optionally dashed), rewritten each frame. */
class ArcRibbon {
  readonly geo = new BufferGeometry();
  private readonly pos = new Float32Array((ARC_N + 1) * 2 * 3);
  constructor(dashed: boolean) {
    const idx: number[] = [];
    for (let i = 0; i < ARC_N; i++) {
      if (dashed && i % 2 === 1) continue;
      const v = i * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
  }
  /** From (x, n) heading h, curvature k (1/m, + = left), length len (sim ground frame). */
  set(x: number, n: number, h: number, k: number, len: number) {
    const p = this.pos;
    for (let i = 0; i <= ARC_N; i++) {
      const s = (len * i) / ARC_N;
      const a = h + k * s;
      let px: number;
      let pn: number;
      if (Math.abs(k) < 1e-5) {
        px = x + s * Math.cos(h);
        pn = n + s * Math.sin(h);
      } else {
        px = x + (Math.sin(a) - Math.sin(h)) / k;
        pn = n - (Math.cos(a) - Math.cos(h)) / k;
      }
      // half-width sideways, then sim (x, n) → world (x, −n)
      const sx = -Math.sin(a) * (ARC_W / 2);
      const sn = Math.cos(a) * (ARC_W / 2);
      const o = i * 6;
      p[o] = px + sx;
      p[o + 1] = Y;
      p[o + 2] = -(pn + sn);
      p[o + 3] = px - sx;
      p[o + 4] = Y;
      p[o + 5] = -(pn - sn);
    }
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

function overlay(color: string, opacity: number) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    // a wedge opens either way round
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -60,
  });
}

function mesh(geo: BufferGeometry, mat: MeshBasicMaterial, order = 4) {
  const m = new Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = order;
  return m;
}

export interface BalanceProps {
  lane: Lane;
  colors: DriveColors;
  /** draw the steering-vs-actual lines too (the visitor's car) */
  intent?: boolean;
  /** wedge length (m) */
  size?: number;
  /** the wheel and travel lines along the wedge edges */
  rays?: boolean;
}

export function Balance({ lane, colors, intent = false, size = 2.6, rays = true }: BalanceProps) {
  const parts = useMemo(() => {
    const axles = [0, 1].map(() => {
      const fan = new Fan();
      const fill = overlay(colors.grip, 0.42);
      const edge = overlay(colors.grip, 0.95);
      const f = mesh(fan.geo, fill);
      // the wheels' direction (plain line) and the axle's direction of travel (arrow)
      const wheel = mesh(shaft, edge, 5);
      const travel = mesh(shaft, edge, 5);
      const tip = mesh(head, edge, 5);
      return { fan, fill, edge, meshes: [f, wheel, travel, tip], wheel, travel, tip };
    });
    const wants = new ArcRibbon(true);
    const takes = new ArcRibbon(false);
    const wantsMat = overlay(colors.you, 0.7);
    const takesMat = overlay(colors.you, 0.85);
    return {
      axles,
      wants,
      takes,
      wantsMat,
      takesMat,
      arcs: [mesh(wants.geo, wantsMat, 6), mesh(takes.geo, takesMat, 6)],
    };
  }, [colors]);
  useEffect(
    () => () => {
      for (const a of parts.axles) {
        a.fan.geo.dispose();
        a.fill.dispose();
        a.edge.dispose();
      }
      parts.wants.geo.dispose();
      parts.takes.geo.dispose();
      parts.wantsMat.dispose();
      parts.takesMat.dispose();
    },
    [parts],
  );
  const palette = useMemo(
    () => ({
      grip: new Color(colors.ring),
      limit: new Color(colors.limit),
      slide: new Color(colors.slide),
    }),
    [colors],
  );

  useFrame(() => {
    const { p, view: st } = lane;
    const v = Math.hypot(st.vx, st.vy);
    // once the car has gone round, slip angles stop meaning anything
    const moving = v > 1 && !st.spun;
    const c = Math.cos(st.yaw);
    const s = Math.sin(st.yaw);
    for (let k = 0; k < 2; k++) {
      const a = parts.axles[k];
      a.meshes.forEach((m, j) => (m.visible = moving && (rays || j === 0)));
      if (!moving) continue;
      const front = k === 0;
      const ax = front ? p.a : -p.b;
      // axle centre, world
      const x = st.x + c * ax;
      const z = -(st.n + s * ax);
      // wheel direction and the axle's direction of travel (sim headings); the rear wedge is
      // drawn behind the car, pointing back
      const back = front ? 0 : Math.PI;
      const wheelDir = st.yaw + (front ? st.steer - st.twist : 0) + back;
      const travelDir = st.yaw + Math.atan2(st.vy + ax * st.r, st.vx) + back;
      a.fan.set(x, z, wheelDir, travelDir, size);
      for (const [m, dir, len] of [
        [a.wheel, wheelDir, size],
        [a.travel, travelDir, size - HEAD],
      ] as const) {
        m.position.set(x, Y, z);
        m.rotation.set(0, dir, 0);
        m.scale.set(len, 1, 1);
      }
      a.tip.position.set(
        x + (size - HEAD) * Math.cos(travelDir),
        Y,
        z - (size - HEAD) * Math.sin(travelDir),
      );
      a.tip.rotation.set(0, travelDir, 0);
      const use = axleUse(st, front ? FL : RL);
      gripColor(a.fill.color, use, palette);
      a.edge.color.copy(a.fill.color);
    }

    const [wantsMesh, takesMesh] = parts.arcs;
    const arcs = intent && moving && v > 2;
    wantsMesh.visible = takesMesh.visible = arcs;
    if (arcs) {
      const len = Math.min(30, Math.max(8, v * AHEAD_S));
      const course = st.yaw + Math.atan2(st.vy, st.vx);
      // start a little ahead of the nose so the car body doesn't hide the start
      const lead = p.a + p.dims.overhangF;
      const sx = st.x + Math.cos(course) * lead;
      const sn = st.n + Math.sin(course) * lead;
      parts.takes.set(sx, sn, course, st.r / v, len);
      parts.wants.set(sx, sn, course, Math.tan(st.steer - st.twist) / p.L, len);
    }
  });

  return (
    <group>
      {parts.axles.flatMap((a, i) =>
        a.meshes.map((m, j) => <primitive key={`${i}-${j}`} object={m} />),
      )}
      {parts.arcs.map((m, i) => (
        <primitive key={`arc${i}`} object={m} />
      ))}
    </group>
  );
}

/**
 * EngineLayout → three.js geometry, merged per part and material so even a W16 is a few dozen
 * draw calls. Static parts are baked in the engine frame; moving parts (crank, cams, flywheel,
 * turbo wheels) in their own rotation frame; reciprocating parts as one instanced geometry each.
 * Built in millimetres and scaled to metres.
 */
import {
  Box3,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  Curve,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DEG } from '../spec/units';
import {
  CAM_HALF_DEG,
  engineLayout,
  fromBank,
  headToEngine,
  pushrodAxis,
  type EngineLayout,
} from './layout';
import { chainLoop, exhaustRoutes, runnerRoutes, type LoopPath } from './paths';
import {
  MM,
  circle,
  cylX,
  cylY,
  extrudeYZ,
  gear,
  hull,
  mergeM,
  roundedRect,
  type V3,
  type YZ,
} from './prims';
import type { EngineSpec } from '../spec/types';

export type Lod = 'low' | 'high';

export interface CamGeometry {
  cam: number;
  head: number;
  geometry: BufferGeometry;
  /** cam axis (metres): head frame [0, along, across], or engine frame for a block cam */
  position: V3;
}

export interface TurboGeometry {
  hot: BufferGeometry;
  cold: BufferGeometry;
  /** compressor wheel centre (metres, engine frame) */
  wheelAt: V3;
}

export interface EngineGeometry {
  layout: EngineLayout;
  block: BufferGeometry;
  liners: BufferGeometry;
  sump: BufferGeometry;
  heads: { casting: BufferGeometry; cover: BufferGeometry; coils: BufferGeometry | null }[];
  crankSteel: BufferGeometry;
  crankWebs: BufferGeometry;
  flywheel: BufferGeometry;
  cams: CamGeometry[];
  /** OHV rocker arms per head (engine frame) */
  rockers: (BufferGeometry | null)[];
  timingCover: BufferGeometry;
  chains: LoopPath[];
  chainLink: BufferGeometry | null;
  intake: BufferGeometry[];
  exhaust: BufferGeometry[];
  turbos: TurboGeometry[];
  turboWheel: BufferGeometry;
  // instanced (local frames)
  piston: BufferGeometry;
  pistonRings: BufferGeometry;
  rod: BufferGeometry;
  glow: BufferGeometry;
  valve: BufferGeometry;
  valveRefMm: number;
  spring: BufferGeometry | null;
  springRefMm: number;
  pushrod: BufferGeometry | null;
  pushrodRefMm: number;
}

const segsFor = (lod: Lod, high: number) =>
  lod === 'high' ? high : Math.max(6, Math.round(high / 2));

/** Apply a head-frame tilt to geometry built with +Y along the bank axis. */
const tilt = (g: BufferGeometry, tiltDeg: number) => g.rotateX(tiltDeg * DEG);

/** A cylinder between two points (mm). */
function rodBetween(a: V3, b: V3, r: number, segs = 8): BufferGeometry {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const d = vb.clone().sub(va);
  const g = new CylinderGeometry(r, r, Math.max(0.1, d.length()), segs);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new Vector3(1, 1, 1)));
  return g;
}

function crankGeometry(l: EngineLayout, lod: Lod) {
  const c = l.crank;
  const r = c.throwMm;
  const n = segsFor(lod, 28);
  const steel: BufferGeometry[] = [];
  const webs: BufferGeometry[] = [];
  for (const j of c.journals)
    steel.push(cylX(c.journalRadiusMm, j.axialMm - j.lengthMm / 2, j.axialMm + j.lengthMm / 2, n));
  for (const p of c.pins) {
    const t = p.throwDeg * DEG;
    steel.push(
      cylX(
        c.pinRadiusMm,
        p.axialMm - p.lengthMm / 2,
        p.axialMm + p.lengthMm / 2,
        n,
        r * Math.cos(t),
        r * Math.sin(t),
      ),
    );
  }
  const pinAt = (deg: number): YZ => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)];
  for (const w of c.webs) {
    const pts: YZ[] = [];
    for (const deg of w.throws) pts.push(...circle(...pinAt(deg), c.pinRadiusMm + 6, 20));
    if (w.counterweight) {
      pts.push(...circle(0, 0, c.journalRadiusMm + 5, 20));
      const opp = (w.throws[0] + 180) * DEG;
      for (let k = -6; k <= 6; k++) {
        const a = opp + (k / 6) * 72 * DEG;
        pts.push([c.counterweightRadiusMm * Math.cos(a), c.counterweightRadiusMm * Math.sin(a)]);
      }
    }
    webs.push(
      extrudeYZ(hull(pts), w.axialMm - w.thicknessMm / 2, w.axialMm + w.thicknessMm / 2, {
        bevel: lod === 'high' ? Math.min(2, w.thicknessMm * 0.2) : 0,
      }),
    );
  }
  // snout through the timing sprockets to the damper pulley, flange at the flywheel end
  const front = c.journals[c.journals.length - 1];
  const rear = c.journals[0];
  steel.push(cylX(c.journalRadiusMm * 0.62, front.axialMm + front.lengthMm / 2, l.pulley.x1, n));
  steel.push(cylX(c.journalRadiusMm * 1.3, l.flywheel.x1, rear.axialMm - rear.lengthMm / 2, n));
  const rc = l.timing.crankSprocketMm;
  for (const loop of l.timing.loops)
    webs.push(extrudeYZ(gear(rc, 20, 3.2), loop.x - 3.5, loop.x + 3.5));
  const pr = l.pulley.radiusMm;
  webs.push(cylX(pr, l.pulley.x0 + 1, l.pulley.x1, n));
  if (lod === 'high') {
    for (let k = 0; k < 3; k++) {
      const x = l.pulley.x0 + 3 + ((l.pulley.x1 - l.pulley.x0 - 6) * (k + 0.5)) / 3;
      steel.push(cylX(pr * 1.012, x - 1, x + 1, n, 0, 0, true));
    }
  }
  return { steel: mergeM(steel), webs: mergeM(webs) };
}

/** Distance from the origin to where a ray at angle a leaves a convex polygon around the origin. */
function rayExit(poly: YZ[], a: number): number {
  const dy = Math.cos(a);
  const dz = Math.sin(a);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ay, az] = poly[i];
    const [by, bz] = poly[(i + 1) % poly.length];
    const ey = by - ay;
    const ez = bz - az;
    const den = dy * ez - dz * ey;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ay * ez - az * ey) / den;
    const u = (ay * dz - az * dy) / den;
    if (t > best && u >= -1e-9 && u <= 1 + 1e-9) best = t;
  }
  return best;
}

/**
 * Outline of the union of convex shapes that each contain the origin (so the union is
 * star-shaped about it): the farthest exit along each ray.
 */
export function starUnion(shapes: YZ[][], steps = 720): YZ[] {
  const out: YZ[] = [];
  for (let k = 0; k < steps; k++) {
    const a = (2 * Math.PI * k) / steps;
    let r = 0;
    for (const s of shapes) r = Math.max(r, rayExit(s, a));
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

function blockGeometry(l: EngineLayout, lod: Lod) {
  const { spec, dims: d } = l;
  const R = d.crankcaseRadiusMm;
  // crankcase plus one casting per bank, unioned so a vee keeps its open valley
  const shapes: YZ[][] = [roundedRect(0, 0, R, R, R * 0.3, 4)];
  for (const bank of spec.banks) {
    const w = d.blockWidthMm / 2;
    shapes.push([
      fromBank(bank.tiltDeg, -0.15 * R, -w),
      fromBank(bank.tiltDeg, -0.15 * R, w),
      fromBank(bank.tiltDeg, d.deckMm, w),
      fromBank(bank.tiltDeg, d.deckMm, -w),
    ]);
  }
  const block = mergeM([
    extrudeYZ(starUnion(shapes, lod === 'high' ? 720 : 360), l.blockX0, l.blockX1, { bevel: 4 }),
  ]);

  const n = segsFor(lod, 28);
  const liners: BufferGeometry[] = [];
  for (const c of l.cylinders) {
    const g = cylY(spec.boreMm / 2 + 1, l.linerBottomMm, d.deckMm, n, true);
    tilt(g, c.tiltDeg).translate(c.axialMm, 0, 0);
    liners.push(g);
  }
  const sumpLen = l.blockX1 - l.blockX0 - 16;
  const sh = d.sumpDepthMm + 12;
  const sump = new RoundedBoxGeometry(sumpLen, sh, 2 * R * 0.92, 2, Math.min(8, sh * 0.3));
  sump.translate((l.blockX0 + l.blockX1) / 2, -R - d.sumpDepthMm + sh / 2, 0);
  const plug = cylY(6, -R - d.sumpDepthMm - 4, -R - d.sumpDepthMm + 2, 10);
  plug.translate(l.blockX0 + 40, 0, 0);
  return { block, liners: mergeM(liners), sump: mergeM([sump, plug]) };
}

function headGeometry(l: EngineLayout, lod: Lod) {
  const { spec, dims: d } = l;
  const len = l.blockX1 - l.blockX0;
  const mid = (l.blockX0 + l.blockX1) / 2;
  return l.heads.map((h) => {
    const cast = new RoundedBoxGeometry(len, h.castMm, 2 * h.halfWidthMm, 2, 6);
    cast.translate(mid, d.deckMm + h.castMm / 2, 0);
    tilt(cast, h.tiltDeg);
    const cover = new RoundedBoxGeometry(
      len - 12,
      h.coverMm,
      2 * h.halfWidthMm * 0.88,
      3,
      Math.min(14, h.coverMm * 0.45),
    );
    cover.translate(mid, d.deckMm + h.castMm + h.coverMm / 2, 0);
    tilt(cover, h.tiltDeg);
    let coils: BufferGeometry | null = null;
    if (spec.valvetrain.type !== 'ohv' && lod === 'high') {
      coils = mergeM(
        h.cylinders.map((i) => {
          const c = l.cylinders[i];
          const g = cylY(
            0.09 * spec.boreMm,
            d.deckMm + 0.35 * h.castMm,
            d.deckMm + d.headHeightMm - 6,
            10,
          );
          g.translate(c.axialMm, 0, c.deckAcrossMm);
          return tilt(g, h.tiltDeg);
        }),
      );
    }
    return { casting: mergeM([cast]), cover: mergeM([cover]), coils };
  });
}

function camGeometry(l: EngineLayout, lod: Lod): CamGeometry[] {
  const n = segsFor(lod, 20);
  const rc = l.timing.crankSprocketMm;
  return l.cams.map((cam, ci) => {
    const parts: BufferGeometry[] = [cylX(cam.baseRadiusMm * 0.55, cam.x0, cam.x1, n)];
    const step = lod === 'high' ? 6 : 12;
    for (const lobe of cam.lobes) {
      const pts: YZ[] = [];
      for (let phi = -180; phi < 180; phi += step) {
        const b =
          Math.abs(phi) < CAM_HALF_DEG ? Math.cos((Math.PI / 2) * (phi / CAM_HALF_DEG)) ** 2 : 0;
        const rr = cam.baseRadiusMm + cam.liftMm * b;
        const a = (phi + lobe.angleDeg) * DEG;
        pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
      }
      parts.push(extrudeYZ(pts, lobe.axialMm - lobe.widthMm / 2, lobe.axialMm + lobe.widthMm / 2));
    }
    // bearing journals between cylinders
    const xs = l.cylinders.filter((c) => cam.head < 0 || c.head === cam.head).map((c) => c.axialMm);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const nj = Math.max(2, Math.round((hi - lo) / l.spec.borePitchMm) + 2);
    for (let k = 0; k < nj; k++) {
      const x = lo - l.spec.borePitchMm / 2 + ((hi - lo + l.spec.borePitchMm) * k) / (nj - 1);
      if (x < cam.x0 + 4 || x > cam.x1 - 12) continue;
      parts.push(cylX(cam.baseRadiusMm * 0.92, x - 5, x + 5, n));
    }
    parts.push(extrudeYZ(gear(2 * rc, 40, 3.2), cam.sprocketX - 3.5, cam.sprocketX + 3.5));
    return {
      cam: ci,
      head: cam.head,
      geometry: mergeM(parts),
      position: [0, cam.at[0] * MM, cam.at[1] * MM],
    };
  });
}

function rockerGeometry(l: EngineLayout): (BufferGeometry | null)[] {
  return l.heads.map((_, hi) => {
    const mine = l.pushrods.filter((p) => p.head === hi);
    if (mine.length === 0) return null;
    return mergeM(
      mine.map((p) => {
        const v = l.valves[p.valve];
        const t = l.heads[v.head].tiltDeg;
        const top = headToEngine(t, [v.seat[0], v.seat[1] + v.lengthMm, v.seat[2]]);
        return rodBetween(p.to, top, 4, 6);
      }),
    );
  });
}

function timingCover(l: EngineLayout) {
  const pts: YZ[] = [];
  for (const loop of l.timing.loops)
    for (const s of loop.sprockets) pts.push(...circle(s.at[0], s.at[1], s.r + 9, 24));
  return mergeM([extrudeYZ(hull(pts), l.timing.coverX0, l.timing.coverX1, { bevel: 3 })]);
}

function intakeGeometry(l: EngineLayout, lod: Lod) {
  const runners = runnerRoutes(l);
  const tubeSegs = segsFor(lod, 28);
  const radial = segsFor(lod, 12);
  return l.plenums.map((pl, pi) => {
    const parts: BufferGeometry[] = [];
    const len = Math.max(10, pl.x1 - pl.x0 - 2 * pl.radiusMm);
    const cap = new CapsuleGeometry(pl.radiusMm, len, segsFor(lod, 6), segsFor(lod, 24));
    cap.rotateZ(-Math.PI / 2);
    cap.translate((pl.x0 + pl.x1) / 2, pl.at[0], pl.at[1]);
    parts.push(cap);
    const tb = pl.radiusMm * 0.55;
    parts.push(cylX(tb, pl.x1 - 4, pl.x1 + 42, radial, pl.at[0], pl.at[1]));
    parts.push(cylX(tb * 1.15, pl.x1 + 36, pl.x1 + 46, radial, pl.at[0], pl.at[1]));
    const runnerR = 0.2 * l.spec.boreMm;
    runners.forEach((r, k) => {
      if (l.runners[k].plenum === pi)
        parts.push(new TubeGeometry(r.curve, tubeSegs, runnerR, radial, false));
    });
    if (l.supercharged && pi === 0) {
      const w = pl.x1 - pl.x0;
      const blower = new RoundedBoxGeometry(w * 0.8, pl.radiusMm * 1.4, pl.radiusMm * 2.2, 2, 10);
      blower.translate((pl.x0 + pl.x1) / 2, pl.at[0] + pl.radiusMm * 1.5, pl.at[1]);
      parts.push(blower);
      parts.push(
        cylX(
          pl.radiusMm * 0.6,
          pl.x1 - w * 0.1,
          pl.x1 + 10,
          radial,
          pl.at[0] + pl.radiusMm * 1.5,
          pl.at[1],
        ),
      );
    }
    return mergeM(parts);
  });
}

function exhaustGeometry(l: EngineLayout, lod: Lod) {
  const routes = exhaustRoutes(l);
  const tubeSegs = segsFor(lod, 48);
  const radial = segsFor(lod, 10);
  const pipeR = 0.21 * l.spec.boreMm;
  return l.exhaust.map((g, gi) => {
    const parts: BufferGeometry[] = [];
    for (const r of routes)
      if (g.cylinders.includes(r.cyl))
        parts.push(new TubeGeometry(r.curve, tubeSegs, pipeR, radial, false));
    const c = new Vector3(...g.collector);
    const merge = new SphereGeometry(pipeR * 1.6, radial, radial);
    merge.translate(c.x, c.y, c.z);
    parts.push(merge);
    const out = new Vector3(0, g.outDir[0], g.outDir[1]);
    if (g.turbo < 0) {
      // NA: a collector tail heading rearward into the car's exhaust run
      const end = c
        .clone()
        .add(new Vector3(-180, -50, 0))
        .addScaledVector(out, 30);
      const curve = new CatmullRomCurve3([
        c,
        c
          .clone()
          .addScaledVector(out, 25)
          .add(new Vector3(-40, -10, 0)),
        end,
      ]);
      parts.push(new TubeGeometry(curve, segsFor(lod, 16), pipeR * 1.35, radial, false));
    } else {
      const t = l.turbos[g.turbo];
      const tc = new Vector3(...t.at);
      if (tc.distanceTo(c) > t.radiusMm * 1.6) {
        const inlet = tc.clone().addScaledVector(out, -t.radiusMm * 0.7);
        parts.push(
          new TubeGeometry(
            new CatmullRomCurve3([c, c.clone().lerp(inlet, 0.5), inlet]),
            12,
            pipeR * 1.3,
            radial,
            false,
          ),
        );
      }
    }
    if (l.crossover && gi === 0 && l.exhaust.length === 2) {
      const a = c;
      const b = new Vector3(...l.exhaust[1].collector);
      const low = Math.min(a.y, b.y) - 40;
      const mid = new Vector3((a.x + b.x) / 2 - 60, low, (a.z + b.z) / 2);
      parts.push(
        new TubeGeometry(new CatmullRomCurve3([a, mid, b]), 24, pipeR * 1.1, radial, false),
      );
    }
    return mergeM(parts);
  });
}

function turboGeometry(l: EngineLayout, lod: Lod): TurboGeometry[] {
  const radial = segsFor(lod, 24);
  return l.turbos.map((t) => {
    const R = t.radiusMm;
    const [x, y, z] = t.at;
    const hot: BufferGeometry[] = [];
    const cold: BufferGeometry[] = [];
    const scroll = (xc: number, rr: number, tube: number) => {
      const g = new TorusGeometry(rr, tube, segsFor(lod, 10), radial);
      g.rotateY(Math.PI / 2);
      g.translate(xc, y, z);
      return g;
    };
    hot.push(
      scroll(x - 0.5 * R, 0.6 * R, 0.38 * R),
      cylX(0.62 * R, x - 0.78 * R, x - 0.22 * R, radial, y, z),
    );
    // turbine outlet → downpipe heading rearward
    const exitX = x - 0.8 * R;
    const down = new CatmullRomCurve3([
      new Vector3(exitX, y, z),
      new Vector3(exitX - 60, y - 20, z),
      new Vector3(exitX - 170, y - 70, z + t.outDir[1] * 20),
    ]);
    hot.push(new TubeGeometry(down, 16, 0.38 * R, segsFor(lod, 12), false));
    hot.push(cylX(0.3 * R, x - 0.25 * R, x + 0.3 * R, radial, y, z));
    cold.push(
      scroll(x + 0.62 * R, 0.62 * R, 0.36 * R),
      cylX(0.66 * R, x + 0.32 * R, x + 0.9 * R, radial, y, z, false),
    );
    cold.push(cylX(0.46 * R, x + 0.9 * R, x + 1.45 * R, radial, y, z, true));
    // charge pipe: compressor scroll → throttle body on the nearest plenum
    const pl = l.plenums.reduce((best, p) =>
      Math.hypot(p.at[0] - y, p.at[1] - z) < Math.hypot(best.at[0] - y, best.at[1] - z) ? p : best,
    );
    const s = new Vector3(x + 0.62 * R, y + t.outDir[0] * 0.95 * R, z + t.outDir[1] * 0.95 * R);
    const e = new Vector3(pl.x1 + 46, pl.at[0], pl.at[1]);
    const lift = new Vector3(0, t.outDir[0], t.outDir[1]).multiplyScalar(60);
    const charge = new CatmullRomCurve3([
      s,
      s
        .clone()
        .add(lift)
        .add(new Vector3(40, 0, 0)),
      e
        .clone()
        .add(new Vector3(70, 0, 0))
        .add(lift.clone().multiplyScalar(0.5)),
      e.clone().add(new Vector3(20, 0, 0)),
    ]);
    cold.push(
      new TubeGeometry(charge, segsFor(lod, 32), pl.radiusMm * 0.5, segsFor(lod, 12), false),
    );
    return { hot: mergeM(hot), cold: mergeM(cold), wheelAt: [(x + 1.0 * R) * MM, y * MM, z * MM] };
  });
}

function turboWheelGeometry(l: EngineLayout, lod: Lod) {
  const R = l.turbos[0]?.radiusMm ?? 50;
  const parts: BufferGeometry[] = [];
  const hub = new CylinderGeometry(0.08 * R, 0.2 * R, 0.4 * R, 12);
  hub.rotateZ(-Math.PI / 2);
  parts.push(hub);
  const blades = lod === 'high' ? 8 : 5;
  for (let k = 0; k < blades; k++) {
    const b = new RoundedBoxGeometry(0.36 * R, 0.3 * R, 0.03 * R, 1, 0.01 * R);
    b.translate(0, 0.2 * R, 0);
    b.rotateY(0.35);
    b.rotateX((2 * Math.PI * k) / blades);
    parts.push(b);
  }
  return mergeM(parts);
}

/** Piston (gudgeon-pin centre at the origin, crown toward +Y). */
function pistonGeometry(l: EngineLayout, lod: Lod) {
  const p = l.piston;
  const n = segsFor(lod, 32);
  const prof = [
    new Vector2(0, p.compressionMm),
    new Vector2(p.radiusMm - 1.5, p.compressionMm),
    new Vector2(p.radiusMm, p.compressionMm - 1.5),
    new Vector2(p.radiusMm, -p.skirtMm),
    new Vector2(p.radiusMm - 3, -p.skirtMm),
    new Vector2(p.radiusMm - 3, p.compressionMm - 0.45 * p.compressionMm),
    new Vector2(0, p.compressionMm - 0.45 * p.compressionMm),
  ];
  const piston = new LatheGeometry(prof, n);
  const rings: BufferGeometry[] = [];
  if (lod === 'high') {
    const gap = Math.max(2.5, 0.05 * l.spec.boreMm);
    for (let k = 0; k < 3; k++) {
      const y = p.compressionMm - gap * (k + 1);
      rings.push(cylY(p.radiusMm + 0.35, y - 0.8, y + 0.8, n, true));
    }
  }
  rings.push(cylX(p.gudgeonRadiusMm, -p.radiusMm * 0.82, p.radiusMm * 0.82, 14));
  return { piston: mergeM([piston]), rings: mergeM(rings) };
}

/** I-beam con-rod: big eye at the origin around the crank pin, small eye at +Y = rod length. */
function rodGeometry(l: EngineLayout, lod: Lod) {
  const { spec, crank: c, piston: p } = l;
  const L = spec.rodMm;
  const w = c.rodWidthMm;
  const n = segsFor(lod, 24);
  const RB = c.pinRadiusMm * 1.38;
  const RS = p.gudgeonRadiusMm + Math.max(3.5, 0.05 * spec.boreMm);
  const parts: BufferGeometry[] = [];
  const ring = (cy: number, ro: number, ri: number, half: number) =>
    extrudeYZ(circle(cy, 0, ro, n), -half, half, { holes: [circle(cy, 0, ri, n)] });
  parts.push(ring(0, RB, c.pinRadiusMm + 0.3, w / 2));
  parts.push(ring(L, RS, p.gudgeonRadiusMm + 0.3, w / 2));
  // shank: two flanges and a thinner web between them
  const y0 = RB * 0.8;
  const y1 = L - RS * 0.75;
  const b0 = RB * 0.62;
  const b1 = RS * 0.8;
  const t0 = RB * 0.2;
  const t1 = RS * 0.3;
  for (const s of [-1, 1]) {
    parts.push(
      extrudeYZ(
        [
          [y0, s * b0],
          [y1, s * b1],
          [y1, s * (b1 - t1)],
          [y0, s * (b0 - t0)],
        ],
        -w / 2,
        w / 2,
      ),
    );
  }
  parts.push(
    extrudeYZ(
      [
        [y0, b0 - t0],
        [y1, b1 - t1],
        [y1, -(b1 - t1)],
        [y0, -(b0 - t0)],
      ],
      -w * 0.2,
      w * 0.2,
    ),
  );
  if (lod === 'high') {
    // big-end cap bolts
    for (const s of [-1, 1]) {
      const g = cylY(Math.max(2, 0.12 * c.pinRadiusMm), -RB * 0.9, RB * 0.55, 8);
      g.translate(0, 0, s * (c.pinRadiusMm + (RB - c.pinRadiusMm) / 2));
      parts.push(g);
    }
  }
  return mergeM(parts);
}

function valveGeometry(l: EngineLayout, lod: Lod) {
  const bore = l.spec.boreMm;
  const ref = l.valves.reduce((a, v) => a + v.lengthMm, 0) / Math.max(1, l.valves.length);
  const d = l.valves.find((v) => v.kind === 'intake')?.headDiaMm ?? 0.37 * bore;
  const stem = Math.max(2.5, 0.035 * bore);
  const n = segsFor(lod, 18);
  const head = new LatheGeometry(
    [
      new Vector2(0, 0),
      new Vector2(d / 2, 0),
      new Vector2(d / 2, 0.04 * d),
      new Vector2(stem, 0.28 * d),
    ],
    n,
  );
  const parts: BufferGeometry[] = [head, cylY(stem, 0.25 * d, ref, 8)];
  if (l.spec.valvetrain.type !== 'ohv') parts.push(cylY(0.17 * bore, ref - 0.1 * bore, ref, n));
  else parts.push(cylY(stem * 2.4, ref - 0.08 * bore, ref - 0.04 * bore, n));
  return { valve: mergeM(parts), ref };
}

class Helix extends Curve<Vector3> {
  private r: number;
  private h: number;
  private turns: number;
  constructor(r: number, h: number, turns: number) {
    super();
    this.r = r;
    this.h = h;
    this.turns = turns;
  }
  getPoint(t: number, target = new Vector3()) {
    const a = 2 * Math.PI * this.turns * t;
    return target.set(this.r * Math.cos(a), this.h * t, this.r * Math.sin(a));
  }
}

function springGeometry(l: EngineLayout) {
  const bore = l.spec.boreMm;
  const ref = 0.42 * (l.valves.reduce((a, v) => a + v.lengthMm, 0) / Math.max(1, l.valves.length));
  const g = new TubeGeometry(
    new Helix(0.12 * bore, ref, 6),
    96,
    Math.max(0.9, 0.018 * bore),
    5,
    false,
  );
  return { spring: mergeM([g]), ref };
}

function pushrodGeometry(l: EngineLayout) {
  if (l.pushrods.length === 0) return { pushrod: null, ref: 1 };
  const ref = l.pushrods.reduce((a, p) => a + pushrodAxis(p).lengthMm, 0) / l.pushrods.length;
  return { pushrod: mergeM([cylY(3.2, 0, ref, 8)]), ref };
}

/** Build everything for one engine. Dispose with disposeEngineGeometry(). */
export function buildEngineGeometry(
  spec: EngineSpec,
  lod: Lod = 'high',
  layout = engineLayout(spec),
): EngineGeometry {
  const l = layout;
  const crank = crankGeometry(l, lod);
  const block = blockGeometry(l, lod);
  const pistons = pistonGeometry(l, lod);
  const valve = valveGeometry(l, lod);
  const spring = springGeometry(l);
  const pushrod = pushrodGeometry(l);
  const fly = l.flywheel;
  const flyParts = [cylX(fly.radiusMm * 0.94, fly.x0, fly.x1, segsFor(lod, 40))];
  if (lod === 'high')
    flyParts.push(extrudeYZ(gear(fly.radiusMm, 96, 3), fly.x0, fly.x0 + (fly.x1 - fly.x0) * 0.6));
  const glow = new CylinderGeometry(0.46 * spec.boreMm, 0.46 * spec.boreMm, 1000, segsFor(lod, 24));
  glow.translate(0, 500, 0);
  return {
    layout: l,
    block: block.block,
    liners: block.liners,
    sump: block.sump,
    heads: headGeometry(l, lod),
    crankSteel: crank.steel,
    crankWebs: crank.webs,
    flywheel: mergeM(flyParts),
    cams: camGeometry(l, lod),
    rockers: rockerGeometry(l),
    timingCover: timingCover(l),
    chains: l.timing.loops.map((loop) => chainLoop(loop)),
    chainLink: lod === 'high' ? mergeM([new RoundedBoxGeometry(7, 8.6, 3.2, 1, 1)]) : null,
    intake: intakeGeometry(l, lod),
    exhaust: exhaustGeometry(l, lod),
    turbos: turboGeometry(l, lod),
    turboWheel: turboWheelGeometry(l, lod),
    piston: pistons.piston,
    pistonRings: pistons.rings,
    rod: rodGeometry(l, lod),
    glow: mergeM([glow]),
    valve: valve.valve,
    valveRefMm: valve.ref,
    spring: lod === 'high' ? spring.spring : null,
    springRefMm: spring.ref,
    pushrod: pushrod.pushrod,
    pushrodRefMm: pushrod.ref,
  };
}

export function disposeEngineGeometry(g: EngineGeometry) {
  const all: (BufferGeometry | null)[] = [
    g.block,
    g.liners,
    g.sump,
    g.crankSteel,
    g.crankWebs,
    g.flywheel,
    g.timingCover,
    g.chainLink,
    g.turboWheel,
    g.piston,
    g.pistonRings,
    g.rod,
    g.glow,
    g.valve,
    g.spring,
    g.pushrod,
    ...g.heads.flatMap((h) => [h.casting, h.cover, h.coils]),
    ...g.cams.map((c) => c.geometry),
    ...g.rockers,
    ...g.intake,
    ...g.exhaust,
    ...g.turbos.flatMap((t) => [t.hot, t.cold]),
  ];
  for (const x of all) x?.dispose();
}

/**
 * Bounds (mm) of the bare engine envelope() describes: block, heads, crankcase/sump, timing
 * cover, crank and flywheel — not the intake, exhaust or turbos.
 */
export function coreBoundsMm(g: EngineGeometry): Box3 {
  const box = new Box3();
  const add = (geo: BufferGeometry | null) => {
    if (!geo) return;
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
  };
  [
    g.block,
    g.sump,
    g.timingCover,
    g.flywheel,
    ...g.heads.flatMap((h) => [h.casting, h.cover]),
  ].forEach(add);
  // the crank turns: use its swept radius rather than its rest pose
  const c = g.layout.crank;
  const R =
    Math.max(c.counterweightRadiusMm, c.throwMm + c.pinRadiusMm + 6, g.layout.pulley.radiusMm) * MM;
  box.union(new Box3(new Vector3(c.rearMm * MM, -R, -R), new Vector3(c.frontMm * MM, R, R)));
  return new Box3(box.min.multiplyScalar(1 / MM), box.max.multiplyScalar(1 / MM));
}

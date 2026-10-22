/**
 * Wankel rotary kinematics and geometry, shared by envelope(), balance(), the 3D model and the
 * panels so the picture, the numbers and the sound agree.
 *
 * Frame: the engine YZ plane, angles from +Y toward +Z (the crank convention in types.ts). The
 * housing's long axis is Y, its waists are ±Z; the spark plugs sit at the waist on the bank's
 * tilt side (-Z), the ports at the other. With e-shaft angle measured like a crank pin,
 * lobe = throwDeg − crankDeg, the rotor centre sits at e·(cos lobe, sin lobe) — it orbits at
 * shaft speed — and the rotor itself turns at a third of it: apex k is at angle lobe/3 + 120k
 * from the rotor centre, which puts every apex exactly on the housing epitrochoid
 *   H(α) = e·(cos 3α, sin 3α) + R·(cos α, sin α).
 * (The 3:2 phasing gears, internal on the rotor and fixed on the side housing, enforce the 1/3.)
 *
 * A face's cycle runs 1080° of shaft: 0 combustion TDC (face centred on the plug-side waist),
 * 270 BDC, 540 TDC at the port-side waist, 810 BDC. Its volume is exactly sinusoidal:
 *   V(ζ) = V_min + ½·V_disp·(1 − cos(2ζ/3)),  V_disp = 3√3·R·e·B.
 */
import type { EngineSpec, RotaryDef, Vec3 } from '../types';
import { DEG, mod } from '../units';
import type { StrokeName } from './kinematics';

export type YZ = [number, number];

/** E-shaft degrees in one face's four-phase cycle. */
export const ROTARY_CYCLE_DEG = 1080;

export function rotaryDef(spec: EngineSpec): RotaryDef {
  if (!spec.rotary) throw new Error(`${spec.id} is not a rotary`);
  return spec.rotary;
}

/** Epitrochoid point at housing parameter α (rad): the path every apex follows. */
export function trochoid(r: RotaryDef, alpha: number, out: YZ = [0, 0]): YZ {
  const R = r.generatingRadiusMm;
  const e = r.eccentricityMm;
  out[0] = e * Math.cos(3 * alpha) + R * Math.cos(alpha);
  out[1] = e * Math.sin(3 * alpha) + R * Math.sin(alpha);
  return out;
}

/** Eccentric-lobe angle of rotor i (deg, unwrapped so lobe/3 stays continuous over 0..720). */
export const lobeDeg = (spec: EngineSpec, i: number, crankDeg: number) =>
  spec.cylinders[i].throwDeg - crankDeg;

export interface RotorPose {
  /** rotor centre (mm, engine YZ) */
  centre: YZ;
  /** rotor rotation (deg): apex 0 points this way from the centre */
  angleDeg: number;
}

export function rotorPose(spec: EngineSpec, i: number, crankDeg: number): RotorPose {
  const e = rotaryDef(spec).eccentricityMm;
  const lobe = lobeDeg(spec, i, crankDeg);
  return {
    centre: [e * Math.cos(lobe * DEG), e * Math.sin(lobe * DEG)],
    angleDeg: lobe / 3,
  };
}

/** Where face k of rotor i is in its 1080° cycle (0 = combustion TDC). Face k spans apex k → k+1. */
export function faceCycleDeg(spec: EngineSpec, i: number, face: number, crankDeg: number): number {
  const mid = lobeDeg(spec, i, crankDeg) / 3 + 120 * face + 60;
  const plugs = spec.banks[spec.cylinders[i].bank].tiltDeg;
  return 3 * mod(plugs - mid, 360);
}

export const displacementPerFaceCc = (r: RotaryDef) =>
  (3 * Math.sqrt(3) * r.generatingRadiusMm * r.eccentricityMm * r.rotorWidthMm) / 1000;

/** Chamber volume (cc) at a point of the face cycle. */
export function chamberVolumeCc(r: RotaryDef, cycleDeg: number): number {
  const disp = displacementPerFaceCc(r);
  const vMin = disp / (r.compressionRatio - 1);
  return vMin + 0.5 * disp * (1 - Math.cos(((2 * cycleDeg) / 3) * DEG));
}

export interface PortWindows {
  /** union of all exhaust ports: [open, close] in the face cycle */
  exhaust: [number, number];
  intake: [number, number];
  /** exhaust and intake open together (peripheral exhaust); 0 for side exhaust ports */
  overlapDeg: number;
}

export function portWindows(r: RotaryDef): PortWindows {
  const span = (kind: 'intake' | 'exhaust'): [number, number] => {
    const ps = r.ports.filter((p) => p.kind === kind);
    if (ps.length === 0) throw new Error(`rotary without ${kind} ports`);
    return [Math.min(...ps.map((p) => p.openDeg)), Math.max(...ps.map((p) => p.closeDeg))];
  };
  const exhaust = span('exhaust');
  const intake = span('intake');
  return { exhaust, intake, overlapDeg: Math.max(0, exhaust[1] - intake[0]) };
}

/**
 * The phase a face is in, from the port timing (what a student sees the ports do): combustion
 * and expansion from TDC until the exhaust opens, exhaust until the intake opens, intake until
 * the last intake port closes, then compression. `t` is progress 0..1 through the phase.
 */
export function rotaryPhase(r: RotaryDef, cycleDeg: number): { stroke: StrokeName; t: number } {
  const w = portWindows(r);
  const c = mod(cycleDeg, ROTARY_CYCLE_DEG);
  const bounds: [StrokeName, number, number][] = [
    ['power', 0, w.exhaust[0]],
    ['exhaust', w.exhaust[0], w.intake[0]],
    ['intake', w.intake[0], w.intake[1]],
    ['compression', w.intake[1], ROTARY_CYCLE_DEG],
  ];
  for (const [stroke, a, b] of bounds) if (c < b) return { stroke, t: (c - a) / (b - a) };
  return { stroke: 'compression', t: 1 };
}

/** Exterior of the housings around the e-shaft: rotor housing and side plates share it. */
export interface RotaryDims {
  R: number;
  e: number;
  /** rotor width = rotor-housing width (mm) */
  width: number;
  side: number;
  /** casting around the trochoid (water jacket, bolts): sets the core height 2(R+e+wall) */
  wallMm: number;
  /** half-extent of the housing exterior (mm) */
  halfHeightMm: number;
  halfWidthMm: number;
  /** axial span of the housing stack, rear face to front face (mm, engine X) */
  stackMinMm: number;
  stackMaxMm: number;
  /** front cover (oil pump and drive) and rear counterweight boss beyond the stack (mm) */
  frontMm: number;
  rearMm: number;
  sumpDepthMm: number;
  /** e-shaft main journal and eccentric lobe radii (mm) */
  journalMm: number;
  lobeMm: number;
}

export function rotaryDims(spec: EngineSpec): RotaryDims {
  const r = rotaryDef(spec);
  const R = r.generatingRadiusMm;
  const e = r.eccentricityMm;
  // ~0.47 R reproduces the RENESIS's quoted 338 mm core height (R 105, e 15)
  const wallMm = 0.47 * R;
  let maxZ = 0;
  const p: YZ = [0, 0];
  for (let k = 0; k <= 90; k++) maxZ = Math.max(maxZ, trochoid(r, k * DEG, p)[1]);
  const axials = spec.cylinders.map((c) => c.axialMm);
  const half = r.rotorWidthMm / 2 + r.sideHousingMm;
  return {
    R,
    e,
    width: r.rotorWidthMm,
    side: r.sideHousingMm,
    wallMm,
    halfHeightMm: R + e + wallMm,
    halfWidthMm: maxZ + wallMm,
    stackMinMm: Math.min(...axials) - half,
    stackMaxMm: Math.max(...axials) + half,
    frontMm: 45,
    rearMm: 25,
    sumpDepthMm: spec.geometry.sumpDepthMm ?? (spec.geometry.drySump ? 30 : 60),
    journalMm: 0.2 * R,
    lobeMm: e + 0.21 * R,
  };
}

/** Bounding box of the bare engine (housings, front cover, oil pan) in the engine frame (mm). */
export function rotaryBounds(spec: EngineSpec): { min: Vec3; max: Vec3 } {
  const d = rotaryDims(spec);
  return {
    min: [d.stackMinMm - d.rearMm, -d.halfHeightMm - d.sumpDepthMm, -d.halfWidthMm],
    max: [d.stackMaxMm + d.frontMm, d.halfHeightMm, d.halfWidthMm],
  };
}

/**
 * The housing exterior outline (YZ, counter-clockwise): a squarish superellipse through the
 * half-extents (trochoid + wall), so the casting fills in across the waists as real ones do.
 */
export function housingOutline(spec: EngineSpec, n = 72): YZ[] {
  const d = rotaryDims(spec);
  const pts: YZ[] = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    // superellipse through the half-extents: flat flanks, rounded ends
    const c = Math.cos(a);
    const s = Math.sin(a);
    const q = 3.2;
    pts.push([
      d.halfHeightMm * Math.sign(c) * Math.abs(c) ** (2 / q),
      d.halfWidthMm * Math.sign(s) * Math.abs(s) ** (2 / q),
    ]);
  }
  return pts;
}

/**
 * One rotor flank in the rotor's own frame, apex 0 (angle 0) to apex 1 (angle 120°): the inner
 * envelope of the housing as seen from the rotor (the largest rotor that can turn), then a
 * combustion recess pressed into its middle, sized so the chamber's volume at TDC gives the
 * compression ratio. `n + 1` points.
 */
export function rotorFlank(r: RotaryDef, n = 48): YZ[] {
  const R = r.generatingRadiusMm;
  const e = r.eccentricityMm;
  const env: YZ[] = [];
  for (let k = 0; k <= n; k++) {
    // envelope condition cos(2t + β/2) = −(3e/R)·cos(3β/2); the + root is the inner envelope
    const b = ((120 * k) / n) * DEG;
    const t = (Math.acos(-((3 * e) / R) * Math.cos(1.5 * b)) - b / 2) / 2;
    env.push([
      e * Math.cos(3 * b + 2 * t) + R * Math.cos(b) - e * Math.cos(2 * t),
      e * Math.sin(3 * b + 2 * t) + R * Math.sin(b) - e * Math.sin(2 * t),
    ]);
  }
  // recess profile along the flank: a flat-bottomed tub, nothing at the apexes
  const smoothstep = (a: number, b: number, x: number) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const tub = env.map((_, k) => {
    const s = k / n;
    return smoothstep(0.1, 0.32, s) * smoothstep(0.1, 0.32, 1 - s);
  });
  // a hair of running clearance everywhere but the apex tips
  const clear = env.map((_, k) => 0.8 * Math.sin((Math.PI * k) / n));
  const pressed = (depth: number): YZ[] =>
    env.map(([y, z], k) => {
      const rr = Math.hypot(y, z);
      const k2 = (rr - clear[k] - depth * tub[k]) / rr;
      return [y * k2, z * k2];
    });
  const target = (displacementPerFaceCc(r) * 1000) / (r.compressionRatio - 1) / r.rotorWidthMm;
  let lo = 0;
  let hi = 0.4 * R;
  if (chamberAreaMm2(r, pressed(0), 0) >= target) return pressed(0);
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (chamberAreaMm2(r, pressed(mid), 0) < target) lo = mid;
    else hi = mid;
  }
  return pressed((lo + hi) / 2);
}

/**
 * Cross-section area (mm²) of one chamber at a point of its cycle, for a given flank (apex 0 →
 * apex 1, rotor frame): housing arc between the face's apexes, back along the flank. Measured
 * in a frame where TDC sits at the +Z waist; the shape is the same at either waist.
 */
export function chamberAreaMm2(r: RotaryDef, flank: YZ[], cycleDeg: number, n = 96): number {
  // face 0's mid at +90° at TDC (lobe 90°), moving backward as the cycle advances
  const lobe = 90 - cycleDeg;
  const rot = (lobe / 3) * DEG;
  const e = r.eccentricityMm;
  const cy = e * Math.cos(lobe * DEG);
  const cz = e * Math.sin(lobe * DEG);
  const loop: YZ[] = [];
  for (let k = 0; k <= n; k++) loop.push(trochoid(r, rot + ((120 * k) / n) * DEG));
  for (let k = flank.length - 1; k >= 0; k--) {
    const [y, z] = flank[k];
    loop.push([
      cy + y * Math.cos(rot) - z * Math.sin(rot),
      cz + y * Math.sin(rot) + z * Math.cos(rot),
    ]);
  }
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const [y0, z0] = loop[i];
    const [y1, z1] = loop[(i + 1) % loop.length];
    a += y0 * z1 - y1 * z0;
  }
  return Math.abs(a / 2);
}

/** Rotor outline (three flanks, rotor frame), closed loop without the repeated apexes. */
export function rotorOutline(r: RotaryDef, n = 48): YZ[] {
  const flank = rotorFlank(r, n).slice(0, n);
  const pts: YZ[] = [];
  for (let f = 0; f < 3; f++) {
    const c = Math.cos(f * 120 * DEG);
    const s = Math.sin(f * 120 * DEG);
    for (const [y, z] of flank) pts.push([y * c - z * s, y * s + z * c]);
  }
  return pts;
}

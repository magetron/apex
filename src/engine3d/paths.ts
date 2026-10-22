/**
 * Pipe and chain routing (millimetres, engine frame): exhaust primaries routed to their spec
 * lengths (equal vs unequal headers you can see), intake runners into the plenum, and the
 * timing-chain loop around its sprockets.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import type { EngineLayout, TimingLoop } from './layout';
import { circle, hull, signedArea, v3norm, type V3, type YZ } from './prims';

export interface PipeRoute {
  cyl: number;
  curve: CatmullRomCurve3;
  lengthMm: number;
  /** what the spec asked for (exhaust) */
  targetMm: number;
}

/**
 * A pipe leaving `from` along `dir` (YZ) and ending at `to`, bulged sideways just enough that
 * its length matches targetMm (when the direct route is shorter than that).
 */
export function lengthMatchedCurve(
  from: V3,
  dir: YZ,
  to: V3,
  targetMm: number,
  bulge: V3,
  /** never bulge downward (pipes under a flat engine would reach the road) */
  noDown = false,
): PipeRoute {
  const p0 = new Vector3(...from);
  const p1 = new Vector3(from[0], from[1] + dir[0] * 35, from[2] + dir[1] * 35);
  const c = new Vector3(...to);
  const t = c.clone().sub(p1).normalize();
  const b = new Vector3(...bulge);
  b.addScaledVector(t, -b.dot(t));
  if (noDown && b.y < 0) b.y = 0;
  if (b.lengthSq() < 1e-6) b.set(1, 0, 0).addScaledVector(t, -t.x);
  b.normalize();
  const make = (w: number) => {
    const m1 = p1
      .clone()
      .lerp(c, 0.33)
      .addScaledVector(b, w * 0.85);
    const m2 = p1
      .clone()
      .lerp(c, 0.66)
      .addScaledVector(b, w * 0.85);
    return new CatmullRomCurve3([p0, p1, m1, m2, c], false, 'centripetal');
  };
  let curve = make(0);
  let len = curve.getLength();
  if (len < targetMm - 1) {
    let lo = 0;
    let hi = targetMm;
    for (let k = 0; k < 28; k++) {
      const w = (lo + hi) / 2;
      const l = make(w).getLength();
      if (l < targetMm) lo = w;
      else hi = w;
    }
    curve = make((lo + hi) / 2);
    len = curve.getLength();
  }
  return { cyl: -1, curve, lengthMm: len, targetMm };
}

/** Every exhaust primary, from its port to its group's collector, at the spec header length. */
export function exhaustRoutes(l: EngineLayout): PipeRoute[] {
  const out: PipeRoute[] = [];
  for (const g of l.exhaust) {
    for (const i of g.cylinders) {
      const p = l.exhaustPorts[i];
      const x = l.cylinders[i].axialMm - g.collector[0];
      // fan the loops fore/aft so a bundle of equal-length pipes reads as separate tubes
      const fan = Math.max(-1, Math.min(1, x / (2 * l.spec.borePitchMm)));
      // Ports facing down (flat engines): spend the length looping fore/aft, as real flat-engine
      // headers do, never further down, where it would hang below the car.
      const down = p.dir[0] < -0.6;
      const bulge: V3 = down ? [fan < 0 ? -1 : 1, 0, 0] : v3norm([fan * 0.8, p.dir[0], p.dir[1]]);
      const route = lengthMatchedCurve(
        p.at,
        p.dir,
        g.collector,
        l.cylinders[i].headerMm,
        bulge,
        down,
      );
      route.cyl = i;
      out.push(route);
    }
  }
  return out;
}

/** Intake runners: from each intake port, curving into the side of its plenum. */
export function runnerRoutes(l: EngineLayout): PipeRoute[] {
  return l.runners.map(({ cyl, plenum }) => {
    const p = l.intakePorts[cyl];
    const pl = l.plenums[plenum];
    const dy = p.at[1] - pl.at[0];
    const dz = p.at[2] - pl.at[1];
    const n = Math.hypot(dy, dz) || 1;
    const qn: YZ = [dy / n, dz / n];
    const q = new Vector3(
      p.at[0],
      pl.at[0] + qn[0] * pl.radiusMm * 0.85,
      pl.at[1] + qn[1] * pl.radiusMm * 0.85,
    );
    const curve = new CatmullRomCurve3(
      [
        new Vector3(...p.at),
        new Vector3(p.at[0], p.at[1] + p.dir[0] * 35, p.at[2] + p.dir[1] * 35),
        new Vector3(q.x, q.y + qn[0] * 32, q.z + qn[1] * 32),
        q,
      ],
      false,
      'centripetal',
    );
    return { cyl, curve, lengthMm: curve.getLength(), targetMm: 0 };
  });
}

/** A closed loop resampled at even arc length: M × (y, z, tangentY, tangentZ). */
export interface LoopPath {
  x: number;
  samples: number;
  lengthMm: number;
  /** +1 when the path runs in the crank's +angle sense (from +Y toward +Z) */
  orient: 1 | -1;
  pts: Float32Array;
}

/** The chain's pitch line: the convex hull around its sprockets. */
export function chainLoop(loop: TimingLoop, samples = 256): LoopPath {
  const raw: YZ[] = [];
  for (const s of loop.sprockets) raw.push(...circle(s.at[0], s.at[1], s.r + 2, 64));
  const h = hull(raw);
  const cum = [0];
  for (let i = 1; i <= h.length; i++) {
    const a = h[i - 1];
    const b = h[i % h.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[h.length];
  const pts = new Float32Array(samples * 4);
  let seg = 0;
  for (let k = 0; k < samples; k++) {
    const s = (total * k) / samples;
    while (seg < h.length - 1 && cum[seg + 1] < s) seg++;
    const a = h[seg];
    const b = h[(seg + 1) % h.length];
    const segLen = cum[seg + 1] - cum[seg] || 1;
    const w = (s - cum[seg]) / segLen;
    const ty = (b[0] - a[0]) / segLen;
    const tz = (b[1] - a[1]) / segLen;
    pts[k * 4] = a[0] + (b[0] - a[0]) * w;
    pts[k * 4 + 1] = a[1] + (b[1] - a[1]) * w;
    pts[k * 4 + 2] = ty;
    pts[k * 4 + 3] = tz;
  }
  return { x: loop.x, samples, lengthMm: total, orient: signedArea(h) >= 0 ? 1 : -1, pts };
}

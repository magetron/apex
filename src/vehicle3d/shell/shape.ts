/**
 * Evaluates a BodyParams set into a closed lofted surface: a cross-section at every x, built
 * from a fixed template so stations can be stitched into a grid. Right half only; the mesh
 * mirrors it. Template, bottom centre → top centre:
 *
 *   A  floor            (bottom, 0) → (bottom, zA)
 *   W1 wheel-well wall  (bottom, zA) → (archY, zA)          ┐ degenerate away from the wheels
 *   W2 wheel-well roof  (archY, zA) → (archY, side(archY))  ┘
 *   S  flank            lower corner, shoulder, tuck up to the belt
 *   D  greenhouse side  belt → roof edge (zero height off the cabin)
 *   E  top              roof edge → centre: roof crown, bonnet, deck (with optional wing humps)
 */
import { clamp, endRound, lerp, monotone, smoothstep, tabulate } from './curves';
import type { BodyContext, BodyParams, BodyShapeApi } from './types';

export const SEG = { A: 4, W1: 3, W2: 3, S: 14, D: 5, E: 10 } as const;
/** start index of each segment in the right-half point array; segments share end points */
export const OFF = {
  A: 0,
  W1: SEG.A,
  W2: SEG.A + SEG.W1,
  S: SEG.A + SEG.W1 + SEG.W2,
  D: SEG.A + SEG.W1 + SEG.W2 + SEG.S,
  E: SEG.A + SEG.W1 + SEG.W2 + SEG.S + SEG.D,
} as const;
export const HALF_N = OFF.E + SEG.E;

export interface Section {
  y: Float64Array;
  z: Float64Array;
}

export const newSection = (): Section => ({
  y: new Float64Array(HALF_N),
  z: new Float64Array(HALF_N),
});

export interface BodyShape extends BodyShapeApi {
  section(x: number, out?: Section): Section;
  /** wheel-well cut height at x (= bottom away from the wheels) */
  archY(x: number): number;
  /** fender flare at x (mm) */
  flare(x: number): number;
  /** x of the A-pillar base (where the greenhouse starts rising) */
  aPillarX: number;
}

// dense flank sampling: corner by angle, then by height
const CORNER_N = 8;
const UPPER_N = 16;
const DENSE_N = CORNER_N + UPPER_N;
/** which dense flank samples become the SEG.S mesh rows */
const S_ROWS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 19, 20, 22, 23];

export function makeShape(c: BodyContext, p: BodyParams): BodyShape {
  const { xF, xR, W } = c;
  const x0 = xR - 1;
  const x1 = xF + 1;
  const tab = (f: (x: number) => number) => tabulate(f, x0, x1, 2);

  const topRaw = monotone(p.top);
  const belt = tab(monotone(p.belt));
  const bottom = tab(monotone(p.bottom));
  const plan = monotone(p.plan);
  const wing = tab(monotone(p.wing.length ? p.wing : [[0, 0]]));

  // flares: smooth bumps centred on each axle, a little longer than the arch
  const flareRaw = (x: number) => {
    let f = 0;
    for (const w of c.wheels) {
      const amt = w.axle === 'front' ? p.flare[0] : p.flare[1];
      const u = (x - w.x) / (w.archR * 1.45);
      if (Math.abs(u) < 1) f += amt * Math.cos((u * Math.PI) / 2) ** 2;
    }
    return f;
  };
  const flare = tab(flareRaw);

  // the roof peak must be exactly the spec height: nudge only what is above the belt
  let peak = -Infinity;
  let peakBelt = 0;
  for (let x = xR; x <= xF; x += 5) {
    const t = topRaw(x);
    if (t > peak) {
      peak = t;
      peakBelt = belt(x);
    }
  }
  const dH = c.H - peak;
  const top = tab((x) => {
    const t = topRaw(x);
    const w = clamp((t - peakBelt) / Math.max(1, peak - peakBelt), 0, 1);
    return t + dH * w;
  });

  // plan view with end rounding, scaled so the widest point (incl. flares) is exactly W/2
  const hwRaw = (x: number) =>
    (W / 2) *
    plan(x) *
    endRound(xF - x, p.nose.len, p.nose.p) *
    endRound(x - xR, p.tail.len, p.tail.p);
  let kLo = 0.5;
  let kHi = 1.5;
  for (let it = 0; it < 40; it++) {
    const k = (kLo + kHi) / 2;
    let m = 0;
    for (let x = xR; x <= xF; x += 5) m = Math.max(m, k * hwRaw(x) + flareRaw(x));
    if (m > W / 2) kHi = k;
    else kLo = k;
  }
  let kW = (kLo + kHi) / 2;
  let halfW = tab((x) => kW * hwRaw(x));

  const cabinMask = (x: number) =>
    smoothstep(p.cabin[0] - 40, p.cabin[0] + 40, x) *
    (1 - smoothstep(p.cabin[1] - 40, p.cabin[1] + 40, x));
  const roofEdgeRaw = (x: number) =>
    belt(x) + cabinMask(x) * Math.max(0, top(x) - p.crown - belt(x));
  const roofEdge = tab(roofEdgeRaw);
  let ghFull = 1;
  for (let x = xR; x <= xF; x += 5) ghFull = Math.max(ghFull, roofEdge(x) - belt(x));

  const archYRaw = (x: number) => {
    let y = -Infinity;
    for (const w of c.wheels) {
      const dx = x - w.x;
      if (Math.abs(dx) < w.archR) y = Math.max(y, w.y + Math.sqrt(w.archR * w.archR - dx * dx));
    }
    return y;
  };
  const zInnerAt = (x: number) => {
    let best = c.wheels[0];
    for (const w of c.wheels) if (Math.abs(x - w.x) < Math.abs(x - best.x)) best = w;
    return best.zInner;
  };

  const shoulderY = (x: number) => lerp(bottom(x), belt(x), p.shoulder);
  const archTop = Math.max(...c.wheels.map((w) => w.y + w.archR));

  // ── flank curve at a station ──
  const dy = new Float64Array(DENSE_N);
  const dz = new Float64Array(DENSE_N);
  const flank = (x: number) => {
    const b = bottom(x);
    const bl = Math.max(belt(x), b + 80);
    const sh = clamp(shoulderY(x), b + 20, bl - 10);
    const hw = halfW(x);
    const fl = flare(x);
    const rC = Math.max(1, Math.min(p.cornerR, (sh - b) * 0.9, hw * 0.45));
    // flares stay full up to the arch lip, then fade toward the belt
    const f0 = Math.min(bl - 30, Math.max(sh, archTop - 60));
    const fy = (y: number) => 1 - smoothstep(f0, bl, y) * (1 - p.flareTop);
    let k = 0;
    const tu = Math.min(p.tuckUnder, hw * 0.2);
    for (let i = 0; i < CORNER_N; i++) {
      const th = (i / CORNER_N) * (Math.PI / 2);
      const y = b + rC * (1 - Math.cos(th));
      dy[k] = y;
      dz[k] = hw - tu - rC + rC * Math.sin(th) + fl * fy(y);
      k++;
    }
    const lowSpan = Math.max(1, sh - (b + rC));
    for (let i = 0; i < UPPER_N; i++) {
      const y = lerp(b + rC, bl, i / (UPPER_N - 1));
      const t = y <= sh ? 0 : (y - sh) / (bl - sh);
      const u = y >= sh ? 0 : (sh - y) / lowSpan;
      dy[k] = y;
      dz[k] = hw - p.tuck * t * t - tu * u * u + fl * fy(y);
      k++;
    }
    return { b, bl, hw, rC };
  };
  /** flank z at height y (on the dense curve) */
  const flankZ = (y: number) => {
    if (y <= dy[0]) return dz[0];
    for (let i = 1; i < DENSE_N; i++) {
      if (y <= dy[i]) {
        const t = (y - dy[i - 1]) / (dy[i] - dy[i - 1] || 1);
        return lerp(dz[i - 1], dz[i], t);
      }
    }
    return dz[DENSE_N - 1];
  };

  const scratch = newSection();

  function section(x: number, out: Section = newSection()): Section {
    const { y: Y, z: Z } = out;
    const { b, bl, hw, rC } = flank(x);

    // wheel well: cut up to the arch, never through the belt
    let yW = archYRaw(x);
    yW = Number.isFinite(yW) ? clamp(yW, b, bl - 25) : b;
    const zSideAtW = flankZ(yW);
    const zA = Math.max(0, Math.min(zInnerAt(x), hw - rC, zSideAtW - 4));

    let i: number = OFF.A;
    for (let k = 0; k < SEG.A; k++, i++) {
      Y[i] = b;
      Z[i] = (zA * k) / (SEG.A - 1);
    }
    i = OFF.W1;
    for (let k = 0; k < SEG.W1; k++, i++) {
      Y[i] = lerp(b, yW, k / (SEG.W1 - 1));
      Z[i] = zA;
    }
    // W2: across the well roof to where the flank starts. Away from the wheels this is the
    // flat floor out to the lower corner.
    const zS0 = yW > b + 0.5 ? zSideAtW : dz[0];
    i = OFF.W2;
    for (let k = 0; k < SEG.W2; k++, i++) {
      Y[i] = yW;
      Z[i] = lerp(zA, zS0, k / (SEG.W2 - 1));
    }

    // S: the flank at fixed rows (corner by angle, then by height) so rows line up from station
    // to station; inside a wheel arch, rows below the cut collapse onto the arch edge.
    i = OFF.S;
    for (let n = 0; n < SEG.S; n++, i++) {
      const k = S_ROWS[n];
      if (dy[k] < yW) {
        Y[i] = yW;
        Z[i] = zSideAtW;
      } else {
        Y[i] = dy[k];
        Z[i] = dz[k];
      }
    }
    const zBelt = Z[OFF.S + SEG.S - 1];
    const yBelt = Y[OFF.S + SEG.S - 1];

    // D: greenhouse side
    const re = Math.max(roofEdge(x), yBelt);
    const f = clamp((re - yBelt) / ghFull, 0, 1);
    const gw = lerp(zBelt, p.roofHalf * hw, Math.pow(f, 0.6));
    i = OFF.D;
    for (let n = 0; n < SEG.D; n++, i++) {
      const t = n / (SEG.D - 1);
      Y[i] = lerp(yBelt, re, t);
      Z[i] = lerp(zBelt, gw, t);
    }

    // E: top surface, edge → centre
    const tc = top(x);
    const wg = wing(x);
    const wAt = clamp(p.wingAt, 0.05, 0.95);
    const wExp = Math.log(0.5) / Math.log(wAt);
    i = OFF.E;
    for (let n = 0; n < SEG.E; n++, i++) {
      const s = Math.cos((Math.PI / 2) * (n / (SEG.E - 1)));
      const sw = Math.pow(s, wExp);
      const bump = wg * (4 * sw * (1 - sw)) ** 2;
      Y[i] = tc + (re - tc) * Math.pow(s, p.topExp) + bump;
      Z[i] = s * gw;
    }
    Z[OFF.E + SEG.E - 1] = 0;
    return out;
  }

  function outerZ(x: number, y: number): number {
    const { y: Y, z: Z } = section(x, scratch);
    let best = -1;
    for (let i = 0; i < HALF_N - 1; i++) {
      const ya = Y[i];
      const yb = Y[i + 1];
      if ((y - ya) * (y - yb) > 0) continue;
      const dyab = yb - ya;
      const z =
        Math.abs(dyab) < 1e-9 ? Math.max(Z[i], Z[i + 1]) : lerp(Z[i], Z[i + 1], (y - ya) / dyab);
      if (z > best) best = z;
    }
    return best;
  }

  function topY(x: number, z: number): number {
    const az = Math.abs(z);
    const { y: Y, z: Z } = section(x, scratch);
    let best = -Infinity;
    for (let i = 0; i < HALF_N - 1; i++) {
      const za = Z[i];
      const zb = Z[i + 1];
      if ((az - za) * (az - zb) > 0) continue;
      const dzab = zb - za;
      const y =
        Math.abs(dzab) < 1e-9 ? Math.max(Y[i], Y[i + 1]) : lerp(Y[i], Y[i + 1], (az - za) / dzab);
      if (y > best) best = y;
    }
    return best;
  }

  function endX(y: number, z: number, end: 'front' | 'rear', hint?: number | null): number | null {
    const az = Math.abs(z);
    const step = 6;
    const inward = end === 'front' ? -1 : 1;
    const inside = (x: number) => x >= xR && x <= xF && outerZ(x, y) >= az;
    let out: number;
    let hit: number | null = null;
    if (hint != null && hint > xR && hint < xF) {
      // start near the neighbour's answer and walk to a bracket
      if (inside(hint)) {
        hit = hint;
        out = hint - inward * step;
        while (inside(out)) {
          hit = out;
          out -= inward * step;
        }
      } else {
        out = hint;
        for (let k = 1; k < 900; k++) {
          const x = hint + inward * k * step;
          if (x < xR || x > xF) break;
          if (inside(x)) {
            hit = x;
            break;
          }
          out = x;
        }
      }
    } else {
      out = end === 'front' ? xF : xR;
      for (let k = 1; k < 900; k++) {
        const x = out + inward * step;
        if (x < xR || x > xF) break;
        if (inside(x)) {
          hit = x;
          break;
        }
        out = x;
      }
    }
    if (hit === null) return null;
    let a = out;
    let bb = hit;
    for (let it = 0; it < 16; it++) {
      const m = (a + bb) / 2;
      if (inside(m)) bb = m;
      else a = m;
    }
    return bb;
  }

  // The flank is cut by the wheel wells and tucked at the belt, so the true widest point can
  // differ from the plan estimate: correct the plan scale against the real sections.
  for (let it = 0; it < 4; it++) {
    let maxZ = 0;
    for (let x = xR; x <= xF; x += 12) {
      const sec = section(x, scratch);
      for (let i = 0; i < HALF_N; i++) maxZ = Math.max(maxZ, sec.z[i]);
    }
    for (const w of c.wheels) {
      for (let dx = -w.archR - 40; dx <= w.archR + 40; dx += 4) {
        const sec = section(w.x + dx, scratch);
        for (let i = 0; i < HALF_N; i++) maxZ = Math.max(maxZ, sec.z[i]);
      }
    }
    if (Math.abs(maxZ - W / 2) < 0.3) break;
    const k = kW * (W / 2 / maxZ);
    kW = k;
    halfW = tab((x) => k * hwRaw(x));
  }

  // A-pillar base: first x behind the cowl where the greenhouse lifts off the belt
  let aPillarX = p.cabin[1];
  for (let x = p.cabin[1] + 60; x > p.cabin[0]; x -= 4) {
    if (roofEdge(x) - belt(x) > 8) {
      aPillarX = x;
      break;
    }
  }

  const ghHalfW = (x: number) => {
    const s = section(x, scratch);
    return s.z[OFF.E];
  };

  return {
    c,
    p,
    top,
    belt,
    bottom,
    roofEdge: (x: number) => Math.max(roofEdge(x), belt(x)),
    halfW,
    ghHalfW,
    flare,
    archY: (x: number) => {
      const y = archYRaw(x);
      return Number.isFinite(y) ? y : bottom(x);
    },
    section,
    outerZ,
    topY,
    endX,
    aPillarX,
  };
}

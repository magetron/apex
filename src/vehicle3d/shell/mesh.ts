/**
 * Turns an evaluated BodyShape into three.js geometry (metres): the lofted shell, its x-ray
 * feature lines, conformal decals (glass, lamps, grilles) and wheel-arch lips.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeos as mergeGeometries } from './merge';
import { clamp, lerp } from './curves';
import { HALF_N, newSection, OFF, SEG, type BodyShape, type Section } from './shape';
import type { Decal, DecalMat } from './types';

const M = 0.001;

// ───────────────────────────── stations ─────────────────────────────

/** Stations along X: evenly spaced in "shape change", plus exact ones around each wheel arch. */
export function stations(s: BodyShape, n = 110): number[] {
  const { xF, xR } = s.c;
  const step = 3;
  const xs: number[] = [];
  const cum: number[] = [];
  let acc = 0;
  let prev: number[] | null = null;
  for (let x = xR; x <= xF + 1e-6; x += step) {
    const cur = [s.top(x), s.belt(x), s.bottom(x), 1.6 * s.halfW(x), s.roofEdge(x)];
    if (prev) {
      let d2 = step * step;
      for (let k = 0; k < cur.length; k++) d2 += (cur[k] - prev[k]) ** 2;
      acc += Math.sqrt(d2);
    }
    xs.push(x);
    cum.push(acc);
    prev = cur;
  }
  const picked: number[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const want = (acc * i) / n;
    while (j < cum.length - 1 && cum[j + 1] < want) j++;
    const t = cum[j + 1] > cum[j] ? clamp((want - cum[j]) / (cum[j + 1] - cum[j]), 0, 1) : 0;
    picked.push(lerp(xs[j], xs[Math.min(j + 1, xs.length - 1)], t));
  }
  const arch: number[] = [];
  for (const w of s.c.wheels) {
    const K = 18;
    for (let k = 1; k < K; k++) arch.push(w.x + w.archR * Math.cos((k * Math.PI) / K));
    for (const sgn of [-1, 1]) {
      arch.push(w.x + sgn * (w.archR + 0.5), w.x + sgn * (w.archR - 0.5));
    }
  }
  const all = picked.filter((x) => arch.every((a) => Math.abs(a - x) > 14)).concat(arch);
  all.push(xR, xF);
  const out = all.filter((x) => x >= xR - 1e-6 && x <= xF + 1e-6).sort((a, b) => a - b);
  return out.filter((x, i) => i === 0 || x - out[i - 1] > 0.2);
}

// ───────────────────────────── shell ─────────────────────────────

type RingRef = [side: 1 | -1, index: number];

const range = (side: 1 | -1, a: number, b: number): RingRef[] => {
  const out: RingRef[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push([side, i]);
  else for (let i = a; i >= b; i--) out.push([side, i]);
  return out;
};

/** The full ring split into smoothing strips (hard edges between strips); `well` strips are
 *  the wheel-well liners (drawn dark). */
function strips(crease: boolean): { refs: RingRef[]; well: boolean }[] {
  const aEnd = OFF.A + SEG.A - 1;
  const floor = [...range(-1, aEnd, OFF.A + 1), ...range(1, OFF.A, aEnd)];
  const w1R = range(1, OFF.W1, OFF.W1 + SEG.W1 - 1);
  const w2R = range(1, OFF.W2, OFF.W2 + SEG.W2 - 1);
  const sR = range(1, OFF.S, OFF.S + SEG.S - 1);
  const dR = range(1, OFF.D, OFF.D + SEG.D - 1);
  const eR = range(1, OFF.E + 1, OFF.E + SEG.E - 1);
  const eL = range(-1, OFF.E + SEG.E - 2, OFF.E + 1);
  const dL = range(-1, OFF.D + SEG.D - 1, OFF.D);
  const sL = range(-1, OFF.S + SEG.S - 1, OFF.S);
  const w2L = range(-1, OFF.W2 + SEG.W2 - 1, OFF.W2);
  const w1L = range(-1, OFF.W1 + SEG.W1 - 1, OFF.W1);
  const upper = crease
    ? [sR, [...dR, ...eR, ...eL, ...dL], sL]
    : [[...sR, ...dR.slice(1), ...eR, ...eL, ...dL.slice(0, -1), ...sL]];
  return [
    { refs: floor, well: false },
    { refs: w1R, well: true },
    { refs: w2R, well: true },
    ...upper.map((refs) => ({ refs, well: false })),
    { refs: w2L, well: true },
    { refs: w1L, well: true },
  ];
}

interface Grid {
  pos: Float32Array;
  rows: number;
  cols: number;
}

function gridNormals(g: Grid, sideOf: (j: number) => number): Float32Array {
  const { pos, rows, cols } = g;
  const nrm = new Float32Array(pos.length);
  const P = (i: number, j: number, k: number) => pos[(i * cols + j) * 3 + k];
  const tx = [0, 0, 0];
  const tr = [0, 0, 0];
  for (let i = 0; i < rows; i++) {
    const ia = Math.max(0, i - 1);
    const ib = Math.min(rows - 1, i + 1);
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < 3; k++) tx[k] = P(ib, j, k) - P(ia, j, k);
      // along the ring: widen the stencil until it spans something
      let len = 0;
      for (let w = 1; w < cols && len < 1e-9; w++) {
        const ja = Math.max(0, j - w);
        const jb = Math.min(cols - 1, j + w);
        for (let k = 0; k < 3; k++) tr[k] = P(i, jb, k) - P(i, ja, k);
        len = tr[0] * tr[0] + tr[1] * tr[1] + tr[2] * tr[2];
      }
      let nx = tx[1] * tr[2] - tx[2] * tr[1];
      let ny = tx[2] * tr[0] - tx[0] * tr[2];
      let nz = tx[0] * tr[1] - tx[1] * tr[0];
      let l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) {
        nx = 0;
        ny = 0;
        nz = sideOf(j);
        l = 1;
      }
      const o = (i * cols + j) * 3;
      nrm[o] = nx / l;
      nrm[o + 1] = ny / l;
      nrm[o + 2] = nz / l;
    }
  }
  return nrm;
}

export interface ShellMesh {
  body: BufferGeometry;
  /** wheel-well liners */
  wells: BufferGeometry;
  /** feature lines for the x-ray view, as segment pairs (metres) */
  lines: Float32Array;
  xs: number[];
}

export function shellMesh(s: BodyShape): ShellMesh {
  const xs = stations(s);
  const secs: Section[] = xs.map((x) => s.section(x));
  const geos: BufferGeometry[] = [];
  const wellGeos: BufferGeometry[] = [];
  for (const { refs: strip, well } of strips(s.p.beltCrease)) {
    const rows = xs.length;
    const cols = strip.length;
    const pos = new Float32Array(rows * cols * 3);
    for (let i = 0; i < rows; i++) {
      const sec = secs[i];
      for (let j = 0; j < cols; j++) {
        const [side, idx] = strip[j];
        const o = (i * cols + j) * 3;
        pos[o] = xs[i] * M;
        pos[o + 1] = sec.y[idx] * M;
        pos[o + 2] = side * sec.z[idx] * M;
      }
    }
    const nrm = gridNormals({ pos, rows, cols }, (j) => strip[j][0]);
    const index: number[] = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j;
        const b = (i + 1) * cols + j;
        const c = i * cols + j + 1;
        const d = (i + 1) * cols + j + 1;
        index.push(a, b, c, b, d, c);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
    g.setIndex(index);
    (well ? wellGeos : geos).push(g);
  }
  const body = mergeGeometries(geos) ?? new BufferGeometry();
  const wells = mergeGeometries(wellGeos) ?? new BufferGeometry();
  geos.forEach((g) => g.dispose());
  wellGeos.forEach((g) => g.dispose());
  body.computeBoundingBox();
  body.computeBoundingSphere();

  // ── feature lines ──
  const L: number[] = [];
  const along = (idx: number, side: 1 | -1, keep?: (i: number) => boolean) => {
    for (let i = 0; i < xs.length - 1; i++) {
      if (keep && !(keep(i) && keep(i + 1))) continue;
      L.push(xs[i] * M, secs[i].y[idx] * M, side * secs[i].z[idx] * M);
      L.push(xs[i + 1] * M, secs[i + 1].y[idx] * M, side * secs[i + 1].z[idx] * M);
    }
  };
  const beltIdx = OFF.S + SEG.S - 1;
  const roofIdx = OFF.D + SEG.D - 1;
  const hasGh = (i: number) => secs[i].y[roofIdx] - secs[i].y[beltIdx] > 6;
  for (const side of [1, -1] as const) {
    along(beltIdx, side);
    along(roofIdx, side, hasGh);
    along(OFF.S, side);
  }
  along(OFF.E + SEG.E - 1, 1);
  const ring = (x: number) => {
    const sec = s.section(x, newSection());
    const pts: [number, number, number][] = [];
    for (let i = 0; i < HALF_N; i++) pts.push([x * M, sec.y[i] * M, sec.z[i] * M]);
    for (let i = HALF_N - 1; i >= 0; i--) pts.push([x * M, sec.y[i] * M, -sec.z[i] * M]);
    for (let i = 0; i < pts.length - 1; i++) L.push(...pts[i], ...pts[i + 1]);
  };
  ring(s.p.cabin[1]);
  ring(lerp(s.p.cabin[0], s.p.cabin[1], 0.45));
  ring(s.p.cabin[0]);
  return { body, wells, lines: new Float32Array(L), xs };
}

// ───────────────────────────── decals ─────────────────────────────

const VIEW_DIR = { side: [0, 0, 1], top: [0, 1, 0], front: [1, 0, 0], rear: [-1, 0, 0] } as const;

export interface DecalMeshes {
  byMat: Map<DecalMat, BufferGeometry>;
  outlines: Float32Array;
}

export function decalMeshes(s: BodyShape, decals: Decal[]): DecalMeshes {
  const parts = new Map<DecalMat, BufferGeometry[]>();
  const outline: number[] = [];
  for (const d of decals) {
    const span = Math.abs(d.u1 - d.u0);
    let vMax = 0;
    for (let k = 0; k <= 8; k++) {
      const u = lerp(d.u0, d.u1, k / 8);
      vMax = Math.max(vMax, d.hi(u) - d.lo(u));
    }
    if (span < 2 || vMax < 2) continue;
    const nu = d.nu ?? clamp(Math.round(span / 45), 4, 40);
    const nv = d.nv ?? clamp(Math.round(vMax / 45), 2, 16);
    const cols = nv + 1;
    const rows = nu + 1;
    const pos = new Float32Array(rows * cols * 3);
    const ok = new Uint8Array(rows * cols);
    let hint: number | null = null;
    for (let i = 0; i < rows; i++) {
      const u = lerp(d.u0, d.u1, i / nu);
      const lo = d.lo(u);
      const hi = Math.max(lo, d.hi(u));
      for (let j = 0; j < cols; j++) {
        const v = lerp(lo, hi, j / nv);
        let x = 0;
        let y: number;
        let z: number;
        let valid: boolean;
        if (d.view === 'side') {
          x = u;
          y = v;
          z = s.outerZ(u, v);
          valid = z >= 0;
        } else if (d.view === 'top') {
          x = u;
          z = v;
          y = s.topY(u, v);
          valid = Number.isFinite(y);
        } else {
          y = v;
          z = u;
          const ex = s.endX(v, u, d.view, hint);
          // a ray that skims past the nose/tail lands far back on the bonnet/deck: not this decal
          const tip = d.view === 'front' ? s.c.xF : s.c.xR;
          valid = ex !== null && Math.abs(ex - tip) < (d.depth ?? 420);
          if (ex !== null) {
            x = ex;
            hint = ex;
          }
        }
        const o = (i * cols + j) * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        ok[i * cols + j] = valid ? 1 : 0;
      }
    }
    // rejected points are never indexed, but keep them finite (bounds, normals): park them on
    // the first good point
    let anchor = -1;
    for (let k = 0; k < ok.length; k++)
      if (ok[k]) {
        anchor = k;
        break;
      }
    if (anchor < 0) continue;
    for (let k = 0; k < ok.length; k++) {
      if (
        ok[k] &&
        Number.isFinite(pos[k * 3]) &&
        Number.isFinite(pos[k * 3 + 1]) &&
        Number.isFinite(pos[k * 3 + 2])
      )
        continue;
      ok[k] = 0;
      pos[k * 3] = pos[anchor * 3];
      pos[k * 3 + 1] = pos[anchor * 3 + 1];
      pos[k * 3 + 2] = pos[anchor * 3 + 2];
    }
    // normals from the grid, then lift off the surface
    const dir = VIEW_DIR[d.view];
    const nrm = new Float32Array(pos.length);
    const P = (i: number, j: number, k: number) => pos[(i * cols + j) * 3 + k];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const ia = Math.max(0, i - 1);
        const ib = Math.min(rows - 1, i + 1);
        const ja = Math.max(0, j - 1);
        const jb = Math.min(cols - 1, j + 1);
        const du = [
          P(ib, j, 0) - P(ia, j, 0),
          P(ib, j, 1) - P(ia, j, 1),
          P(ib, j, 2) - P(ia, j, 2),
        ];
        const dv = [
          P(i, jb, 0) - P(i, ja, 0),
          P(i, jb, 1) - P(i, ja, 1),
          P(i, jb, 2) - P(i, ja, 2),
        ];
        let nx = du[1] * dv[2] - du[2] * dv[1];
        let ny = du[2] * dv[0] - du[0] * dv[2];
        let nz = du[0] * dv[1] - du[1] * dv[0];
        let l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) {
          [nx, ny, nz] = dir;
          l = 1;
        }
        nx /= l;
        ny /= l;
        nz /= l;
        if (nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const o = (i * cols + j) * 3;
        nrm[o] = nx;
        nrm[o + 1] = ny;
        nrm[o + 2] = nz;
      }
    }
    const off = d.offset ?? 4;
    for (let k = 0; k < pos.length; k++) pos[k] = (pos[k] + nrm[k] * off) * M;

    const copies: (1 | -1)[] = d.mirror ? [1, -1] : [1];
    for (const sgn of copies) {
      const p2 = new Float32Array(pos);
      const n2 = new Float32Array(nrm);
      if (sgn < 0) {
        for (let k = 2; k < p2.length; k += 3) {
          p2[k] = -p2[k];
          n2[k] = -n2[k];
        }
      }
      const index: number[] = [];
      for (let i = 0; i < rows - 1; i++) {
        for (let j = 0; j < cols - 1; j++) {
          const a = i * cols + j;
          const b = (i + 1) * cols + j;
          const c = i * cols + j + 1;
          const e = (i + 1) * cols + j + 1;
          if (!(ok[a] && ok[b] && ok[c] && ok[e])) continue;
          // winding so the face looks along its normal
          const ax = p2[b * 3] - p2[a * 3];
          const ay = p2[b * 3 + 1] - p2[a * 3 + 1];
          const az = p2[b * 3 + 2] - p2[a * 3 + 2];
          const bx = p2[c * 3] - p2[a * 3];
          const by = p2[c * 3 + 1] - p2[a * 3 + 1];
          const bz = p2[c * 3 + 2] - p2[a * 3 + 2];
          const fx = ay * bz - az * by;
          const fy = az * bx - ax * bz;
          const fz = ax * by - ay * bx;
          const flip = fx * n2[a * 3] + fy * n2[a * 3 + 1] + fz * n2[a * 3 + 2] < 0;
          if (flip) index.push(a, c, b, b, c, e);
          else index.push(a, b, c, b, e, c);
        }
      }
      if (!index.length) continue;
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(p2, 3));
      g.setAttribute('normal', new Float32BufferAttribute(n2, 3));
      g.setIndex(index);
      const list = parts.get(d.mat) ?? [];
      list.push(g);
      parts.set(d.mat, list);

      const wantOutline = d.outline ?? (d.mat === 'glass' || d.mat.startsWith('lamp'));
      if (wantOutline) {
        const seg = (a: number, b: number) => {
          if (!ok[a] || !ok[b]) return;
          outline.push(
            p2[a * 3],
            p2[a * 3 + 1],
            p2[a * 3 + 2],
            p2[b * 3],
            p2[b * 3 + 1],
            p2[b * 3 + 2],
          );
        };
        for (let i = 0; i < rows - 1; i++) {
          seg(i * cols, (i + 1) * cols);
          seg(i * cols + nv, (i + 1) * cols + nv);
        }
        for (let j = 0; j < cols - 1; j++) {
          seg(j, j + 1);
          seg(nu * cols + j, nu * cols + j + 1);
        }
      }
    }
  }
  const byMat = new Map<DecalMat, BufferGeometry>();
  for (const [mat, list] of parts) {
    const g = mergeGeometries(list);
    list.forEach((x) => x.dispose());
    if (g) byMat.set(mat, g);
  }
  return { byMat, outlines: new Float32Array(outline) };
}

// ───────────────────────────── arch lips ─────────────────────────────

export function lipMesh(s: BodyShape): BufferGeometry | null {
  const r = s.p.lip;
  if (r <= 0) return null;
  const tubes: BufferGeometry[] = [];
  for (const w of s.c.wheels) {
    const pts: Vector3[] = [];
    const K = 28;
    for (let k = 0; k <= K; k++) {
      const phi = (k / K) * Math.PI;
      const x = w.x + (w.archR + r * 0.3) * Math.cos(phi);
      const y = Math.max(w.y + (w.archR + r * 0.3) * Math.sin(phi), s.bottom(x) + r);
      const z = Math.max(s.outerZ(x, Math.min(y + 6, s.belt(x) - 5)), w.zOuter) - r * 0.35;
      pts.push(new Vector3(x * M, y * M, z * M));
    }
    for (const sgn of [1, -1]) {
      const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(p.x, p.y, sgn * p.z)));
      tubes.push(new TubeGeometry(curve, 40, r * M, 6, false));
    }
  }
  const g = mergeGeometries(tubes);
  tubes.forEach((t) => t.dispose());
  return g;
}

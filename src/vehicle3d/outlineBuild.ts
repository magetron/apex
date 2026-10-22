/**
 * The outline of a car model as plain numbers, no three.js: weld its triangles into one smooth
 * shell and find its feature lines. Pure, so it runs in a worker (outline.worker.ts) and in tests.
 */

/** a fold sharper than this between two faces is a feature line */
export const CREASE_DEG = 50;
/** vertices closer than this are one (m): seams and split normals don't break the shell */
const WELD = 0.0005;

/** What lines a triangle may give: creases; creases and its open edges (window frames); none
 *  (the wheels: their spokes and treads would be noise, their silhouette says enough). */
export const FEATURE = 0;
export const WINDOW = 1;
export const PLAIN = 2;

export interface OutlineData {
  /** welded vertices and their smooth normals */
  positions: Float32Array;
  normals: Float32Array;
  index: Uint32Array;
  /** feature lines as segment end points */
  edges: Float32Array;
}

/** Integer cell of a coordinate on the weld grid (±16 m fits 16 bits per axis). */
const cell = (x: number) => Math.round(x / WELD) + 32768;

/**
 * An open-addressing table from integer keys (< 2^53) to slots, in typed arrays: a JS Map is
 * several times slower for the ~10^6 lookups a detailed car needs.
 */
function table(capacity: number) {
  let size = 1;
  // room for every key at most 0.85 full (the bounds are generous: the real count is far lower)
  while (size < capacity * 1.2) size *= 2;
  const mask = size - 1;
  const keys = new Float64Array(size).fill(-1);
  const vals = new Int32Array(size);
  return {
    vals,
    /** the slot of `key`, claimed for it if new (then keys stays -1 → check `fresh`) */
    slot(key: number): number {
      const lo = key >>> 0;
      const hi = (key / 4294967296) | 0;
      let i = Math.imul(lo ^ Math.imul(hi, 0x9e3779b1), 0x85ebca6b) & mask;
      while (keys[i] !== -1 && keys[i] !== key) i = (i + 1) & mask;
      return i;
    },
    fresh: (i: number) => keys[i] === -1,
    claim(i: number, key: number, val: number) {
      keys[i] = key;
      vals[i] = val;
    },
    /** every claimed slot */
    *each(): Generator<[number, number]> {
      for (let i = 0; i < size; i++) if (keys[i] !== -1) yield [keys[i], vals[i]];
    },
  };
}

/**
 * Welds raw triangles (vehicle-frame positions, flat) and finds their outline features. Pure, for
 * tests: `kind[t]` says what lines triangle t may give (FEATURE, WINDOW or PLAIN).
 */
export function buildOutline(pos: Float32Array, kind: Uint8Array): OutlineData {
  const tris = pos.length / 9;
  const ids = table(tris * 3);
  const welded = new Float32Array(tris * 9);
  let n = 0;
  const index = new Uint32Array(tris * 3);
  const keptKind = new Uint8Array(tris);
  let kept = 0;
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const o = (t * 3 + k) * 3;
      const key = (cell(pos[o]) * 65536 + cell(pos[o + 1])) * 65536 + cell(pos[o + 2]);
      const s = ids.slot(key);
      if (ids.fresh(s)) {
        ids.claim(s, key, n);
        welded[n * 3] = pos[o];
        welded[n * 3 + 1] = pos[o + 1];
        welded[n * 3 + 2] = pos[o + 2];
        n++;
      }
      index[kept * 3 + k] = ids.vals[s];
    }
    const a = index[kept * 3];
    const b = index[kept * 3 + 1];
    const c = index[kept * 3 + 2];
    // a triangle welded to a line or a point has no face
    if (a !== b && b !== c && c !== a) keptKind[kept++] = kind[t];
  }
  const positions = welded.slice(0, n * 3);
  // face normals: area-weighted into the smooth vertex normals, unit for the crease test
  const faceN = new Float32Array(kept * 3);
  const normals = new Float32Array(n * 3);
  for (let f = 0; f < kept; f++) {
    const a = index[f * 3] * 3;
    const b = index[f * 3 + 1] * 3;
    const c = index[f * 3 + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (let j = 0; j < 3; j++) {
      const v = j === 0 ? a : j === 1 ? b : c;
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    faceN[f * 3] = nx / l;
    faceN[f * 3 + 1] = ny / l;
    faceN[f * 3 + 2] = nz / l;
  }
  for (let v = 0; v < n * 3; v += 3) {
    const l = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= l;
    normals[v + 1] /= l;
    normals[v + 2] /= l;
  }
  // edges: shared by two faces folding sharper than CREASE_DEG, or a window's with one face only
  const cos = Math.cos((CREASE_DEG * Math.PI) / 180);
  const seen = table(kept * 3);
  const out: number[] = [];
  const push = (u: number, v: number) =>
    out.push(
      positions[u * 3],
      positions[u * 3 + 1],
      positions[u * 3 + 2],
      positions[v * 3],
      positions[v * 3 + 1],
      positions[v * 3 + 2],
    );
  for (let f = 0; f < kept; f++)
    for (let k = 0; k < 3; k++) {
      const u = index[f * 3 + k];
      const v = index[f * 3 + ((k + 1) % 3)];
      const key = Math.min(u, v) * 16777216 + Math.max(u, v);
      const s = seen.slot(key);
      if (seen.fresh(s)) {
        seen.claim(s, key, f);
        continue;
      }
      const g = seen.vals[s];
      if (g < 0) continue;
      const dot =
        faceN[f * 3] * faceN[g * 3] +
        faceN[f * 3 + 1] * faceN[g * 3 + 1] +
        faceN[f * 3 + 2] * faceN[g * 3 + 2];
      if (dot <= cos && keptKind[f] !== PLAIN && keptKind[g] !== PLAIN) push(u, v);
      seen.vals[s] = -1;
    }
  for (const [key, f] of seen.each())
    if (f >= 0 && keptKind[f] === WINDOW) push(Math.floor(key / 16777216), key % 16777216);
  return { positions, normals, index: index.slice(0, kept * 3), edges: new Float32Array(out) };
}

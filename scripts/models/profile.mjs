// Measures each converted model's body profile, which the site uses to place the cabin, seats and
// luggage inside that body (src/vehicle3d/gltf/profile.ts).
// usage: node scripts/models/profile.mjs [vehicle-id ...]   (default: every models/raw/*.glb)
//   models/raw/<id>.glb → src/vehicle3d/gltf/profiles/<id>.json   (mm, vehicle frame)
import { readdirSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const STEP = 50;
const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('models/raw')
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.replace(/\.glb$/, ''));

const sorted = (a) => a.sort((u, v) => u - v);
const pct = (s, q) => s[Math.min(s.length - 1, Math.floor(s.length * q))];
const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

for (const id of ids) {
  const doc = await io.read(`models/raw/${id}.glb`);
  const spec = (await import(`../../src/spec/catalog/vehicles/${id}.ts`)).default;
  const halfW = spec.dims.widthMm / 2;
  const body = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === 'body');
  const bins = new Map();
  const bin = (k) => {
    let b = bins.get(k);
    if (!b) bins.set(k, (b = { centre: [], y: [], z: [] }));
    return b;
  };
  /** side glass [x, y]: windows, and in most models the lamp lenses too (one material) */
  const sideGlass = [];
  /** body triangles (mm) for the roof rays */
  const tris = [];
  for (const node of body.listChildren()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? '';
      const role = /^apx:([a-z]+):/.exec(name)?.[1];
      // windows only: lamp lenses are glass too, and would stretch the cabin to both ends
      const window = role === 'glass' && !/light|lamp|lens|head|tail|indicator|fog/i.test(name);
      if (role === 'interior') continue;
      const pos = prim.getAttribute('POSITION');
      const lo = apply(M, pos.getMin([]));
      const hi = apply(M, pos.getMax([]));
      // a flat sheet at road level is the model's contact shadow, not the car's floor
      if (Math.max(lo[1], hi[1]) < 0.03 && Math.abs(hi[1] - lo[1]) < 0.02) continue;
      const world = [];
      for (let i = 0, v = []; i < pos.getCount(); i++)
        world.push(apply(M, pos.getElement(i, v)).map((c) => c * 1000));
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      for (let t = 0; t + 2 < n; t += 3)
        tris.push([0, 1, 2].map((k) => world[idx ? idx.getScalar(t + k) : t + k]));
      for (let i = 0, v = []; i < pos.getCount(); i++) {
        const [x, y, zs] = apply(M, pos.getElement(i, v)).map((c) => c * 1000);
        const z = Math.abs(zs);
        // no bodywork sits within 40 mm of the road: lower is a contact shadow merged into a body
        // material (the Abarth's), which would read as floor and width
        if (y < 40) continue;
        const b = bin(Math.round(x / STEP));
        if (z < 0.3 * halfW) b.centre.push(y);
        b.y.push(y);
        b.z.push(z);
        if (window && z > 0.5 * halfW) sideGlass.push([x, y]);
      }
    }
  }
  // highest surface under each ray: 8 rays per slice at ±5…±35% of the half width
  // the first 8 (±5…35% of the half width) read the roof line; the outer ones its width
  const INNER = [-0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35];
  const OUTER = [0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
  const RAYS = [...INNER, ...OUTER.flatMap((f) => [-f, f])].map((f) => f * halfW);
  const rayTops = new Map([...bins.keys()].map((k) => [k, RAYS.map(() => -Infinity)]));
  // the floor line: where each slice's plane cuts the body triangles, the lowest cut (40 mm and
  // up: lower is a contact shadow). Triangles, not vertices: a door or sill is often one big
  // triangle whose corners sit far outside the slice
  const floor = new Map();
  for (const [a, b, c] of tris) {
    const k0 = Math.round(Math.min(a[0], b[0], c[0]) / STEP);
    const k1 = Math.round(Math.max(a[0], b[0], c[0]) / STEP);
    for (let k = k0; k <= k1; k++) {
      const X = k * STEP;
      let lo = Infinity;
      for (const [u, w] of [
        [a, b],
        [b, c],
        [c, a],
      ])
        if (u[0] !== w[0] && (u[0] - X) * (w[0] - X) <= 0)
          lo = Math.min(lo, u[1] + ((X - u[0]) / (w[0] - u[0])) * (w[1] - u[1]));
      if (lo >= 40 && lo < (floor.get(k) ?? Infinity)) floor.set(k, lo);
    }
  }
  for (const [a, b, c] of tris) {
    const k0 = Math.round(Math.min(a[0], b[0], c[0]) / STEP);
    const k1 = Math.round(Math.max(a[0], b[0], c[0]) / STEP);
    const z0 = Math.min(a[2], b[2], c[2]);
    const z1 = Math.max(a[2], b[2], c[2]);
    const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
    if (Math.abs(d) < 1e-9) continue;
    for (let k = k0; k <= k1; k++) {
      const tops = rayTops.get(k);
      if (!tops) continue;
      const x = k * STEP;
      RAYS.forEach((z, r) => {
        if (z < z0 || z > z1) return;
        // barycentric weights of (x, z) in the triangle's plan view
        const u = ((b[0] - x) * (c[2] - z) - (c[0] - x) * (b[2] - z)) / d;
        const v = ((c[0] - x) * (a[2] - z) - (a[0] - x) * (c[2] - z)) / d;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) return;
        const y = u * a[1] + v * b[1] + w * c[1];
        if (y > tops[r]) tops[r] = y;
      });
    }
  }
  // the cabin spans the side windows' upper part (lamps sit lower than 70% of the height); the
  // belt is the lowest side glass inside that span
  const high = sorted(sideGlass.filter(([, y]) => y > 0.7 * spec.dims.heightMm).map(([x]) => x));
  const cabin = high.length ? [Math.round(pct(high, 0.01)), Math.round(pct(high, 0.99))] : null;
  const glassY = new Map();
  for (const [x, y] of sideGlass) {
    if (!cabin || x < cabin[0] - 100 || x > cabin[1] + 100 || y < 0.45 * spec.dims.heightMm)
      continue;
    const k = Math.round(x / STEP);
    glassY.set(k, [...(glassY.get(k) ?? []), y]);
  }
  const p = { top: [], belt: [], bottom: [], plan: [], cabin };
  for (const k of [...bins.keys()].sort((a, b) => a - b)) {
    const b = bins.get(k);
    if (b.y.length < 20) continue;
    const x = k * STEP;
    // the roof line: rays straight down at 8 points across the slice hit the body's surfaces; an
    // aerial or fin is thinner than the gap between rays, and the third-highest hit ignores
    // anything that does get hit
    const hits = sorted((rayTops.get(k) ?? []).slice(0, INNER.length).filter((y) => y > -Infinity));
    const top =
      hits.length >= 3
        ? hits[hits.length - 3]
        : pct(sorted(b.centre.length >= 10 ? b.centre : b.y), 0.98);
    p.top.push([x, Math.round(top)]);
    p.bottom.push([x, Math.round(floor.get(k) ?? pct(sorted(b.y), 0.02))]);
    p.plan.push([x, +(pct(sorted(b.z), 0.95) / halfW).toFixed(3)]);
    p.belt.push([
      x,
      Math.round(
        Math.min(top, (glassY.get(k) ?? []).length >= 6 ? pct(sorted(glassY.get(k)), 0.05) : top),
      ),
    ]);
  }
  // roof width over the cabin: the outermost ray still on the roof (within 80 mm of its line), as
  // a share of the body's half width there; the median over the cabin
  if (cabin) {
    const shares = [];
    for (const [x, top] of p.top) {
      if (x < cabin[0] || x > cabin[1]) continue;
      const ys = rayTops.get(Math.round(x / STEP));
      const plan = p.plan.find(([px]) => px === x)?.[1];
      if (!ys || !plan) continue;
      let reach = 0.35;
      OUTER.forEach((f, i) => {
        if (Math.min(ys[INNER.length + 2 * i], ys[INNER.length + 2 * i + 1]) > top - 80) reach = f;
      });
      shares.push(reach / plan);
    }
    if (shares.length)
      p.roofHalf = +Math.min(0.95, sorted(shares)[Math.floor(shares.length / 2)]).toFixed(2);
  }
  writeFileSync(`src/vehicle3d/gltf/profiles/${id}.json`, `${JSON.stringify(p)}\n`);
  console.log(
    `${id}: roof ${Math.max(...p.top.map(([, y]) => y))} (spec height ${spec.dims.heightMm})`,
  );
}

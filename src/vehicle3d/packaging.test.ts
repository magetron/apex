/**
 * Nothing inside the car runs into anything else, for every catalog car: the powertrain parts (the
 * engine as its drawn meshes), the seated occupants, the radiators, the exhaust silencers and the
 * wheels keep out of each other, and the coolant and exhaust pipes keep out of the wheels (the
 * front ones through their steering sweep), the people and the fuel tank; nothing hangs below the
 * road; a two-row car's rear passengers sit ahead of the rear axle; an EV's battery lies between
 * the wheels. Solids come from the same pure functions the scene draws from (layoutPowertrain,
 * seatPlan, coolingPlan, exhaustPlan, tankSaddle, the engine geometry) as signed-distance shapes;
 * the overlap of two solids is the thickness of their intersection (twice the largest ball that
 * fits inside both), which for two boxes is their axis-aligned overlap.
 */
import { CatmullRomCurve3, Matrix4, Vector3, type Box3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { buildEngineGeometry } from '../engine3d/geometry';
import { buildRotaryGeometry, rotaryDrawnBoxesMm } from '../engine3d/rotaryGeometry';
import { getEngine, listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import type { PlacedPart, PowertrainLayout, Vec3, VehicleSpec } from '../spec/types';
import { DEG } from '../spec/units';
import { coolingPlan, exhaustPlan, SEATED_MM, seatPlan, tankSaddle, type Seat } from './packaging';
import { getShell } from './shell/build';

/** mm two solids of different systems may share (touching, modelling slack) */
const TOLERANCE_MM = 25;
/** the sim's steering lock (sim/model/params.ts) */
const STEER_LOCK_DEG = 32;

// ───────────────────────────── solids ─────────────────────────────

type Sys =
  | 'engine'
  | 'gearbox'
  | 'diff'
  | 'coupling'
  | 'motor'
  | 'battery'
  | 'fuel'
  | 'wheel'
  /** a front wheel turned toward the lock: only cooling and exhaust must keep clear of it */
  | 'steer'
  | 'occupant'
  | 'cooling'
  | 'exhaust';

interface Solid {
  sys: Sys;
  /** reported name; several solids (a tube's segments) may share one */
  name: string;
  /** a pipe: may run into the engine/drive unit it serves */
  pipe?: boolean;
  lo: Vec3;
  hi: Vec3;
  /** signed distance (mm, negative inside) */
  sd: (x: number, y: number, z: number) => number;
}

/** 3×3 rotation as its columns: the local X, Y, Z axes in the vehicle frame */
type Rot = [Vec3, Vec3, Vec3];
const I: Rot = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const rotY = (t: number): Rot => [
  [Math.cos(t), 0, -Math.sin(t)],
  [0, 1, 0],
  [Math.sin(t), 0, Math.cos(t)],
];
const rotX = (t: number): Rot => [
  [1, 0, 0],
  [0, Math.cos(t), Math.sin(t)],
  [0, -Math.sin(t), Math.cos(t)],
];
const rotZ = (t: number): Rot => [
  [Math.cos(t), Math.sin(t), 0],
  [-Math.sin(t), Math.cos(t), 0],
  [0, 0, 1],
];
const apply = (r: Rot, v: Vec3): Vec3 => [
  r[0][0] * v[0] + r[1][0] * v[1] + r[2][0] * v[2],
  r[0][1] * v[0] + r[1][1] * v[1] + r[2][1] * v[2],
  r[0][2] * v[0] + r[1][2] * v[1] + r[2][2] * v[2],
];
const mul = (a: Rot, b: Rot): Rot => [apply(a, b[0]), apply(a, b[1]), apply(a, b[2])];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function box(sys: Sys, name: string, c: Vec3, r: Rot, half: Vec3): Solid {
  const e = [0, 1, 2].map(
    (i) => Math.abs(r[0][i]) * half[0] + Math.abs(r[1][i]) * half[1] + Math.abs(r[2][i]) * half[2],
  );
  const [u, v, w] = r;
  return {
    sys,
    name,
    lo: [c[0] - e[0], c[1] - e[1], c[2] - e[2]],
    hi: [c[0] + e[0], c[1] + e[1], c[2] + e[2]],
    sd: (x, y, z) => {
      const dx = x - c[0];
      const dy = y - c[1];
      const dz = z - c[2];
      const qx = Math.abs(dx * u[0] + dy * u[1] + dz * u[2]) - half[0];
      const qy = Math.abs(dx * v[0] + dy * v[1] + dz * v[2]) - half[1];
      const qz = Math.abs(dx * w[0] + dy * w[1] + dz * w[2]) - half[2];
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      return out + Math.min(Math.max(qx, qy, qz), 0);
    },
  };
}

/** capped cylinder about a unit axis */
function cylinder(sys: Sys, name: string, c: Vec3, a: Vec3, r: number, halfLen: number): Solid {
  const e = a.map((ai) => halfLen * Math.abs(ai) + r * Math.sqrt(Math.max(0, 1 - ai * ai)));
  return {
    sys,
    name,
    lo: [c[0] - e[0], c[1] - e[1], c[2] - e[2]],
    hi: [c[0] + e[0], c[1] + e[1], c[2] + e[2]],
    sd: (x, y, z) => {
      const dx = x - c[0];
      const dy = y - c[1];
      const dz = z - c[2];
      const t = dx * a[0] + dy * a[1] + dz * a[2];
      const radial = Math.hypot(dx - t * a[0], dy - t * a[1], dz - t * a[2]) - r;
      const axial = Math.abs(t) - halfLen;
      const out = Math.hypot(Math.max(radial, 0), Math.max(axial, 0));
      return out + Math.min(Math.max(radial, axial), 0);
    },
  };
}

function capsule(sys: Sys, name: string, a: Vec3, b: Vec3, r: number): Solid {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  return {
    sys,
    name,
    lo: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    hi: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
    sd: (x, y, z) => {
      const px = x - a[0];
      const py = y - a[1];
      const pz = z - a[2];
      const t = Math.min(1, Math.max(0, (px * d[0] + py * d[1] + pz * d[2]) / dd));
      return Math.hypot(px - t * d[0], py - t * d[1], pz - t * d[2]) - r;
    },
  };
}

/** a swept tube along the same curve Chassis draws (CatmullRom, tension 0.15) */
function tube(sys: Sys, name: string, run: Vec3[], r: number): Solid[] {
  const clean = run.filter(
    (p, i) =>
      i === 0 || Math.hypot(p[0] - run[i - 1][0], p[1] - run[i - 1][1], p[2] - run[i - 1][2]) > 5,
  );
  if (clean.length < 2) return [];
  const curve = new CatmullRomCurve3(
    clean.map((p) => new Vector3(...p)),
    false,
    'catmullrom',
    0.15,
  );
  const pts = curve.getPoints(Math.max(12, clean.length * 14));
  const out: Solid[] = [];
  for (let i = 1; i < pts.length; i++) {
    const s = capsule(sys, name, pts[i - 1].toArray(), pts[i].toArray(), r);
    s.pipe = true;
    out.push(s);
  }
  return out;
}

/**
 * Thickness of the intersection of two convex solids: 2·max over p of min(−sdA, −sdB). That
 * function is concave, so a coarse grid plus a shrinking pattern search finds its maximum.
 */
function overlapMm(a: Solid, b: Solid): number {
  const lo = [0, 1, 2].map((i) => Math.max(a.lo[i], b.lo[i]));
  const hi = [0, 1, 2].map((i) => Math.min(a.hi[i], b.hi[i]));
  if (hi[0] <= lo[0] || hi[1] <= lo[1] || hi[2] <= lo[2]) return 0;
  const f = (x: number, y: number, z: number) => Math.min(-a.sd(x, y, z), -b.sd(x, y, z));
  const N = 6;
  const step = hi.map((h, i) => (h - lo[i]) / N);
  let best = -Infinity;
  let p: Vec3 = [0, 0, 0];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        const x = lo[0] + (i + 0.5) * step[0];
        const y = lo[1] + (j + 0.5) * step[1];
        const z = lo[2] + (k + 0.5) * step[2];
        const v = f(x, y, z);
        if (v > best) {
          best = v;
          p = [x, y, z];
        }
      }
  let h = Math.max(...step) / 2;
  while (h > 0.5) {
    let moved = false;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dy && !dz) continue;
          const q: Vec3 = [p[0] + dx * h, p[1] + dy * h, p[2] + dz * h];
          const v = f(q[0], q[1], q[2]);
          if (v > best + 1e-6) {
            best = v;
            p = q;
            moved = true;
          }
        }
    if (!moved) h /= 2;
  }
  return Math.max(0, 2 * best);
}

// ───────────────────────────── the car's solids ─────────────────────────────

const engineBoxCache = new Map<string, [string, Box3][]>();
/** the engine's drawn meshes as named boxes in its own frame (mm) */
function engineBoxes(id: string): [string, Box3][] {
  let boxes = engineBoxCache.get(id);
  if (boxes) return boxes;
  const spec = getEngine(id);
  if (spec.family === 'rotary') {
    boxes = rotaryDrawnBoxesMm(buildRotaryGeometry(spec, 'low')).map((b) => ['rotary', b]);
  } else {
    const g = buildEngineGeometry(spec, 'low');
    const geos: [string, BufferGeometry | null][] = [
      ['block', g.block],
      ['sump', g.sump],
      ...g.heads.flatMap((hd): [string, BufferGeometry][] => [
        ['head', hd.casting],
        ['cam cover', hd.cover],
      ]),
      ['flywheel', g.flywheel],
      ['timing cover', g.timingCover],
      ...g.intake.map((x): [string, BufferGeometry] => ['intake', x]),
      ...g.exhaust.map((x): [string, BufferGeometry] => ['exhaust', x]),
      ...g.turbos.flatMap((t): [string, BufferGeometry][] => [
        ['turbo', t.hot],
        ['turbo', t.cold],
      ]),
    ];
    const toMm = new Matrix4().makeScale(1000, 1000, 1000);
    boxes = geos
      .filter((x): x is [string, BufferGeometry] => !!x[1])
      .map(([name, x]) => {
        x.computeBoundingBox();
        return [name, x.boundingBox!.clone().applyMatrix4(toMm)];
      });
  }
  engineBoxCache.set(id, boxes);
  return boxes;
}

const partRot = (p: PlacedPart) => mul(rotY(p.yawDeg * DEG), rotX(p.rollDeg * DEG));

function partSolids(v: VehicleSpec, p: PlacedPart): Solid[] {
  const r = partRot(p);
  const half: Vec3 = [p.sizeMm[0] / 2, p.sizeMm[1] / 2, p.sizeMm[2] / 2];
  switch (p.kind) {
    case 'engine': {
      const pt = v.powertrain;
      if (pt.kind !== 'ice') return [];
      return engineBoxes(pt.engine).map(([name, b]) => {
        const c = b.getCenter(new Vector3()).toArray();
        const s = b.getSize(new Vector3()).toArray();
        return box('engine', `engine ${name}`, add(p.posMm, apply(r, c)), r, [
          s[0] / 2,
          s[1] / 2,
          s[2] / 2,
        ]);
      });
    }
    case 'wheel':
      return [
        cylinder('wheel', p.id, p.posMm, [0, 0, 1], p.sizeMm[0] / 2, p.sizeMm[2] / 2),
        ...(p.axle === 'front'
          ? [-1, -0.5, 0.5, 1].map((k) => {
              const t = k * STEER_LOCK_DEG * DEG;
              return cylinder(
                'steer',
                `${p.id}@${Math.round(k * STEER_LOCK_DEG)}°`,
                p.posMm,
                [Math.sin(t), 0, Math.cos(t)],
                p.sizeMm[0] / 2,
                p.sizeMm[2] / 2,
              );
            })
          : []),
      ];
    case 'diff': {
      // drawn as a ball (smaller inside a gearbox) with the pinion nose toward the prop shaft
      const rr = Math.min(p.sizeMm[0], p.sizeMm[2]) * (p.kg === 0 ? 0.3 : 0.42);
      const out = [capsule('diff', p.id, p.posMm, p.posMm, rr)];
      if (p.kg !== 0) {
        const nose = p.axle === 'front' ? -1 : 1;
        out.push(
          capsule(
            'diff',
            p.id,
            add(p.posMm, [nose * rr * 0.6, 0, 0]),
            add(p.posMm, [nose * rr * 1.5, 0, 0]),
            rr * 0.38,
          ),
        );
      }
      return out;
    }
    case 'gearbox': {
      const [l, h, w] = p.sizeMm;
      if (v.powertrain.kind === 'ice' && v.powertrain.gearbox === 'inline')
        return [cylinder('gearbox', p.id, p.posMm, r[0], h / 2, l / 2)];
      // the case as Drivetrain draws it, plus its bell toward the engine
      return [
        box('gearbox', p.id, add(p.posMm, apply(r, [-0.08 * l, 0, 0])), r, [
          0.42 * l,
          0.46 * h,
          0.45 * w,
        ]),
        cylinder(
          'gearbox',
          p.id,
          add(p.posMm, apply(r, [0.38 * l, 0.05 * h, 0])),
          r[0],
          Math.min(h, w) / 2,
          0.12 * l,
        ),
      ];
    }
    case 'fuel-tank':
      // a saddle: two lobes and a bridge over the channel the prop shaft and pipes run through
      return tankSaddle(p.sizeMm).map((b) =>
        box('fuel', p.id, add(p.posMm, apply(r, b.center)), r, [
          b.size[0] / 2,
          b.size[1] / 2,
          b.size[2] / 2,
        ]),
      );
    default:
      return [box(p.kind === 'battery' ? 'battery' : (p.kind as Sys), p.id, p.posMm, r, half)];
  }
}

function occupantSolids(q: Seat, tag: string): Solid[] {
  const K = 1000 * q.scale;
  const hip: Vec3 = [q.x, q.y, q.z];
  const lean = rotZ(q.recline);
  const at = (local: Vec3) => add(hip, local);
  const atLean = (local: Vec3) => add(hip, apply(lean, local));
  const out: Solid[] = [
    box('occupant', `${tag} cushion`, at([0.13 * K, -0.075 * K, 0]), I, [
      0.23 * K,
      0.04 * K,
      0.22 * K,
    ]),
    box('occupant', `${tag} seat back`, atLean([-0.12 * K, 0.3 * K, 0]), lean, [
      0.04 * K,
      0.3 * K,
      0.22 * K,
    ]),
    box('occupant', `${tag} torso`, atLean([0, 0.3 * K, 0]), lean, [0.13 * K, 0.18 * K, 0.17 * K]),
    capsule('occupant', `${tag} head`, atLean([0, 0.66 * K, 0]), atLean([0, 0.66 * K, 0]), 0.1 * K),
  ];
  const knee: Vec3 = [0.42 * K, 0.06 * K, 0];
  const foot: Vec3 = [0.58 * K, -(q.y - q.floorY) + 50, 0];
  const armDir: Vec3 = [Math.sin(1.25), Math.cos(1.25), 0];
  const thighDir: Vec3 = [Math.cos(0.14), Math.sin(0.14), 0];
  for (const sg of [-1, 1]) {
    const arm = atLean([0.14 * K, 0.33 * K, sg * 0.2 * K]);
    const ah = 0.105 * K;
    out.push(
      capsule(
        'occupant',
        `${tag} arm`,
        add(arm, [-armDir[0] * ah, -armDir[1] * ah, 0]),
        add(arm, [armDir[0] * ah, armDir[1] * ah, 0]),
        0.045 * K,
      ),
    );
    const th = at([0.21 * K, 0.03 * K, sg * 0.095 * K]);
    const tl = 0.11 * K;
    out.push(
      capsule(
        'occupant',
        `${tag} thigh`,
        add(th, [-thighDir[0] * tl, -thighDir[1] * tl, 0]),
        add(th, [thighDir[0] * tl, thighDir[1] * tl, 0]),
        0.07 * K,
      ),
    );
    const k = at([knee[0], knee[1], sg * 0.095 * K]);
    const f = at([foot[0], foot[1], sg * 0.095 * K]);
    const len = Math.hypot(f[0] - k[0], f[1] - k[1]);
    const r = 0.055 * K;
    const s = Math.min(0.5, r / Math.max(len, 1));
    out.push(
      capsule(
        'occupant',
        `${tag} shin`,
        [k[0] + (f[0] - k[0]) * s, k[1] + (f[1] - k[1]) * s, k[2]],
        [f[0] - (f[0] - k[0]) * s, f[1] - (f[1] - k[1]) * s, f[2]],
        r,
      ),
    );
  }
  return out;
}

interface CarSolids {
  layout: PowertrainLayout;
  seats: Seat[];
  solids: Solid[];
}

function carSolids(v: VehicleSpec): CarSolids {
  const shell = getShell(v);
  const s = shell.shape;
  const layout = layoutPowertrain(v);
  const seats = seatPlan(v, s);
  const solids: Solid[] = layout.parts.flatMap((p) => partSolids(v, p));
  seats.forEach((q) => {
    const side = Math.abs(q.z) < 1 ? 'C' : q.z < 0 ? 'L' : 'R';
    solids.push(...occupantSolids(q, `occupant ${q.row}${side}`));
  });
  const cooling = coolingPlan(v, s, layout);
  cooling.radiators.forEach((r, i) =>
    solids.push(
      box('cooling', `radiator ${i}`, r.center, rotY(r.yaw), [
        r.size[0] / 2,
        r.size[1] / 2,
        r.size[2] / 2,
      ]),
    ),
  );
  cooling.pipes.forEach((run, i) => solids.push(...tube('cooling', `coolant pipe ${i}`, run, 16)));
  const tips = shell.tips.map((t) => t.pos.map((c) => c * 1000) as Vec3);
  const exhaust = exhaustPlan(v, s, layout, tips);
  if (exhaust) {
    exhaust.runs.forEach((run, i) => solids.push(...tube('exhaust', `exhaust run ${i}`, run, 27)));
    exhaust.boxes.forEach((b, i) =>
      solids.push(
        box('exhaust', i === 0 ? 'silencer' : `exhaust box ${i}`, b.center, I, [
          b.size[0] / 2,
          b.size[1] / 2,
          b.size[2] / 2,
        ]),
      ),
    );
  }
  return { layout, seats, solids };
}

const DRIVELINE = new Set<Sys>(['engine', 'gearbox', 'diff', 'coupling', 'motor']);

/** what a pipe must keep out of: real ones bend round the driveline, not through people or fuel */
const PIPE_CLEAR = new Set<Sys>(['wheel', 'steer', 'occupant', 'fuel']);

/**
 * Pairs meant to touch: one system, the bolted-up driveline, the exhaust at its manifolds; a turned
 * front wheel only has to miss the radiators and the exhaust.
 */
function mayTouch(a: Solid, b: Solid): boolean {
  if (a.sys === b.sys) return true;
  if (DRIVELINE.has(a.sys) && DRIVELINE.has(b.sys)) return true;
  const ok = (x: Solid, y: Solid) =>
    (x.pipe === true && !PIPE_CLEAR.has(y.sys)) ||
    (x.sys === 'steer' && y.sys !== 'cooling' && y.sys !== 'exhaust') ||
    (x.sys === 'exhaust' && y.sys === 'engine');
  return ok(a, b) || ok(b, a);
}

interface Clash {
  a: string;
  b: string;
  mm: number;
}

function clashes(solids: Solid[]): Clash[] {
  const worst = new Map<string, Clash>();
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      if (mayTouch(a, b)) continue;
      if (
        a.hi[0] <= b.lo[0] + TOLERANCE_MM ||
        b.hi[0] <= a.lo[0] + TOLERANCE_MM ||
        a.hi[1] <= b.lo[1] + TOLERANCE_MM ||
        b.hi[1] <= a.lo[1] + TOLERANCE_MM ||
        a.hi[2] <= b.lo[2] + TOLERANCE_MM ||
        b.hi[2] <= a.lo[2] + TOLERANCE_MM
      )
        continue;
      const mm = overlapMm(a, b);
      if (mm <= TOLERANCE_MM) continue;
      const [n1, n2] = [a.name, b.name].sort();
      const key = `${n1}|${n2}`;
      const prev = worst.get(key);
      if (!prev || prev.mm < mm) worst.set(key, { a: n1, b: n2, mm: Math.round(mm) });
    }
  return [...worst.values()].sort((x, y) => y.mm - x.mm);
}

/**
 * Clashes owned elsewhere, allowed up to their present depth so that anything new still fails.
 * engine3d draws the 289's 900 mm primaries as loops reaching 384 mm out from the block: wider than
 * a 1965 Mustang's engine bay, so they run into the front tyres (to fold in, in engine3d).
 */
const KNOWN: { car: string; a: RegExp; b: RegExp; mm: number }[] = [
  { car: 'ford-mustang-gt350-1965', a: /^engine exhaust$/, b: /^wheel-front-/, mm: 60 },
];

const cache = new Map<string, CarSolids>();
const solidsOf = (v: VehicleSpec) => {
  let c = cache.get(v.id);
  if (!c) cache.set(v.id, (c = carSolids(v)));
  return c;
};

const cars = listVehicles().map((v) => [v.id, v] as const);

describe('packaging', () => {
  it.each(cars)('%s: no two systems run into each other', (id, v) => {
    const known = KNOWN.filter((k) => k.car === id);
    const left = clashes(solidsOf(v).solids).filter(
      (c) => !known.some((k) => k.a.test(c.a) && k.b.test(c.b) && c.mm <= k.mm),
    );
    expect(left.map((c) => `${c.a} × ${c.b}: ${c.mm} mm`)).toEqual([]);
  });

  it.each(cars)('%s: nothing below the road', (_id, v) => {
    const low = solidsOf(v)
      .solids.filter((s) => s.sys !== 'wheel' && s.sys !== 'steer' && s.lo[1] < 0)
      .map((s) => `${s.name}: ${Math.round(s.lo[1])} mm`);
    expect(low).toEqual([]);
  });

  it.each(cars.filter(([, v]) => v.seats.layout !== '2' && v.seats.layout !== '7'))(
    '%s: the rear row sits ahead of the rear axle',
    (_id, v) => {
      const L = v.dims.wheelbaseMm;
      for (const q of solidsOf(v).seats.filter((x) => x.row === 1)) {
        const head = q.x - Math.sin(q.recline) * SEATED_MM * q.scale * 0.8;
        expect(q.x).toBeGreaterThan(-L + 100);
        expect(head).toBeGreaterThan(-L - TOLERANCE_MM);
      }
    },
  );

  it.each(cars.filter(([, v]) => v.powertrain.kind === 'ev'))(
    '%s: the battery lies between the axles, clear of the wheels',
    (_id, v) => {
      const b = solidsOf(v).layout.parts.find((p) => p.kind === 'battery')!;
      const R = v.tires.diameterMm / 2;
      expect(b.posMm[0] + b.sizeMm[0] / 2).toBeLessThanOrEqual(-R);
      expect(b.posMm[0] - b.sizeMm[0] / 2).toBeGreaterThanOrEqual(-v.dims.wheelbaseMm + R);
    },
  );
});

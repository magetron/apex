/**
 * Where people, radiators and the exhaust go (pure, mm, vehicle frame). Derived from the spec, the
 * powertrain layout and the evaluated body shell, so the cabin fits inside the glasshouse and nobody
 * sits in the engine, the fuel tank or a wheel arch (packaging.test.ts checks every catalog car).
 */
import { getEngine } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';
import { ENGINE_DRESS_MM, FUEL_TANK, layoutPowertrain, partBounds } from '../spec/derive/layout';
import type { BodyStyle, PlacedPart, PowertrainLayout, Vec3, VehicleSpec } from '../spec/types';
import { DEG } from '../spec/units';
import type { BodyShapeApi } from './shell/types';

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ───────────────────────────── hardware ─────────────────────────────

interface Hard {
  p: PlacedPart;
  lo: Vec3;
  hi: Vec3;
}

/**
 * Placed parts as boxes in the vehicle frame, as drawn: an engine with its dress, a gearbox case a
 * little inside its layout box (Drivetrain.tsx); wheels left out.
 */
function hardware(layout: PowertrainLayout): Hard[] {
  return layout.parts
    .filter((p) => p.kind !== 'wheel')
    .map((p) => {
      const d = p.kind === 'engine' ? ENGINE_DRESS_MM : 0;
      const inflate: Vec3 =
        p.kind === 'gearbox' ? [0, -0.04 * p.sizeMm[1], -0.05 * p.sizeMm[2]] : [d, d, d];
      const [lo, hi] = partBounds(p, inflate);
      return { p, lo, hi };
    });
}

/** x spans that a box of height [y0, y1] and width [z0, z1] can't take without touching `parts`. */
function blockedX(
  parts: Hard[],
  [y0, y1]: [number, number],
  [z0, z1]: [number, number],
  gap: number,
): [number, number][] {
  return parts
    .filter(
      (h) => h.hi[1] > y0 - gap && h.lo[1] < y1 + gap && h.hi[2] > z0 - gap && h.lo[2] < z1 + gap,
    )
    .map((h) => [h.lo[0] - gap, h.hi[0] + gap]);
}

/** The x nearest `want` where a length `len` fits between the blocked spans. */
function nearestFree(want: number, len: number, blocked: [number, number][]): number {
  const free = (x: number) => blocked.every(([a, b]) => x + len / 2 <= a || x - len / 2 >= b);
  if (free(want)) return want;
  const ok = blocked.flatMap(([a, b]) => [a - len / 2, b + len / 2]).filter(free);
  return ok.length ? ok.reduce((p, c) => (Math.abs(c - want) < Math.abs(p - want) ? c : p)) : want;
}

/** The saddle tank as drawn, in its part frame (mm): two lobes and the bridge over the channel. */
export function tankSaddle(sizeMm: Vec3): { center: Vec3; size: Vec3 }[] {
  const [l, h, w] = sizeMm;
  const t = Math.min(FUEL_TANK.tunnelHalfMm, w / 2 - 60);
  const th = Math.min(FUEL_TANK.tunnelHMm, h - 50);
  const lobe = w / 2 - t;
  return [
    { center: [0, 0, -(t + lobe / 2)], size: [l, h, lobe] },
    { center: [0, 0, t + lobe / 2], size: [l, h, lobe] },
    { center: [0, th / 2, 0], size: [l, h - th, 2 * t] },
  ];
}

// ───────────────────────────── seats ─────────────────────────────

export interface Seat {
  /** hip point */
  x: number;
  y: number;
  z: number;
  row: number;
  /** torso recline from vertical (rad) */
  recline: number;
  /** mannequin scale (rear seats of a 2+2 are kid-sized) */
  scale: number;
  driver: boolean;
  floorY: number;
}

const HIP: Record<BodyStyle, number> = {
  supercar: 150,
  coupe: 190,
  roadster: 190,
  fastback: 250,
  hatch: 270,
  saloon: 260,
  estate: 260,
  city: 320,
  suv: 360,
  offroader: 400,
};

/** Seated height from hip to head top at zero recline (mm, scale 1). */
export const SEATED_MM = 800;
/** closest the rows come: legroom you can still sit in (city cars, old coupés) */
const MIN_PITCH = 560;
/** mm kept between a person and the hardware ahead, behind and below them */
const ROOM = 25;
/** mm a person may touch hardware beside them (thighs against a transmission tunnel) */
const BESIDE = 10;
/** most an adult leans back before the cabin would rather move (deg) */
const COMFY_RECLINE = 30;
/** how far the cabin may move on, past where it clears the hardware, to seat people comfortably */
const COMFORT_TRAVEL = 240;

interface Disc {
  x: number;
  y: number;
  r: number;
  /** half width across the car */
  zh: number;
}

/** A seated mannequin (as Cabin.tsx draws it) in side view: discs with their half widths. */
function occupantDiscs(q: Seat): Disc[] {
  const K = 1000 * q.scale;
  const ca = Math.cos(q.recline);
  const sa = Math.sin(q.recline);
  const out: Disc[] = [];
  const lean = (px: number, py: number, r: number, zh: number) =>
    out.push({ x: q.x + px * ca - py * sa, y: q.y + px * sa + py * ca, r, zh });
  const line = (a: [number, number], b: [number, number], k: number, r: number, zh: number) => {
    for (let i = 0; i < k; i++) {
      const t = i / (k - 1);
      out.push({ x: q.x + a[0] + (b[0] - a[0]) * t, y: q.y + a[1] + (b[1] - a[1]) * t, r, zh });
    }
  };
  // cushion, thighs, shins down to the floor
  line([-0.06 * K, -0.075 * K], [0.32 * K, -0.075 * K], 5, 0.04 * K, 0.22 * K);
  line([0.03 * K, 0.005 * K], [0.39 * K, 0.055 * K], 5, 0.07 * K, 0.165 * K);
  line([0.42 * K, 0.06 * K], [0.58 * K, q.floorY + 50 - q.y], 5, 0.055 * K, 0.15 * K);
  // seat back, torso and head lean back together
  for (let i = 0; i < 7; i++) lean(-0.12 * K, (0.04 + (0.52 * i) / 6) * K, 0.04 * K, 0.22 * K);
  for (const t of [0.17, 0.3, 0.43]) lean(0, t * K, 0.13 * K, 0.17 * K);
  lean(0, 0.66 * K, 0.1 * K, 0.1 * K);
  return out;
}

/** How deep (mm) a seated occupant reaches into the hardware, ROOM included. */
function intrusion(q: Seat, parts: Hard[]): number {
  let worst = 0;
  for (const d of occupantDiscs(q))
    for (const h of parts) {
      if (q.z + d.zh <= h.lo[2] + BESIDE || q.z - d.zh >= h.hi[2] - BESIDE) continue;
      const x0 = h.lo[0] - ROOM;
      const x1 = h.hi[0] + ROOM;
      const y0 = h.lo[1] - ROOM;
      const y1 = h.hi[1] + ROOM;
      const dx = Math.max(x0 - d.x, 0, d.x - x1);
      const dy = Math.max(y0 - d.y, 0, d.y - y1);
      const pen =
        dx || dy
          ? d.r - Math.hypot(dx, dy)
          : d.r + Math.min(d.x - x0, x1 - d.x, d.y - y0, y1 - d.y);
      worst = Math.max(worst, pen);
    }
  return worst;
}

/**
 * One floor for the cabin, its lowest sill: right at an axle the body's lowest point is the wheel
 * arch, which no seat sits on. Seats stand 90 mm above it.
 */
function cabinFloor(s: BodyShapeApi): number {
  const [cabRear, cabFront] = s.p.cabin;
  let floor = Infinity;
  for (let x = cabRear; x <= cabFront; x += 100) floor = Math.min(floor, s.bottom(x));
  return floor;
}

export function seatPlan(
  v: VehicleSpec,
  s: BodyShapeApi,
  layout: PowertrainLayout = layoutPowertrain(v),
): Seat[] {
  const b = v.body;
  const W = v.dims.widthMm;
  const L = v.dims.wheelbaseMm;
  const [cabRear, cabFront] = s.p.cabin;
  const rows: { n: number; scale: number }[] = [{ n: 2, scale: 1 }];
  if (v.seats.layout === '2+2') rows.push({ n: 2, scale: 0.8 });
  if (v.seats.layout === '4') rows.push({ n: 2, scale: 1 });
  if (v.seats.layout === '5' || v.seats.layout === '7') rows.push({ n: 3, scale: 1 });
  if (v.seats.layout === '7') rows.push({ n: 2, scale: 0.9 });
  const n = rows.length;
  // The rear row sits ahead of the rear axle (bar a third row), and rows close up to fit a short
  // cabin, down to legroom you can sit in (city cars, old coupés).
  const rearmost = Math.max(cabRear + 280, n < 3 ? -L + 120 : -Infinity);
  const room = cabFront - 450 - rearmost;
  const pitch = Math.min(
    v.seats.layout === '2+2' ? 680 : 800,
    n > 1 ? Math.max(MIN_PITCH, room / (n - 1)) : Infinity,
  );
  const frontX = clampN(b.roofFrontXMm - 480, rearmost + (n - 1) * pitch, cabFront - 450);
  const floor = cabinFloor(s);

  // people keep clear of the driveline and the fuel tank (a flat tank under a seat lifts the seat
  // onto it); the battery is the floor they sit on
  const hard = hardware(layout).filter((h) => h.p.kind !== 'battery');
  const tank = hard.find((h) => h.p.kind === 'fuel-tank');
  const arch = s.c.wheels.find((w) => w.axle === 'rear')!;

  /** recline (and, in the back, size) that keeps the head under the roof */
  const fit = (x: number, y: number, z: number, ks: number[], maxDeg: number) => {
    for (const scale of ks) {
      const reach = SEATED_MM * scale;
      for (let a = 12; a <= maxDeg; a += 2) {
        const recline = a * DEG;
        const hx = x - Math.sin(recline) * reach * 0.8;
        if (y + Math.cos(recline) * reach <= s.topY(hx, z * 0.9) - 45) return { recline, scale };
      }
    }
    return null;
  };

  const place = (fx: number, rx: number) => {
    const p = n > 1 ? (fx - rx) / (n - 1) : 0;
    const seats: Seat[] = [];
    let hit = 0;
    let comfort = 0;
    rows.forEach((r, row) => {
      const x = fx - row * p;
      const K = 1000 * r.scale;
      const floorY = floor + 90 + (row > 0 ? 40 : 0);
      let y = floorY + HIP[b.style] * (row > 0 && r.scale < 1 ? 0.85 : 1);
      const tankX = tank ? (tank.lo[0] + tank.hi[0]) / 2 : NaN;
      if (
        tank &&
        tank.hi[1] < y - 0.115 * K + 200 &&
        tankX > x - 0.1 * K - ROOM &&
        tankX < x + 0.36 * K + ROOM
      )
        y = Math.max(y, tank.hi[1] + 0.115 * K + ROOM);
      // the outer rear seats stay inboard of the rear wheel houses
      const byArch =
        row > 0 && x - 0.3 * K < arch.x + arch.archR && x + 0.6 * K > arch.x - arch.archR;
      const zs = r.n === 3 ? [-0.255 * W, 0, 0.255 * W] : [-0.215 * W, 0.215 * W];
      for (const z0 of zs) {
        const z =
          byArch && Math.abs(z0) > 1
            ? Math.sign(z0) * Math.min(Math.abs(z0), arch.zInner - 0.22 * K - 15)
            : z0;
        // under a steep rear roof (old coupés, city cars) a rear passenger is a small one, as in
        // a 2+2; past a comfortable recline the cabin would rather move forward
        const ks = (row > 0 ? [1, 0.9, 0.8, 0.7] : [1]).map((k) => k * r.scale);
        const f = fit(x, y, z, ks, COMFY_RECLINE) ?? fit(x, y, z, ks.slice(-1), 42);
        const q: Seat = {
          x,
          y,
          z,
          row,
          recline: f?.recline ?? 42 * DEG,
          scale: f?.scale ?? ks[ks.length - 1],
          driver: row === 0 && z < 0,
          floorY,
        };
        hit = Math.max(hit, intrusion(q, hard));
        if (!f) comfort += 1000;
        comfort += Math.max(0, q.recline / DEG - COMFY_RECLINE) * 5;
        // in a two-row car the rear heads stay ahead of the rear axle
        if (row === 1 && n === 2)
          comfort += Math.max(0, -L - (x - Math.sin(q.recline) * SEATED_MM * q.scale * 0.8));
        seats.push(q);
      }
    });
    return { seats, hit, comfort };
  };

  // Rows slide forward from where the glasshouse puts them, the rear one first (closing the
  // legroom down to MIN_PITCH), until nobody sits in the hardware; then on a little if that buys
  // the rear passengers a comfortable seat ahead of the axle.
  const frontMax = Math.max(frontX, Math.min(cabFront - 250, -v.tires.diameterMm / 2 - 660));
  const at = (d: number) => {
    const rx = frontX - (n - 1) * pitch + d;
    const fx = n > 1 ? Math.max(frontX, rx + (n - 1) * MIN_PITCH) : rx;
    return fx > frontMax + 1e-6 ? null : place(fx, rx);
  };
  let best = at(0)!;
  let clearAt = best.hit < 1 ? 0 : -1;
  for (let d = 20; clearAt < 0; d += 20) {
    const c = at(d);
    if (!c) break;
    if (c.hit < best.hit - 1) best = c;
    if (c.hit < 1) {
      best = c;
      clearAt = d;
    }
  }
  if (clearAt >= 0)
    for (let d = clearAt + 20; best.comfort > 0 && d <= clearAt + COMFORT_TRAVEL; d += 20) {
      const c = at(d);
      if (!c) break;
      if (c.hit < 1 && c.comfort < best.comfort - 1) best = c;
    }
  return best.seats;
}

// ───────────────────────────── cooling ─────────────────────────────

export interface Radiator {
  center: Vec3;
  /** [thickness X, height Y, width Z] */
  size: Vec3;
  /** yaw (rad): side radiators angle toward the wheels */
  yaw: number;
}

/** coolant pipe radius as drawn (Chassis) */
const COOLANT_R = 16;
/** exhaust pipe radius as drawn (Chassis) */
const EXHAUST_R = 27;
/** where pipes run along the car: inside the fuel tank's channel, clear of feet and wheels */
const LANE = FUEL_TANK.tunnelHalfMm - EXHAUST_R - 23;

/** Point on the engine (or front drive unit) the coolant runs to. */
function coolantTarget(layout: PowertrainLayout): Vec3 | null {
  const e =
    layout.parts.find((p) => p.kind === 'engine') ?? layout.parts.find((p) => p.kind === 'motor');
  if (!e) return null;
  const c = Math.cos(e.yawDeg * DEG);
  const sn = Math.sin(e.yawDeg * DEG);
  const off = e.boxOffsetMm ?? [0, 0, 0];
  const cx = e.posMm[0] + c * off[0] + sn * off[2];
  const halfAlong = (Math.abs(c) * e.sizeMm[0]) / 2 + (Math.abs(sn) * e.sizeMm[2]) / 2;
  return [cx + halfAlong, e.posMm[1] + off[1], 0];
}

export function coolingPlan(
  v: VehicleSpec,
  s: BodyShapeApi,
  layout: PowertrainLayout,
): { radiators: Radiator[]; pipes: Vec3[][] } {
  const { xF, W, clear } = s.c;
  const pt = v.powertrain;
  const target = coolantTarget(layout);
  const front =
    pt.kind === 'ice' && (pt.position === 'front-overhang' || pt.position === 'front-mid');
  const xRad = xF - 190;
  const faceTop = s.top(xRad) - 50;
  const radiators: Radiator[] = [];
  const pipes: Vec3[][] = [];
  // long runs go under the floor down the middle, through the fuel tank's channel
  const tunnelY = clear + 60;
  if (front || pt.kind === 'ev' || v.body.style === 'city') {
    const h = clampN(0.55 * (faceTop - clear), 220, 520);
    const yc = clear + 70 + h / 2;
    radiators.push({
      center: [xRad, yc, 0],
      size: [45, h, (pt.kind === 'ev' ? 0.36 : 0.42) * W],
      yaw: 0,
    });
    if (target) {
      if (front) {
        pipes.push([
          [xRad - 30, yc + h * 0.35, 120],
          [target[0] + 40, target[1] + 60, 120],
        ]);
        pipes.push([
          [xRad - 30, yc - h * 0.35, -120],
          [target[0] + 40, target[1] - 80, -120],
        ]);
      } else {
        // radiator up front, engine/battery far back: long pipes under the floor
        for (const z of [-70, 70]) {
          pipes.push([
            [xRad - 30, yc - h * 0.3, z],
            [xRad - 160, tunnelY, z],
            [target[0] + 120, tunnelY, z],
            [target[0] + 20, target[1], z],
          ]);
        }
      }
    }
  } else {
    // mid/rear engines: twin radiators in the nose corners, the pipes turning in ahead of the
    // front wheels (and their steering sweep) and running back down the middle
    const h = clampN(0.45 * (faceTop - clear), 200, 380);
    const yc = clear + 70 + h / 2;
    const ahead = Math.max(xF - 600, v.tires.diameterMm / 2 + 90);
    for (const side of [-1, 1]) {
      const z = side * 0.27 * W;
      radiators.push({ center: [xF - 400, yc, z], size: [45, h, 0.19 * W], yaw: side * 0.35 });
      if (target) {
        const lane = side * (LANE - 2 * COOLANT_R);
        pipes.push([
          [xF - 440, yc - h * 0.3, z * 0.9],
          [ahead, tunnelY + 10, lane * 1.6],
          [ahead - 120, tunnelY, lane],
          [target[0] + 250, tunnelY, lane],
          [target[0] + 30, target[1], side * 120],
        ]);
      }
    }
  }
  return { radiators, pipes };
}

// ───────────────────────────── exhaust ─────────────────────────────

export interface ExhaustPlan {
  /** one or two runs (split at the rear silencer), as waypoints */
  runs: Vec3[][];
  /** catalyst / silencer boxes [center, size] */
  boxes: { center: Vec3; size: Vec3 }[];
}

export function exhaustPlan(
  v: VehicleSpec,
  s: BodyShapeApi,
  layout: PowertrainLayout,
  tipsMm: Vec3[],
): ExhaustPlan | null {
  const pt = v.powertrain;
  if (pt.kind !== 'ice') return null;
  const e = layout.parts.find((p) => p.kind === 'engine')!;
  const env = envelope(getEngine(pt.engine));
  const { xR, clear } = s.c;
  const L = v.dims.wheelbaseMm;
  const y = clear + 55;
  const hard = hardware(layout);
  // boxes keep clear of the driveline and tank (the engine is where the exhaust starts)
  const others = hard.filter((h) => h.p.kind !== 'engine');
  // tail pipes leave behind the rear axle (a tip found anywhere else is a miss of the body's tail)
  const found = tipsMm.filter((t) => t[0] < -L);
  const tips = found.length ? found : [[xR + 30, clear + 110, -0.3 * v.dims.widthMm] as Vec3];
  // the silencer sits across the tail, behind everything it would otherwise run into
  const mufSize: Vec3 = [260, 200, Math.min(0.62 * v.dims.widthMm, 1000)];
  const mufY = clear + 120;
  const behind = blockedX(
    hard,
    [mufY - mufSize[1] / 2, mufY + mufSize[1] / 2],
    [-mufSize[2] / 2, mufSize[2] / 2],
    25,
  );
  const mufX = Math.max(
    xR + 20 + mufSize[0] / 2,
    Math.min(xR + 330, ...behind.map(([a]) => a - mufSize[0] / 2)),
  );
  const muffler: Vec3 = [mufX, mufY, 0];
  const runs: Vec3[][] = [];
  const boxes: ExhaustPlan['boxes'] = [{ center: muffler, size: mufSize }];
  /** a box slid along the car (from `want`) to clear the driveline and tank */
  const slide = (want: number, by: number, z: number, size: Vec3): Vec3 => [
    nearestFree(
      want,
      size[0],
      blockedX(
        others,
        [by - size[1] / 2, by + size[1] / 2],
        [z - size[2] / 2, z + size[2] / 2],
        25,
      ),
    ),
    by,
    z,
  ];
  const ex = e.posMm[0];
  const rearEngine = pt.position === 'mid' || pt.position.startsWith('rear');
  let trunk: Vec3[];
  if (!rearEngine) {
    // down from the manifold, catalyst close behind the engine, a middle silencer under the floor,
    // then along the tunnel (through the tank's channel) to the silencer at the tail
    const start: Vec3 =
      pt.orientation === 'transverse'
        ? [ex - env.widthMm / 2 - 60, pt.crankYMm, e.posMm[2]]
        : [ex - 60, pt.crankYMm, env.max[2] + 40];
    const catSize: Vec3 = [300, 130, 160];
    const midSize: Vec3 = [420, 110, 220];
    const cat = slide(start[0] - 380, y + 40, LANE, catSize);
    // the middle silencer hangs under the cabin floor, below the seats
    const mid = slide(-0.55 * L, Math.min(y + 30, cabinFloor(s) + 75), LANE + 10, midSize);
    boxes.push({ center: cat, size: catSize }, { center: mid, size: midSize });
    const along: Vec3[] = [cat, mid, [muffler[0] + 400, y + 60, LANE]];
    const tank = layout.parts.find((p) => p.kind === 'fuel-tank');
    if (tank) {
      const [lo, hi] = partBounds(tank);
      const ty = Math.min(y + 30, lo[1] + FUEL_TANK.tunnelHMm - EXHAUST_R - 15);
      if (hi[0] < mid[0] && lo[0] > muffler[0] + 100)
        along.push([hi[0] + 40, ty, LANE], [lo[0] - 40, ty, LANE]);
    }
    along.sort((a, b) => b[0] - a[0]);
    trunk = [start, [start[0] - 80, y + 120, LANE], ...along];
  } else {
    // short run: manifolds under the engine straight into a transverse silencer behind it
    const start: Vec3 = [ex, pt.crankYMm - env.heightMm * 0.3, 0];
    trunk = [start, [Math.max(muffler[0] + 200, ex - 300), y + 80, 0]];
  }
  runs.push([...trunk, [muffler[0] + 60, muffler[1], 0]]);
  for (const t of tips) {
    runs.push([
      [muffler[0], muffler[1], t[2] * 0.6],
      [t[0] + 140, t[1], t[2]],
      [t[0], t[1], t[2]],
    ]);
  }
  return { runs, boxes };
}

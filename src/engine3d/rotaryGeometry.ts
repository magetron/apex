/**
 * Wankel rotary → three.js geometry. Everything comes from the spec through spec/derive/rotary
 * (trochoid, inner-envelope rotor flank, housing exterior, dims), so the picture, envelope() and
 * the chamber volumes agree. Built in millimetres, merged per part and material, scaled to
 * metres. Static castings are baked in the engine frame; rotor housings, rotors and the e-shaft
 * in their own frames (the model places, turns and explodes them).
 *
 * Housing stack along X, front (+X) to rear: plate 0 (front housing), rotor housing 1, plate 1
 * (intermediate), rotor housing 2, …, plate n (rear housing).
 */
import { Box3, BufferGeometry, CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  housingOutline,
  rotaryDef,
  rotaryDims,
  rotorFlank,
  rotorOutline,
  trochoid,
  type RotaryDims,
} from '../spec/derive/rotary';
import type { EngineSpec, RotaryDef } from '../spec/types';
import { DEG } from '../spec/units';
import type { Lod } from './geometry';
import { MM, circle, cylX, extrudeYZ, gear, mergeM, type YZ } from './prims';

/** Phasing gears: rotor internal gear 3k teeth on 3e, fixed gear 2k teeth on 2e (13B: 51/34). */
const GEAR_K = 17;
const GEAR_DEPTH = 2.6;
/** axial room at each rotor face for the phasing gears; the lobe fills the rest (mm) */
const GEAR_BAND = 14;
/** Flank samples per face for the rotor and the chamber gas. */
export const FLANK_SEGS = 24;

export interface RotaryPlate {
  index: number;
  /** front and back face (mm, engine X) */
  x0: number;
  x1: number;
  /** explode direction along X: +1 front plate, −1 rear plate, 0 intermediate (stays) */
  dir: -1 | 0 | 1;
  casting: BufferGeometry;
  /** side-port openings on its faces (intake / exhaust colours) */
  intake: BufferGeometry | null;
  exhaust: BufferGeometry | null;
  /** the fixed phasing gear(s) of the rotor(s) it carries */
  gear: BufferGeometry | null;
}

export interface RotaryGeometry {
  dims: RotaryDims;
  /** rotor centres along X (mm) */
  rotorX: number[];
  /** which face of each rotor carries its internal gear (+1 front, −1 rear) */
  gearSide: (-1 | 1)[];
  /** one rotor housing in its own frame (x = 0 at its centre) */
  rotorHousing: BufferGeometry;
  /** spark plugs of one rotor housing, same frame */
  plugs: BufferGeometry;
  /** peripheral port patches on one rotor housing (null for side ports only) */
  housingIntake: BufferGeometry | null;
  housingExhaust: BufferGeometry | null;
  plates: RotaryPlate[];
  /** rotor in its own frame: centre at the origin, apex 0 toward +Y */
  rotor: { front: BufferGeometry; rear: BufferGeometry };
  seals: BufferGeometry;
  /** internal gear ring on the rotor's front (+X) or rear (−X) face */
  rotorGear: { front: BufferGeometry; rear: BufferGeometry };
  /** e-shaft in its turning frame (lobes at their throwDeg) and its counterweights */
  eshaft: BufferGeometry;
  counterweights: BufferGeometry;
  frontCover: BufferGeometry;
  pulley: BufferGeometry;
  flywheel: BufferGeometry;
  sump: BufferGeometry;
  intake: BufferGeometry;
  exhaust: BufferGeometry;
  /** one flank (apex 0 → apex 1), rotor frame, FLANK_SEGS + 1 points: the chamber's inner wall */
  flank: YZ[];
}

const segs = (lod: Lod, high: number) => (lod === 'high' ? high : Math.max(8, high >> 1));

/** Annular sector in the YZ plane (angles from +Y toward +Z, degrees). */
function sector(a0: number, a1: number, r0: number, r1: number, n = 10): YZ[] {
  const pts: YZ[] = [];
  for (let k = 0; k <= n; k++) {
    const a = (a0 + ((a1 - a0) * k) / n) * DEG;
    pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]);
  }
  for (let k = n; k >= 0; k--) {
    const a = (a0 + ((a1 - a0) * k) / n) * DEG;
    pts.push([r0 * Math.cos(a), r0 * Math.sin(a)]);
  }
  return pts;
}

/** Where the side ports open (fixed frame, port-side half): intake above the waist, exhaust below. */
export const SIDE_PORT = {
  intake: { a0: 34, a1: 74, mid: 54 },
  exhaust: { a0: 106, a1: 146, mid: 126 },
  r0: 60,
  r1: 90,
};

const hasSide = (r: RotaryDef, kind: 'intake' | 'exhaust') =>
  r.ports.some((p) => p.kind === kind && p.location === 'side');
const hasPeripheral = (r: RotaryDef, kind: 'intake' | 'exhaust') =>
  r.ports.some((p) => p.kind === kind && p.location === 'peripheral');

/** The trochoid surface (housing bore), pushed out a hair so apex seals don't z-fight it. */
function trochoidLoop(r: RotaryDef, n: number, grow = 0.4): YZ[] {
  return Array.from({ length: n }, (_, k) => {
    const [y, z] = trochoid(r, (2 * Math.PI * k) / n);
    const s = 1 + grow / Math.hypot(y, z);
    return [y * s, z * s] as YZ;
  });
}

function tube(points: Vector3[], radius: number, lod: Lod): BufferGeometry {
  return new TubeGeometry(
    new CatmullRomCurve3(points),
    segs(lod, 32),
    radius,
    segs(lod, 12),
    false,
  );
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const polar = (deg: number, rad: number): YZ => [
  rad * Math.cos(deg * DEG),
  rad * Math.sin(deg * DEG),
];

export function buildRotaryGeometry(spec: EngineSpec, lod: Lod = 'high'): RotaryGeometry {
  const r = rotaryDef(spec);
  const d = rotaryDims(spec);
  const n = spec.cylinders.length;
  const B = d.width;
  const S = d.side;
  const outline = housingOutline(spec, segs(lod, 72));
  const bore = trochoidLoop(r, segs(lod, 160));
  const rotorX = spec.cylinders.map((c) => c.axialMm);
  const gearSide = rotorX.map((x) => (x >= 0 ? 1 : -1) as -1 | 1);
  const e = d.e;

  // ── rotor housing (one, local frame) with its spark plugs on the −Z waist ──
  const rotorHousing = mergeM([extrudeYZ(outline, -B / 2, B / 2, { holes: [bore] })]);
  const plugParts: BufferGeometry[] = [];
  const waist = d.R - e;
  for (let p = 0; p < r.sparkPlugsPerRotor; p++) {
    // leading plug below the waist (ahead in rotation), trailing above
    const off = (p - (r.sparkPlugsPerRotor - 1) / 2) * -22;
    const zIn = -waist - 2;
    const zOut = -d.halfWidthMm - 4;
    plugParts.push(cylY2(7, off, zIn, zOut, segs(lod, 14)));
    plugParts.push(cylY2(5.5, off, zOut, zOut - 26, segs(lod, 14)));
    if (lod === 'high') plugParts.push(cylY2(9.5, off, zOut - 26, zOut - 44, segs(lod, 14)));
  }
  const plugs = mergeM(plugParts);
  const peripheral = (kind: 'intake' | 'exhaust', a0: number, a1: number) => {
    if (!hasPeripheral(r, kind)) return null;
    const pts: YZ[] = [];
    for (let k = 0; k <= 10; k++) pts.push(trochoid(r, (a0 + ((a1 - a0) * k) / 10) * DEG));
    const inner = pts.map(([y, z]) => [y * 0.985, z * 0.985] as YZ).reverse();
    return mergeM([extrudeYZ([...pts, ...inner], -B * 0.32, B * 0.32)]);
  };
  const housingIntake = peripheral('intake', 40, 70);
  const housingExhaust = peripheral('exhaust', 112, 140);

  // ── side plates: castings, side ports, fixed phasing gears ──
  const pitch = B + S;
  const front = Math.max(...rotorX) + B / 2 + S;
  const plates: RotaryPlate[] = [];
  const shaftHole = circle(0, 0, d.journalMm + 6, segs(lod, 28));
  for (let j = 0; j <= n; j++) {
    const x1 = front - j * pitch;
    const x0 = x1 - S;
    const intake: BufferGeometry[] = [];
    const exhaust: BufferGeometry[] = [];
    const gears: BufferGeometry[] = [];
    // faces toward rotor j (back face, x0) and rotor j−1 (front face, x1)
    const faces: { x: number; out: number; rotor: number }[] = [];
    if (j < n) faces.push({ x: x0, out: -1, rotor: j });
    if (j > 0) faces.push({ x: x1, out: 1, rotor: j - 1 });
    for (const f of faces) {
      const a = f.x;
      const b = f.x + f.out * 0.8;
      for (const kind of ['intake', 'exhaust'] as const) {
        if (!hasSide(r, kind)) continue;
        const s = SIDE_PORT[kind];
        (kind === 'intake' ? intake : exhaust).push(
          extrudeYZ(sector(s.a0, s.a1, SIDE_PORT.r0, SIDE_PORT.r1), Math.min(a, b), Math.max(a, b)),
        );
      }
      // the fixed gear sits on the plate on the rotor's outer side
      const carries = gearSide[f.rotor] === (f.out < 0 ? 1 : -1);
      if (carries) {
        const teeth = 2 * GEAR_K;
        const out = gear(2 * e + GEAR_DEPTH / 2, teeth, GEAR_DEPTH, Math.PI, 0, 0);
        const hole = circle(0, 0, d.journalMm + 3, segs(lod, 24));
        const g0 = f.x + f.out * (GEAR_BAND - 2);
        gears.push(extrudeYZ(out, Math.min(f.x, g0), Math.max(f.x, g0), { holes: [hole] }));
      }
    }
    plates.push({
      index: j,
      x0,
      x1,
      dir: j === 0 ? 1 : j === n ? -1 : 0,
      casting: mergeM([extrudeYZ(outline, x0, x1, { holes: [shaftHole] })]),
      intake: intake.length ? mergeM(intake) : null,
      exhaust: exhaust.length ? mergeM(exhaust) : null,
      gear: gears.length ? mergeM(gears) : null,
    });
  }

  // ── rotor (local frame), apex seals, internal gear ──
  const flankN = lod === 'high' ? 40 : 24;
  const body = rotorOutline(r, flankN);
  const rotorBore = circle(0, 0, d.lobeMm + 2, segs(lod, 32));
  // on its gear side the rotor is counterbored for the internal gear ring, which leaves room
  // for the fixed gear to roll round inside it
  const ringR = 3 * e + 9;
  const counterbore = circle(0, 0, ringR, segs(lod, 48));
  const rotorFor = (side: 1 | -1) => {
    const face = B / 2 - 0.6;
    const step = B / 2 - GEAR_BAND;
    return mergeM([
      extrudeYZ(body, Math.min(-side * face, side * step), Math.max(-side * face, side * step), {
        holes: [rotorBore],
      }),
      extrudeYZ(body, Math.min(side * step, side * face), Math.max(side * step, side * face), {
        holes: [counterbore],
      }),
    ]);
  };
  const rotor = { front: rotorFor(1), rear: rotorFor(-1) };
  const sealParts: BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 120;
    const tip = polar(a, d.R - 0.2);
    const across = polar(a + 90, 1.4);
    sealParts.push(
      extrudeYZ(
        [
          [tip[0] + across[0], tip[1] + across[1]],
          [tip[0] - across[0], tip[1] - across[1]],
          [tip[0] * 0.93 - across[0], tip[1] * 0.93 - across[1]],
          [tip[0] * 0.93 + across[0], tip[1] * 0.93 + across[1]],
        ],
        -B / 2 + 0.3,
        B / 2 - 0.3,
      ),
    );
  }
  const seals = mergeM(sealParts);
  // internal gear ring: 3k teeth on 3e (low detail: a plain ring at the tooth tips)
  const teeth =
    lod === 'high'
      ? gear(3 * e + GEAR_DEPTH / 2, 3 * GEAR_K, GEAR_DEPTH, Math.PI, 0, 0)
      : circle(0, 0, 3 * e - GEAR_DEPTH / 2, 48);
  const ringAt = (side: 1 | -1) => {
    const a = side * (B / 2 - GEAR_BAND);
    const b = side * (B / 2 - 0.7);
    return mergeM([
      extrudeYZ(circle(0, 0, ringR - 0.2, segs(lod, 48)), Math.min(a, b), Math.max(a, b), {
        holes: [teeth],
      }),
    ]);
  };
  const rotorGear = { front: ringAt(1), rear: ringAt(-1) };

  // ── e-shaft (turning frame), counterweights, pulley, flywheel ──
  const sx0 = d.stackMinMm - d.rearMm + 4;
  const sx1 = d.stackMaxMm + d.frontMm - 4;
  const shaftParts = [cylX(d.journalMm, sx0, sx1, segs(lod, 24))];
  // lobes leave room either side for the fixed gear and the rotor's internal gear
  const lobeHalf = B / 2 - GEAR_BAND;
  spec.cylinders.forEach((c) => {
    const [y, z] = polar(c.throwDeg, e);
    shaftParts.push(
      cylX(d.lobeMm, c.axialMm - lobeHalf, c.axialMm + lobeHalf, segs(lod, 36), y, z),
    );
  });
  const eshaft = mergeM(shaftParts);
  // each end's counterweight sits opposite the nearer rotor's lobe: together they cancel the
  // rotating couple the two rotors make (balance() reports it before counterweights)
  const cwParts: BufferGeometry[] = [];
  const first = spec.cylinders[rotorX.indexOf(Math.max(...rotorX))];
  const last = spec.cylinders[rotorX.indexOf(Math.min(...rotorX))];
  const halfDisc = (deg: number, rad: number): YZ[] => {
    const pts: YZ[] = [];
    for (let k = 0; k <= 16; k++) pts.push(polar(deg - 80 + (160 * k) / 16, rad));
    pts.push(polar(deg + 100, d.journalMm + 6), polar(deg - 100, d.journalMm + 6));
    return pts;
  };
  cwParts.push(
    extrudeYZ(halfDisc(first.throwDeg + 180, 0.62 * d.R), d.stackMaxMm + 3, d.stackMaxMm + 15),
  );
  const frontCover = mergeM([
    extrudeYZ(
      outline.map(([y, z]) => [y * 0.82, z * 0.82] as YZ),
      d.stackMaxMm,
      d.stackMaxMm + 26,
      { bevel: 4 },
    ),
  ]);
  const pulley = mergeM([
    cylX(0.5 * d.R, d.stackMaxMm + 27, d.stackMaxMm + d.frontMm - 2, segs(lod, 36)),
    cylX(0.56 * d.R, d.stackMaxMm + 30, d.stackMaxMm + 34, segs(lod, 36)),
  ]);
  const flyR = Math.min(0.92 * d.halfHeightMm, 1.45 * d.R);
  const fx0 = d.stackMinMm - d.rearMm;
  const fx1 = d.stackMinMm - 3;
  const flyParts = [cylX(flyR, fx0, fx1, segs(lod, 48))];
  if (lod === 'high')
    flyParts.push(extrudeYZ(gear(flyR + 2, 96, 3), fx0, fx0 + (fx1 - fx0) * 0.55));
  // the rear counterweight is a lump on the flywheel, opposite the rear rotor's lobe
  flyParts.push(extrudeYZ(halfDisc(last.throwDeg + 180, 0.8 * flyR), fx1 - 0.5, fx1 + 2));
  const counterweights = mergeM(cwParts);
  const flywheel = mergeM(flyParts);

  // ── oil pan ──
  const pan = new RoundedBoxGeometry(
    d.stackMaxMm - d.stackMinMm - 10,
    d.sumpDepthMm + 30,
    2 * d.halfWidthMm - 60,
    3,
    12,
  );
  pan.translate((d.stackMaxMm + d.stackMinMm) / 2, -d.halfHeightMm - d.sumpDepthMm / 2 + 15, 0);
  const sump = mergeM([pan]);

  // ── intake: plenum above the port side, a runner to every side intake port ──
  const intakeParts: BufferGeometry[] = [];
  const len = d.stackMaxMm - d.stackMinMm;
  const plenumY = d.halfHeightMm + 70;
  const plenumZ = 0.25 * d.halfWidthMm;
  const plenum = new RoundedBoxGeometry(len + 40, 80, 150, 3, 24);
  plenum.translate((d.stackMaxMm + d.stackMinMm) / 2 - 10, plenumY, plenumZ);
  intakeParts.push(plenum);
  intakeParts.push(cylX(34, d.stackMaxMm + 10, d.stackMaxMm + 70, segs(lod, 24), plenumY, plenumZ));
  const runnerR = 0.2 * B;
  const portMid = (kind: 'intake' | 'exhaust') =>
    polar(SIDE_PORT[kind].mid, (SIDE_PORT.r0 + SIDE_PORT.r1) / 2);
  const portFaces: number[] = [];
  for (const p of plates) {
    if (p.index < n) portFaces.push(p.x0 + 12);
    if (p.index > 0) portFaces.push(p.x1 - 12);
  }
  if (hasSide(r, 'intake')) {
    const [py, pz] = portMid('intake');
    for (const x of portFaces) {
      intakeParts.push(
        tube(
          [
            v(x, py, pz),
            v(x, py + 35, pz + 30),
            v(x, d.halfHeightMm + 10, pz + 25),
            v(x, plenumY - 30, plenumZ + 10),
          ],
          runnerR,
          lod,
        ),
      );
    }
  }
  if (hasPeripheral(r, 'intake')) {
    rotorX.forEach((x) => {
      const [y, z] = trochoid(r, 55 * DEG);
      intakeParts.push(
        tube([v(x, y, z), v(x, y + 60, z + 50), v(x, plenumY - 30, plenumZ)], runnerR, lod),
      );
    });
  }
  const intake = mergeM(intakeParts);

  // ── exhaust: from every exhaust port down under the port side, into one pipe heading back ──
  const exParts: BufferGeometry[] = [];
  const pipeR = 0.22 * B;
  const lowY = -d.halfHeightMm - 0.55 * d.sumpDepthMm;
  const collector = v(d.stackMinMm - 70, lowY - 10, 0.55 * d.halfWidthMm);
  const starts: Vector3[] = [];
  if (hasSide(r, 'exhaust')) {
    const [py, pz] = portMid('exhaust');
    for (const x of portFaces) starts.push(v(x, py, pz));
  }
  if (hasPeripheral(r, 'exhaust')) {
    for (const x of rotorX) {
      const [y, z] = trochoid(r, 126 * DEG);
      starts.push(v(x, y, z));
    }
  }
  for (const s of starts) {
    const out = v(s.x, Math.max(lowY + 40, s.y - 40), d.halfWidthMm + 0.4 * pipeR);
    exParts.push(
      tube(
        [s, v(s.x, s.y - 25, s.z + 25), out, v(s.x - 30, lowY + 5, d.halfWidthMm * 0.8), collector],
        pipeR,
        lod,
      ),
    );
  }
  exParts.push(
    tube(
      [
        collector,
        v(collector.x - 90, lowY - 5, collector.z * 0.7),
        v(collector.x - 220, lowY, 0.3 * collector.z),
      ],
      pipeR * 1.4,
      lod,
    ),
  );
  const exhaust = mergeM(exParts);

  return {
    dims: d,
    rotorX,
    gearSide,
    rotorHousing,
    plugs,
    housingIntake,
    housingExhaust,
    plates,
    rotor,
    seals,
    rotorGear,
    eshaft,
    counterweights,
    frontCover,
    pulley,
    flywheel,
    sump,
    intake,
    exhaust,
    flank: rotorFlank(r, FLANK_SEGS),
  };
}

/** A cylinder along Z (spark plugs) at height y, from z0 to z1. */
function cylY2(rad: number, y: number, z0: number, z1: number, n: number): BufferGeometry {
  const g = cylX(rad, z0, z1, n);
  // cylX runs along X: turn it onto Z (x → z), keeping it at height y
  g.rotateY(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

export function disposeRotaryGeometry(g: RotaryGeometry) {
  const all: (BufferGeometry | null)[] = [
    g.rotorHousing,
    g.plugs,
    g.housingIntake,
    g.housingExhaust,
    g.rotor.front,
    g.rotor.rear,
    g.seals,
    g.rotorGear.front,
    g.rotorGear.rear,
    g.eshaft,
    g.counterweights,
    g.frontCover,
    g.pulley,
    g.flywheel,
    g.sump,
    g.intake,
    g.exhaust,
    ...g.plates.flatMap((p) => [p.casting, p.intake, p.exhaust, p.gear]),
  ];
  for (const x of all) x?.dispose();
}

/**
 * Bounds (mm) of what envelope() describes — housings, front cover and pulley, oil pan,
 * flywheel — with the housings at their rotors' places.
 */
export function rotaryCoreBoundsMm(g: RotaryGeometry): Box3 {
  const box = new Box3();
  const add = (geo: BufferGeometry, dx = 0) => {
    geo.computeBoundingBox();
    const b = geo.boundingBox!.clone();
    b.min.x += dx * MM;
    b.max.x += dx * MM;
    box.union(b);
  };
  for (const x of g.rotorX) add(g.rotorHousing, x);
  for (const p of g.plates) add(p.casting);
  [g.frontCover, g.pulley, g.flywheel, g.sump].forEach((x) => add(x));
  return new Box3(box.min.multiplyScalar(1 / MM), box.max.multiplyScalar(1 / MM));
}

/** Every drawn static piece in the engine frame at rest (clearance checks), rotor housings placed. */
export function rotaryDrawnBoxesMm(g: RotaryGeometry): Box3[] {
  const boxes: Box3[] = [];
  const add = (geo: BufferGeometry | null, dx = 0) => {
    if (!geo) return;
    geo.computeBoundingBox();
    const b = geo.boundingBox!.clone();
    boxes.push(
      new Box3(
        new Vector3(b.min.x / MM + dx, b.min.y / MM, b.min.z / MM),
        new Vector3(b.max.x / MM + dx, b.max.y / MM, b.max.z / MM),
      ),
    );
  };
  for (const x of g.rotorX) {
    add(g.rotorHousing, x);
    add(g.plugs, x);
  }
  for (const p of g.plates) add(p.casting);
  [g.frontCover, g.pulley, g.flywheel, g.sump, g.intake, g.exhaust].forEach((x) => add(x));
  return boxes;
}

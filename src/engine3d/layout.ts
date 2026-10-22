/**
 * Where every component of the procedural engine sits, derived from the spec and engineDims()
 * so the 3D model and envelope() (the fit check) agree. Pure TS, millimetres, engine-local
 * frame — see the crank convention in spec/types.ts. The geometry builder and the per-frame
 * animation both read this; the unit tests check it.
 */
import { engineDims, envelope, type EngineDims } from '../spec/derive/envelope';
import type { EngineEnvelope, EngineSpec, Induction } from '../spec/types';
import { DEG, mod } from '../spec/units';
import { v3len, v3norm, v3sub, yzNorm, type V3, type YZ } from './prims';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Bank/head frame (along the cylinder axis, across it) → engine YZ; matches three's rotateX(tilt). */
export function fromBank(tiltDeg: number, along: number, across: number): YZ {
  const t = tiltDeg * DEG;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [along * c - across * s, along * s + across * c];
}
export const axisOf = (tiltDeg: number): YZ => fromBank(tiltDeg, 1, 0);
export const acrossOf = (tiltDeg: number): YZ => fromBank(tiltDeg, 0, 1);
/** Head-frame point [x, along, across] → engine frame. */
export const headToEngine = (tiltDeg: number, p: V3): V3 => {
  const [y, z] = fromBank(tiltDeg, p[1], p[2]);
  return [p[0], y, z];
};
/** Head-frame direction → engine frame. */
export const headDirToEngine = (tiltDeg: number, d: V3): V3 => headToEngine(tiltDeg, d);

/** Crown-to-deck gap at TDC; mirrors engineDims(), whose deck height includes it. */
export const DECK_CLEARANCE_MM = 5;
/** Half the cam-lobe width in cam degrees: 248 crank degrees of valve opening. */
export const CAM_HALF_DEG = 62;

export const TURBOS: Record<Induction, number> = {
  na: 0,
  turbo: 1,
  'twin-turbo': 2,
  'quad-turbo': 4,
  supercharged: 0,
};

export interface PistonDims {
  /** gudgeon-pin centre → crown (mm) */
  compressionMm: number;
  /** gudgeon-pin centre → skirt bottom (mm) */
  skirtMm: number;
  radiusMm: number;
  gudgeonRadiusMm: number;
}

export interface CylinderLayout {
  index: number;
  num: number;
  bank: number;
  head: number;
  axialMm: number;
  tiltDeg: number;
  axis: YZ;
  /** offset of this bore from its head's centre line at the deck (VR stagger) */
  deckAcrossMm: number;
  headerMm: number;
}

export interface CrankPin {
  pin: number;
  throwDeg: number;
  axialMm: number;
  lengthMm: number;
  cylinders: number[];
}

export interface CrankWeb {
  axialMm: number;
  thicknessMm: number;
  /** one throw: a web next to a main journal; two: a flying web between split pins */
  throws: number[];
  counterweight: boolean;
}

export interface MainJournal {
  axialMm: number;
  lengthMm: number;
}

export interface CrankLayout {
  throwMm: number;
  pinRadiusMm: number;
  journalRadiusMm: number;
  rodWidthMm: number;
  counterweightRadiusMm: number;
  /** sorted rear (−X) to front */
  pins: CrankPin[];
  /** pins with no main bearing between them (split pins, W pairs) */
  clusters: CrankPin[][];
  journals: MainJournal[];
  webs: CrankWeb[];
  rearMm: number;
  frontMm: number;
}

export interface HeadLayout {
  index: number;
  tiltDeg: number;
  banks: number[];
  cylinders: number[];
  label: string;
  halfWidthMm: number;
  /** deck → cam-cover joint */
  castMm: number;
  coverMm: number;
  /** intake on the +across (1) or −across (−1) side of the head frame */
  intakeSide: 1 | -1;
}

export interface CamLayout {
  /** head index, or −1 for a cam in the block (OHV, engine frame) */
  head: number;
  kind: 'intake' | 'exhaust' | 'both';
  /** cam axis: head frame [along, across], or engine [y, z] for a block cam */
  at: YZ;
  x0: number;
  x1: number;
  sprocketX: number;
  baseRadiusMm: number;
  liftMm: number;
  lobes: { axialMm: number; widthMm: number; angleDeg: number }[];
}

export interface ValveLayout {
  cyl: number;
  head: number;
  kind: 'intake' | 'exhaust';
  /** head frame [x, along, across] */
  seat: V3;
  /** unit, head frame, seat → cam/rocker */
  dir: V3;
  lengthMm: number;
  headDiaMm: number;
  /** crank angle of peak lift (0..720) */
  peakDeg: number;
  liftMm: number;
  cam: number;
}

export interface PushrodLayout {
  valve: number;
  head: number;
  /** engine frame, lifter end at rest → rocker end */
  from: V3;
  to: V3;
}

export interface TimingLoop {
  x: number;
  /** [0] is the crank sprocket; cam sprockets are twice its size (½ crank speed) */
  sprockets: { at: YZ; r: number }[];
}

export interface PortLayout {
  cyl: number;
  head: number;
  at: V3;
  dir: YZ;
}

export interface PlenumLayout {
  at: YZ;
  radiusMm: number;
  x0: number;
  x1: number;
  heads: number[];
  outDir: YZ;
}

export interface ExhaustGroupLayout {
  cylinders: number[];
  collector: V3;
  outDir: YZ;
  turbo: number;
}

export interface TurboLayout {
  at: V3;
  radiusMm: number;
  outDir: YZ;
}

export interface EngineLayout {
  spec: EngineSpec;
  dims: EngineDims;
  env: EngineEnvelope;
  piston: PistonDims;
  /** along each cylinder axis, from the crank axis */
  linerBottomMm: number;
  blockX0: number;
  blockX1: number;
  rearX: number;
  frontX: number;
  cylinders: CylinderLayout[];
  crank: CrankLayout;
  heads: HeadLayout[];
  cams: CamLayout[];
  valves: ValveLayout[];
  pushrods: PushrodLayout[];
  timing: { crankSprocketMm: number; loops: TimingLoop[]; coverX0: number; coverX1: number };
  pulley: { x0: number; x1: number; radiusMm: number };
  flywheel: { x0: number; x1: number; radiusMm: number };
  intakePorts: PortLayout[];
  exhaustPorts: PortLayout[];
  plenums: PlenumLayout[];
  runners: { cyl: number; plenum: number }[];
  exhaust: ExhaustGroupLayout[];
  turbos: TurboLayout[];
  crossover: boolean;
  supercharged: boolean;
  hotVee: boolean;
}

export const headerLengthMm = (spec: EngineSpec, cyl: number) => {
  const h = spec.sound.headerMm;
  return Array.isArray(h) ? (h[cyl] ?? h[h.length - 1]) : h;
};

/**
 * Which way an ancillary (plenum, exhaust group, turbo) moves when exploded: straight out, but
 * pipes that hang under the engine go rearward instead, clear of the sump dropping below.
 */
export function ancillaryDir(outDir: YZ): V3 {
  if (outDir[0] < -0.6) return v3norm([-0.8, 0.6 * outDir[0], 0.6 * outDir[1]]);
  return [0, outDir[0], outDir[1]];
}

/**
 * Turbos (and so the exhaust side) inside the vee. There is no spec field for it yet, so: any
 * wide-angle turbo vee, or one whose layout label says so ("turbos in the vee", "hot-vee").
 */
export function isHotVee(spec: EngineSpec, turboCount: number): boolean {
  if (spec.family !== 'v' || turboCount === 0) return false;
  return (
    spec.bankAngleDeg >= 100 || /in the vee|hot[- ]vee/i.test(`${spec.layoutLabel} ${spec.name}`)
  );
}

/** Valve lift 0..1 at a crank angle for a valve whose lift peaks at peakDeg (cam lobe profile). */
export function liftFraction(peakDeg: number, crankDeg: number): number {
  const d = (mod(crankDeg - peakDeg + 360, 720) - 360) / 2;
  if (d <= -CAM_HALF_DEG || d >= CAM_HALF_DEG) return 0;
  const c = Math.cos((Math.PI / 2) * (d / CAM_HALF_DEG));
  return c * c;
}

function crankLayout(
  spec: EngineSpec,
  d: EngineDims,
  piston: PistonDims,
  blockX0: number,
  frontX: number,
): CrankLayout {
  const r = spec.strokeMm / 2;
  const pitch = spec.borePitchMm;
  const bore = spec.boreMm;
  const axials = spec.cylinders.map((c) => c.axialMm);
  let minGap = Infinity;
  for (let i = 0; i < axials.length; i++) {
    for (let j = i + 1; j < axials.length; j++) {
      const g = Math.abs(axials[i] - axials[j]);
      if (g > 1e-6) minGap = Math.min(minGap, g);
    }
  }
  if (!Number.isFinite(minGap)) minGap = pitch;
  const rodW = Math.min(0.2 * pitch, 0.3 * bore, 0.85 * minGap);

  const byPin = new Map<number, number[]>();
  spec.cylinders.forEach((c, i) => byPin.set(c.pin, [...(byPin.get(c.pin) ?? []), i]));
  const pins: CrankPin[] = [...byPin]
    .map(([pin, cyls]) => {
      const ax = cyls.map((i) => spec.cylinders[i].axialMm);
      return {
        pin,
        throwDeg: mod(spec.cylinders[cyls[0]].throwDeg, 360),
        axialMm: mean(ax),
        lengthMm: Math.max(...ax) - Math.min(...ax) + rodW + 1.5,
        cylinders: cyls,
      };
    })
    .sort((a, b) => a.axialMm - b.axialMm);

  const clusters: CrankPin[][] = [];
  for (const p of pins) {
    const last = clusters[clusters.length - 1];
    if (last && p.axialMm - last[last.length - 1].axialMm < 0.4 * pitch) last.push(p);
    else clusters.push([p]);
  }

  const lo = (p: CrankPin) => p.axialMm - p.lengthMm / 2;
  const hi = (p: CrankPin) => p.axialMm + p.lengthMm / 2;
  const webT0 = clamp(0.17 * pitch, 8, 24);
  const jLen0 = clamp(0.3 * pitch, 14, 34);
  const journals: MainJournal[] = [];
  const webs: CrankWeb[] = [];

  const first = clusters[0][0];
  webs.push({
    axialMm: lo(first) - webT0 / 2,
    thicknessMm: webT0,
    throws: [first.throwDeg],
    counterweight: true,
  });
  journals.push({ axialMm: lo(first) - webT0 - jLen0 / 2, lengthMm: jLen0 });

  clusters.forEach((cl, k) => {
    for (let j = 1; j < cl.length; j++) {
      const a = cl[j - 1];
      const b = cl[j];
      const gap = lo(b) - hi(a);
      webs.push({
        axialMm: (hi(a) + lo(b)) / 2,
        thicknessMm: Math.max(3, gap),
        throws: [a.throwDeg, b.throwDeg],
        counterweight: false,
      });
    }
    const next = clusters[k + 1];
    if (!next) return;
    const a = cl[cl.length - 1];
    const b = next[0];
    const g = lo(b) - hi(a);
    const t = Math.min(webT0, Math.max(3, (g - 8) / 2));
    const jl = Math.max(4, g - 2 * t);
    webs.push({
      axialMm: hi(a) + t / 2,
      thicknessMm: t,
      throws: [a.throwDeg],
      counterweight: true,
    });
    journals.push({ axialMm: hi(a) + t + jl / 2, lengthMm: jl });
    webs.push({
      axialMm: lo(b) - t / 2,
      thicknessMm: t,
      throws: [b.throwDeg],
      counterweight: true,
    });
  });

  const lastCl = clusters[clusters.length - 1];
  const last = lastCl[lastCl.length - 1];
  webs.push({
    axialMm: hi(last) + webT0 / 2,
    thicknessMm: webT0,
    throws: [last.throwDeg],
    counterweight: true,
  });
  journals.push({ axialMm: hi(last) + webT0 + jLen0 / 2, lengthMm: jLen0 });

  const jR = 0.3 * bore;
  const skirtBottomBdc = spec.rodMm - r - piston.skirtMm;
  const cw = Math.max(jR + 8, Math.min(1.5 * r + 6, skirtBottomBdc - 6, d.crankcaseRadiusMm - 8));
  return {
    throwMm: r,
    pinRadiusMm: 0.26 * bore,
    journalRadiusMm: jR,
    rodWidthMm: rodW,
    counterweightRadiusMm: cw,
    pins,
    clusters,
    journals,
    webs,
    rearMm: blockX0 - 2,
    frontMm: frontX,
  };
}

/** Lay out the whole engine. Cheap (no geometry); memoise per spec. */
export function engineLayout(spec: EngineSpec): EngineLayout {
  const d = engineDims(spec);
  const env = envelope(spec);
  const r = spec.strokeMm / 2;
  const bore = spec.boreMm;
  const vt = spec.valvetrain;
  const ohv = vt.type === 'ohv';

  const compressionMm = d.deckMm - DECK_CLEARANCE_MM - r - spec.rodMm;
  const piston: PistonDims = {
    compressionMm,
    skirtMm: 0.3 * bore,
    radiusMm: bore / 2 - 0.6,
    gudgeonRadiusMm: 0.115 * bore,
  };
  const linerBottomMm = spec.rodMm - r - piston.skirtMm - 3;

  const axials = spec.cylinders.map((c) => c.axialMm);
  const half = bore / 2 + 12;
  const blockX0 = Math.min(...axials) - half;
  const blockX1 = Math.max(...axials) + half;
  const rearX = blockX0 - d.rearMm;
  const frontX = blockX1 + d.frontMm;

  // ── heads ──
  const headIds = [...new Set(spec.banks.map((b) => b.head))].sort((a, b) => a - b);
  const turboCount =
    TURBOS[spec.induction] > 0 ? (spec.sound.turbo?.count ?? TURBOS[spec.induction]) : 0;
  const hotVee = isHotVee(spec, turboCount);
  const twoSided = headIds.length >= 2;
  const castMm = 0.62 * d.headHeightMm;
  const coverMm = d.headHeightMm - castMm;
  const heads: HeadLayout[] = headIds.map((h, index) => {
    const banks = spec.banks.flatMap((b, i) => (b.head === h ? [i] : []));
    const tiltDeg = mean(banks.map((b) => spec.banks[b].tiltDeg));
    const cylinders = spec.cylinders.flatMap((c, i) => (banks.includes(c.bank) ? [i] : []));
    let halfWidthMm = 0;
    for (const b of banks) {
      const dl = (spec.banks[b].tiltDeg - tiltDeg) * DEG;
      halfWidthMm = Math.max(
        halfWidthMm,
        (d.deckMm + d.headHeightMm) * Math.abs(Math.sin(dl)) + (d.headWidthMm / 2) * Math.cos(dl),
      );
    }
    const inner: 1 | -1 = tiltDeg > 0 ? -1 : 1;
    const intakeSide: 1 | -1 = twoSided ? (hotVee ? (-inner as 1 | -1) : inner) : -1;
    const side = tiltDeg < 0 ? 'left' : 'right';
    return {
      index,
      tiltDeg,
      banks,
      cylinders,
      label: headIds.length === 1 ? 'Cylinder head' : `Head (${side})`,
      halfWidthMm,
      castMm,
      coverMm,
      intakeSide,
    };
  });
  const headOfBank = (bank: number) => heads.findIndex((h) => h.banks.includes(bank));

  const cylinders: CylinderLayout[] = spec.cylinders.map((c, i) => {
    const head = headOfBank(c.bank);
    const tiltDeg = spec.banks[c.bank].tiltDeg;
    const dl = (tiltDeg - heads[head].tiltDeg) * DEG;
    return {
      index: i,
      num: c.num,
      bank: c.bank,
      head,
      axialMm: c.axialMm,
      tiltDeg,
      axis: axisOf(tiltDeg),
      deckAcrossMm: d.deckMm * Math.tan(dl),
      headerMm: headerLengthMm(spec, i),
    };
  });

  const crank = crankLayout(spec, d, piston, blockX0, frontX);

  // ── valvetrain ──
  const nIn = Math.ceil(vt.valvesPerCyl / 2);
  const nEx = vt.valvesPerCyl - nIn;
  const diaIn =
    vt.valvesPerCyl <= 2 ? 0.46 * bore : vt.valvesPerCyl <= 4 ? 0.37 * bore : 0.26 * bore;
  const diaEx =
    vt.valvesPerCyl <= 2 ? 0.38 * bore : vt.valvesPerCyl <= 4 ? 0.32 * bore : 0.31 * bore;
  const liftMm = (ohv ? 0.12 : 0.11) * bore;
  const camBase = (ohv ? 0.2 : 0.17) * bore;
  const camLift = ohv ? 0.07 * bore : liftMm;
  const lobeW = clamp((vt.valvesPerCyl <= 2 ? 0.2 : 0.16) * bore, 8, 20);

  interface Seat {
    cyl: number;
    head: number;
    kind: 'intake' | 'exhaust';
    seat: V3;
    dia: number;
    peak: number;
  }
  const seats: Seat[] = [];
  for (const c of cylinders) {
    const h = heads[c.head];
    const fire = spec.cylinders[c.index].fireDeg;
    for (const kind of ['intake', 'exhaust'] as const) {
      const m = kind === 'intake' ? nIn : nEx;
      if (m === 0) continue;
      const sideSign = kind === 'intake' ? h.intakeSide : -h.intakeSide;
      const acrossOff = vt.valvesPerCyl <= 2 ? 0.15 * bore : 0.2 * bore;
      const spacing = m === 2 ? 0.4 * bore : 0.27 * bore;
      const twoValve = vt.valvesPerCyl <= 2 ? (kind === 'intake' ? 0.17 : -0.17) * bore : 0;
      for (let k = 0; k < m; k++) {
        const ax = c.axialMm + (k - (m - 1) / 2) * spacing + twoValve;
        seats.push({
          cyl: c.index,
          head: c.head,
          kind,
          seat: [ax, d.deckMm + 2, c.deckAcrossMm + sideSign * acrossOff],
          dia: kind === 'intake' ? diaIn : diaEx,
          peak: mod(fire + (kind === 'intake' ? 470 : 250), 720),
        });
      }
    }
  }

  // cam sprockets (twice this) must clear each other on a DOHC head, whose cams sit ~1 bore apart
  const crankSprocketMm = 0.24 * bore;
  const loopX = (k: number, m: number) => blockX1 + 0.35 * d.frontMm + (k - (m - 1) / 2) * 12;
  const cams: CamLayout[] = [];
  const valves: ValveLayout[] = [];
  const pushrods: PushrodLayout[] = [];
  const loops: TimingLoop[] = [];

  if (ohv) {
    // one cam in the block: in the vee valley, or low beside the bores of an inline engine
    const nose = camBase + camLift;
    const at: YZ = twoSided
      ? [
          Math.max(
            d.crankcaseRadiusMm + 14,
            crank.counterweightRadiusMm + nose + 10,
            // and clear of the bores either side (a big-bore, short-stroke block like the
            // Ford 289 would otherwise put the lobes into the cylinders)
            (bore / 2 + nose + 6) / Math.sin(Math.abs(heads[0].tiltDeg) * DEG),
          ),
          0,
        ]
      : fromBank(
          heads[0].tiltDeg,
          linerBottomMm,
          heads[0].intakeSide * (bore / 2 + camBase + camLift + 6),
        );
    const x = loopX(0, 1);
    const cam: CamLayout = {
      head: -1,
      kind: 'both',
      at,
      x0: blockX0 + 8,
      x1: x,
      sprocketX: x,
      baseRadiusMm: camBase,
      liftMm: camLift,
      lobes: [],
    };
    cams.push(cam);
    loops.push({
      x,
      sprockets: [
        { at: [0, 0], r: crankSprocketMm },
        { at, r: 2 * crankSprocketMm },
      ],
    });
    for (const s of seats) {
      const h = heads[s.head];
      const lengthMm = castMm + 0.25 * coverMm - 2;
      const vi = valves.length;
      valves.push({
        cyl: s.cyl,
        head: s.head,
        kind: s.kind,
        seat: s.seat,
        dir: [0, 1, 0],
        lengthMm,
        headDiaMm: s.dia,
        peakDeg: s.peak,
        liftMm,
        cam: 0,
      });
      const bankTilt = cylinders[s.cyl].tiltDeg;
      const u = axisOf(bankTilt);
      const lifter = camBase + 30;
      const from: V3 = [s.seat[0], at[0] + u[0] * lifter, at[1] + u[1] * lifter];
      const to = headToEngine(h.tiltDeg, [
        s.seat[0],
        d.deckMm + 0.85 * castMm,
        s.seat[2] + h.intakeSide * 0.32 * bore,
      ]);
      pushrods.push({ valve: vi, head: s.head, from, to });
      cam.lobes.push({
        axialMm: s.seat[0],
        widthMm: lobeW,
        angleDeg: mod(bankTilt + s.peak / 2, 360),
      });
    }
  } else {
    heads.forEach((h, hi) => {
      const mine = seats.filter((s) => s.head === hi);
      const groups: { kind: CamLayout['kind']; list: Seat[]; across: number }[] =
        vt.type === 'dohc'
          ? (['intake', 'exhaust'] as const).map((kind) => {
              const list = mine.filter((s) => s.kind === kind);
              const sideSign = kind === 'intake' ? h.intakeSide : -h.intakeSide;
              return {
                kind,
                list,
                across: mean(list.map((s) => s.seat[2])) + sideSign * 0.3 * bore,
              };
            })
          : [{ kind: 'both', list: mine, across: mean(mine.map((s) => s.seat[2])) }];
      const x = loopX(hi, heads.length);
      const loop: TimingLoop = { x, sprockets: [{ at: [0, 0], r: crankSprocketMm }] };
      for (const g of groups) {
        if (g.list.length === 0) continue;
        const along = d.deckMm + castMm;
        const ci = cams.length;
        const cam: CamLayout = {
          head: hi,
          kind: g.kind,
          at: [along, g.across],
          x0: blockX0 + 8,
          x1: x,
          sprocketX: x,
          baseRadiusMm: camBase,
          liftMm: camLift,
          lobes: [],
        };
        cams.push(cam);
        loop.sprockets.push({ at: fromBank(h.tiltDeg, along, g.across), r: 2 * crankSprocketMm });
        for (const s of g.list) {
          const toCam: V3 = [0, along - s.seat[1], g.across - s.seat[2]];
          const dist = v3len(toCam);
          const dir = v3norm(toCam);
          valves.push({
            cyl: s.cyl,
            head: hi,
            kind: s.kind,
            seat: s.seat,
            dir,
            lengthMm: dist - camBase - 3,
            headDiaMm: s.dia,
            peakDeg: s.peak,
            liftMm,
            cam: ci,
          });
          const phi = Math.atan2(-dir[2], -dir[1]) / DEG;
          cam.lobes.push({
            axialMm: s.seat[0],
            widthMm: lobeW,
            angleDeg: mod(phi + s.peak / 2, 360),
          });
        }
      }
      loops.push(loop);
    });
  }

  // ── ports, intake, exhaust ──
  const port = (c: CylinderLayout, side: 1 | -1): PortLayout => {
    const h = heads[c.head];
    const [y, z] = fromBank(h.tiltDeg, d.deckMm + 0.3 * castMm, side * h.halfWidthMm);
    return {
      cyl: c.index,
      head: c.head,
      at: [c.axialMm, y, z],
      dir: yzNorm(acrossOf(h.tiltDeg).map((v) => v * side) as YZ),
    };
  };
  const intakePorts = cylinders.map((c) => port(c, heads[c.head].intakeSide));
  const exhaustPorts = cylinders.map((c) => port(c, -heads[c.head].intakeSide as 1 | -1));

  const plenums: PlenumLayout[] = [];
  const runners: { cyl: number; plenum: number }[] = [];
  const plenumR = (feeds: number) => clamp(0.36 * bore * Math.sqrt(feeds / 4), 32, 72);
  if (twoSided && !hotVee) {
    const radiusMm = plenumR(cylinders.length);
    let top = -Infinity;
    for (const h of heads)
      top = Math.max(
        top,
        fromBank(h.tiltDeg, d.deckMm + d.headHeightMm, h.intakeSide * h.halfWidthMm)[0],
      );
    const y = Math.max(top + 0.3 * radiusMm, d.crankcaseRadiusMm + radiusMm + 8);
    plenums.push({
      at: [y, 0],
      radiusMm,
      x0: blockX0 + 10,
      x1: blockX1 - 10,
      heads: heads.map((h) => h.index),
      outDir: [1, 0],
    });
    for (const c of cylinders) runners.push({ cyl: c.index, plenum: 0 });
  } else {
    heads.forEach((h, hi) => {
      const mine = intakePorts.filter((p) => p.head === hi);
      const radiusMm = plenumR(mine.length);
      const n = mine[0].dir;
      const u = axisOf(h.tiltDeg);
      const py = mean(mine.map((p) => p.at[1]));
      const pz = mean(mine.map((p) => p.at[2]));
      const gap = radiusMm + 0.55 * bore;
      plenums.push({
        at: [py + n[0] * gap + u[0] * 0.2 * castMm, pz + n[1] * gap + u[1] * 0.2 * castMm],
        radiusMm,
        x0: blockX0 + 10,
        x1: blockX1 - 10,
        heads: [hi],
        outDir: yzNorm([n[0] + 0.5 * u[0], n[1] + 0.5 * u[1]]),
      });
      for (const p of mine) runners.push({ cyl: p.cyl, plenum: plenums.length - 1 });
    });
  }

  const outboard = !hotVee;
  const gapOut = 0.6 * bore + 25;
  const drop = 0.5 * d.deckMm;
  const base: number[][] =
    spec.sound.collector === 'single'
      ? [cylinders.map((c) => c.index)]
      : heads.map((h) => h.cylinders.slice());
  let groups = base;
  if (turboCount > base.length) {
    const per = Math.ceil(turboCount / base.length);
    groups = base.flatMap((g) => {
      const sorted = g
        .slice()
        .sort((a, b) => spec.cylinders[b].axialMm - spec.cylinders[a].axialMm);
      const size = Math.ceil(sorted.length / per);
      return Array.from({ length: per }, (_, k) => sorted.slice(k * size, (k + 1) * size)).filter(
        (x) => x.length,
      );
    });
  }
  const exhaust: ExhaustGroupLayout[] = groups.map((cyls) => {
    // Ports facing down (a flat engine's heads): the collector sits just under its ports, not
    // pulled in under the sump, and whatever follows (turbo, outlet) goes outboard beside the
    // head, as on a 911, instead of further down towards the road.
    const down = mean(cyls.map((i) => exhaustPorts[i].dir[0])) < -0.6;
    const cands = cyls.map((i) => {
      const p = exhaustPorts[i];
      const u = axisOf(heads[p.head].tiltDeg);
      const k = outboard && !down ? drop : 0;
      const gap = down ? 0.5 * gapOut : gapOut;
      return [
        p.at[0],
        p.at[1] + p.dir[0] * gap - u[0] * k,
        p.at[2] + p.dir[1] * gap - u[1] * k,
      ] as V3;
    });
    const collector: V3 = [
      mean(cands.map((c) => c[0])),
      mean(cands.map((c) => c[1])),
      mean(cands.map((c) => c[2])),
    ];
    const n = yzNorm([
      mean(cyls.map((i) => exhaustPorts[i].dir[0])),
      mean(cyls.map((i) => exhaustPorts[i].dir[1])),
    ]);
    // (a single collector on the centre line goes to the right, as on Subaru's EJ)
    const side = Math.sign(collector[2]) || 1;
    return {
      cylinders: cyls,
      collector,
      outDir: down ? [0, side] : Math.hypot(n[0], n[1]) > 0.1 ? n : [-1, 0],
      turbo: -1,
    };
  });
  // flat engines with one collector: ports point up/down on opposite sides and cancel out
  for (const g of exhaust) {
    const raw = [
      mean(g.cylinders.map((i) => exhaustPorts[i].dir[0])),
      mean(g.cylinders.map((i) => exhaustPorts[i].dir[1])),
    ];
    // what follows goes beside the engine (right, as on Subaru's EJ), not down to the road
    if (Math.hypot(raw[0], raw[1]) < 0.1) g.outDir = [0, 1];
  }

  const turbos: TurboLayout[] = [];
  if (turboCount > 0) {
    const radiusMm = clamp(0.5 * bore + (3 * cylinders.length) / turboCount, 36, 70);
    if (exhaust.length <= turboCount) {
      for (const g of exhaust) {
        g.turbo = turbos.length;
        const off = radiusMm + 12;
        turbos.push({
          at: [
            g.collector[0],
            g.collector[1] + g.outDir[0] * off,
            g.collector[2] + g.outDir[1] * off,
          ],
          radiusMm,
          outDir: g.outDir,
        });
      }
    } else {
      const n = yzNorm([
        mean(exhaust.map((g) => g.outDir[0])),
        mean(exhaust.map((g) => g.outDir[1])),
      ]);
      const c: V3 = [
        mean(exhaust.map((g) => g.collector[0])),
        mean(exhaust.map((g) => g.collector[1])),
        mean(exhaust.map((g) => g.collector[2])),
      ];
      const off = radiusMm + 12;
      turbos.push({ at: [c[0], c[1] + n[0] * off, c[2] + n[1] * off], radiusMm, outDir: n });
      for (const g of exhaust) g.turbo = 0;
    }
  }

  const R = d.crankcaseRadiusMm;
  const flyR = Math.min(150, env.max[1], -env.min[1], env.max[2], -env.min[2]) - 4;
  const coverX1 = blockX1 + 0.68 * d.frontMm;
  return {
    spec,
    dims: d,
    env,
    piston,
    linerBottomMm,
    blockX0,
    blockX1,
    rearX,
    frontX,
    cylinders,
    crank,
    heads,
    cams,
    valves,
    pushrods,
    timing: { crankSprocketMm, loops, coverX0: blockX1, coverX1 },
    pulley: { x0: coverX1, x1: frontX, radiusMm: Math.min(0.75 * R, flyR) },
    flywheel: { x0: rearX, x1: blockX0 - 2, radiusMm: flyR },
    intakePorts,
    exhaustPorts,
    plenums,
    runners,
    exhaust,
    turbos,
    crossover: spec.sound.collector === 'crossover',
    supercharged: spec.induction === 'supercharged',
    hotVee,
  };
}

/** Engine-frame seat and direction of a valve (unit), for the animation. */
export function valveInEngine(l: EngineLayout, v: ValveLayout): { seat: V3; dir: V3 } {
  const t = l.heads[v.head].tiltDeg;
  return { seat: headToEngine(t, v.seat), dir: headDirToEngine(t, v.dir) };
}

/** Pushrod axis (unit) and length. */
export function pushrodAxis(p: PushrodLayout): { dir: V3; lengthMm: number } {
  const d = v3sub(p.to, p.from);
  return { dir: v3norm(d), lengthMm: v3len(d) };
}

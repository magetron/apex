/**
 * Builders keep catalog files short and always self-consistent: give the layout, the cylinder
 * numbering and the firing order; the builder places cylinders and derives every crank throw
 * from throwDeg = tiltDeg + fireDeg (see the crank convention in types.ts).
 */
import type {
  BankDef,
  CylinderDef,
  EngineFamily,
  EngineSoundParams,
  EngineSpec,
  RotaryDef,
  RotaryPort,
} from './types';
import { mod } from './units';

/** Sound params with sensible defaults; catalog entries override what makes them distinctive. */
export const sound = (
  p: Partial<EngineSoundParams> & Pick<EngineSoundParams, 'character'>,
): EngineSoundParams => ({
  headerMm: 600,
  collector: 'single',
  collectorMm: 450,
  mufflerMm: 500,
  tailpipeMm: 700,
  mix: { exhaust: 0.8, intake: 0.3, mechanical: 0.2 },
  ...p,
});

type Common = Omit<
  EngineSpec,
  'family' | 'banks' | 'cylinders' | 'displacementCc' | 'bankAngleDeg' | 'geometry'
> & {
  geometry?: EngineSpec['geometry'];
  /** Gaps (deg) between successive firings in firing order. Default: even, 720 / n. */
  fireIntervalsDeg?: number[];
};

interface Placed {
  num: number;
  bank: number;
  axialMm: number;
  pin: number;
}

function assemble(
  family: EngineFamily,
  bankAngleDeg: number,
  banks: BankDef[],
  placed: Placed[],
  o: Common,
): EngineSpec {
  const n = placed.length;
  const { fireIntervalsDeg, geometry, ...rest } = o;
  if (o.firingOrder.length !== n)
    throw new Error(`${o.id}: firing order has ${o.firingOrder.length} entries, expected ${n}`);
  const intervals = fireIntervalsDeg ?? Array(n).fill(720 / n);
  if (intervals.length !== n) throw new Error(`${o.id}: need ${n} fire intervals`);
  const total = intervals.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 720) > 1e-6)
    throw new Error(`${o.id}: fire intervals sum to ${total}, not 720`);

  const fireDeg = new Map<number, number>();
  let deg = 0;
  o.firingOrder.forEach((num, k) => {
    if (fireDeg.has(num)) throw new Error(`${o.id}: cylinder ${num} fires twice`);
    fireDeg.set(num, deg);
    deg += intervals[k];
  });

  const cylinders: CylinderDef[] = placed
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((p) => {
      const f = fireDeg.get(p.num);
      if (f === undefined) throw new Error(`${o.id}: cylinder ${p.num} missing from firing order`);
      return { ...p, fireDeg: f, throwDeg: mod(banks[p.bank].tiltDeg + f, 360) };
    });

  const displacementCc = (Math.PI / 4) * o.boreMm ** 2 * o.strokeMm * n * 1e-3;
  return {
    ...rest,
    family,
    bankAngleDeg,
    banks,
    cylinders,
    displacementCc: Math.round(displacementCc),
    geometry: geometry ?? {},
  };
}

/** Axial slot positions, front (timing end, +X) to rear, centred on 0. */
const slots = (count: number, pitch: number) =>
  Array.from({ length: count }, (_, k) => ((count - 1) / 2 - k) * pitch);

export function inline(n: number, o: Common & { slantDeg?: number }): EngineSpec {
  const banks = [{ tiltDeg: o.slantDeg ?? 0, head: 0 }];
  const placed = slots(n, o.borePitchMm).map((axialMm, i) => ({
    num: i + 1,
    bank: 0,
    axialMm,
    pin: i,
  }));
  return assemble('inline', 0, banks, placed, o);
}

type Numbering =
  /** GM style: 1 on firstBank, 2 on the other, alternating front to rear */
  | 'alternating'
  /** Ferrari/Audi/Porsche style: 1..n/2 on firstBank front→rear, then the other bank */
  | 'bank-sequential';

interface TwoBankOpts {
  numbering: Numbering;
  /** Bank that holds cylinder 1. */
  firstBank: 'left' | 'right';
  /** Bank whose cylinders sit further forward (the other is offset rearward on the crank). */
  forwardBank?: 'left' | 'right';
  /** Axial offset between the two banks (mm); default ≈ one con-rod big-end width. */
  bankOffsetMm?: number;
}

function twoBank(
  n: number,
  pitch: number,
  b: TwoBankOpts,
  pinOf: (slot: number, side: 0 | 1) => number,
): Placed[] {
  const per = n / 2;
  if (!Number.isInteger(per)) throw new Error('two-bank engines need an even cylinder count');
  // bank index 0 = left (tilt < 0), 1 = right
  const first: 0 | 1 = b.firstBank === 'left' ? 0 : 1;
  const second: 0 | 1 = first === 0 ? 1 : 0;
  const forward: 0 | 1 = (b.forwardBank ?? b.firstBank) === 'left' ? 0 : 1;
  const off = b.bankOffsetMm ?? pitch * 0.24;
  const s = slots(per, pitch);
  const placed: Placed[] = [];
  for (let k = 0; k < per; k++) {
    for (const side of [first, second] as const) {
      const num =
        b.numbering === 'alternating'
          ? 2 * k + (side === first ? 1 : 2)
          : (side === first ? 0 : per) + k + 1;
      const axialMm = s[k] + (side === forward ? off / 2 : -off / 2);
      placed.push({ num, bank: side, axialMm, pin: pinOf(k, side) });
    }
  }
  return placed;
}

export function vee(
  n: number,
  bankAngleDeg: number,
  o: Common & TwoBankOpts & { pins: 'shared' | 'split' },
): EngineSpec {
  const banks = [
    { tiltDeg: -bankAngleDeg / 2, head: 0 },
    { tiltDeg: bankAngleDeg / 2, head: 1 },
  ];
  const placed = twoBank(n, o.borePitchMm, o, (k, side) =>
    o.pins === 'shared' ? k : 2 * k + side,
  );
  return assemble('v', bankAngleDeg, banks, placed, o);
}

/** Horizontally opposed ("boxer"): every cylinder has its own pin, opposite pins 180° apart. */
export function flat(n: number, o: Common & TwoBankOpts): EngineSpec {
  const banks = [
    { tiltDeg: -90, head: 0 },
    { tiltDeg: 90, head: 1 },
  ];
  const placed = twoBank(
    n,
    o.borePitchMm,
    { bankOffsetMm: o.borePitchMm * 0.45, ...o },
    (k, side) => 2 * k + side,
  );
  return assemble('flat', 180, banks, placed, o);
}

/**
 * Narrow-angle VR: one block and one head, cylinders zig-zag between two rows tilted ±vr/2.
 * borePitchMm here is the axial step between consecutive cylinders in the zig-zag.
 * Odd cylinders sit in the row given by firstRow.
 */
export function vr(
  n: number,
  vrAngleDeg: number,
  o: Common & { firstRow?: 'left' | 'right' },
): EngineSpec {
  const banks = [
    { tiltDeg: -vrAngleDeg / 2, head: 0 },
    { tiltDeg: vrAngleDeg / 2, head: 0 },
  ];
  const odd = o.firstRow === 'right' ? 1 : 0;
  const placed = slots(n, o.borePitchMm).map((axialMm, i) => ({
    num: i + 1,
    bank: i % 2 === 0 ? odd : 1 - odd,
    axialMm,
    pin: i,
  }));
  return assemble('vr', vrAngleDeg, banks, placed, o);
}

type RotaryOpts = Omit<
  Common,
  'boreMm' | 'strokeMm' | 'rodMm' | 'borePitchMm' | 'fireIntervalsDeg' | 'valvetrain'
> & {
  rotary: RotaryDef;
};

/** Port timing as service manuals quote it → RotaryPort (1080° face cycle, see types.ts). */
export const intakePort = (
  name: string,
  location: RotaryPort['location'],
  perRotor: number,
  opensAtdc: number,
  closesAbdc: number,
): RotaryPort => ({
  kind: 'intake',
  location,
  name,
  perRotor,
  openDeg: 540 + opensAtdc,
  closeDeg: 810 + closesAbdc,
});

export const exhaustPort = (
  name: string,
  location: RotaryPort['location'],
  perRotor: number,
  opensBbdc: number,
  closesBtdc: number,
): RotaryPort => ({
  kind: 'exhaust',
  location,
  name,
  perRotor,
  openDeg: 270 - opensBbdc,
  closeDeg: 540 - closesBtdc,
});

/**
 * Wankel rotary: n rotors in line on one eccentric shaft, rotor 1 at the front, lobes spread
 * evenly (2 rotors: 180°) so the rotors take turns. Each rotor fires once per shaft turn, so
 * firings are 360/n apart; the spark plugs sit on the engine's left (-Z) side, which makes the
 * lobe angle at firing (bank tilt) -90°. Displacement is per face: 3√3·R·e·B per rotor.
 */
export function rotary(n: number, o: RotaryOpts): EngineSpec {
  const { rotary: r, geometry, ...rest } = o;
  if (o.firingOrder.length !== n)
    throw new Error(`${o.id}: firing order has ${o.firingOrder.length} entries, expected ${n}`);
  if (r.generatingRadiusMm <= 3 * r.eccentricityMm)
    throw new Error(`${o.id}: R must exceed 3e or the apexes cusp`);
  const banks = [{ tiltDeg: -90, head: 0 }];
  const pitch = r.rotorWidthMm + r.sideHousingMm;
  const at = slots(n, pitch);
  const cylinders: CylinderDef[] = Array.from({ length: n }, (_, i) => {
    const fireDeg = (360 / n) * o.firingOrder.indexOf(i + 1);
    if (fireDeg < 0) throw new Error(`${o.id}: rotor ${i + 1} missing from firing order`);
    return {
      num: i + 1,
      bank: 0,
      axialMm: at[i],
      pin: i,
      fireDeg,
      throwDeg: mod(banks[0].tiltDeg + fireDeg, 360),
    };
  });
  // Mazda quotes the per-rotor figure cut to whole cc (13B: 654.7 → 654 cc × 2 = 1308 cc)
  const faceCc = Math.floor(
    (3 * Math.sqrt(3) * r.generatingRadiusMm * r.eccentricityMm * r.rotorWidthMm) / 1000,
  );
  return {
    ...rest,
    family: 'rotary',
    bankAngleDeg: 0,
    banks,
    cylinders,
    boreMm: r.rotorWidthMm,
    strokeMm: 2 * r.eccentricityMm,
    rodMm: r.generatingRadiusMm,
    borePitchMm: pitch,
    displacementCc: n * faceCc,
    valvetrain: { type: 'ports', valvesPerCyl: 0 },
    geometry: geometry ?? {},
    rotary: r,
  };
}

/**
 * W engine = two VR blocks on one crank (VW W12: 2×VR6 at 72°, Bugatti W16: 2×VR8 at 90°).
 * Cylinders 1..n/2 are the left VR block, the rest the right block, each zig-zagging.
 */
export function w(n: number, outerAngleDeg: number, vrAngleDeg: number, o: Common): EngineSpec {
  const h = outerAngleDeg / 2;
  const v = vrAngleDeg / 2;
  const banks = [
    { tiltDeg: -h - v, head: 0 },
    { tiltDeg: -h + v, head: 0 },
    { tiltDeg: h - v, head: 1 },
    { tiltDeg: h + v, head: 1 },
  ];
  const per = n / 2;
  const s = slots(per, o.borePitchMm);
  const off = o.borePitchMm * 0.3;
  const placed: Placed[] = [];
  for (let i = 0; i < per; i++) {
    placed.push({ num: i + 1, bank: i % 2, axialMm: s[i] + off / 2, pin: i });
    placed.push({ num: per + i + 1, bank: 2 + (i % 2), axialMm: s[i] - off / 2, pin: per + i });
  }
  return assemble('w', outerAngleDeg, banks, placed, o);
}

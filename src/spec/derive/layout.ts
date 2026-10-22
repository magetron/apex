/**
 * Places every powertrain component of a vehicle in the vehicle frame. massProps() and the 3D
 * garage both consume this, so the CG readout and the picture can never disagree.
 */
import { getEngine, getMotor } from '../catalog';
import type {
  Axle,
  IcePowertrain,
  PlacedPart,
  PowertrainLayout,
  Shaft,
  Vec3,
  VehicleSpec,
} from '../types';
import { DEG } from '../units';
import { envelope } from './envelope';

export const GEARBOX: Record<
  IcePowertrain['gearbox'],
  { sizeMm: Vec3; kg: number; label: string }
> = {
  'transverse-endon': {
    sizeMm: [380, 380, 360],
    kg: 60,
    label: 'Transverse gearbox + differential',
  },
  inline: { sizeMm: [700, 330, 330], kg: 85, label: 'Gearbox' },
  'mid-transaxle': {
    sizeMm: [620, 420, 460],
    kg: 120,
    label: 'Transaxle (gearbox + differential)',
  },
  'rear-transaxle': { sizeMm: [560, 360, 480], kg: 110, label: 'Rear transaxle' },
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Offset d along a part's local +X after a yaw (three.js rotation.y: +X → (cos ψ, 0, −sin ψ)). */
export const alongYaw = (yawDeg: number, d: number): Vec3 => [
  Math.cos(yawDeg * DEG) * d,
  0,
  -Math.sin(yawDeg * DEG) * d,
];

/** Engine yaw in the car: timing end forward (0), backward (180, 911-style) or to one side (±90). */
export function engineYawDeg(pt: IcePowertrain): number {
  if (pt.orientation === 'transverse') return (pt.gearboxSide ?? 'left') === 'left' ? -90 : 90;
  return pt.position === 'rear-overhang' && pt.gearbox === 'mid-transaxle' ? 180 : 0;
}

/** The axle the gearbox's own differential drives. */
export function primaryAxle(pt: IcePowertrain): Axle {
  if (pt.gearbox === 'transverse-endon') return pt.position.startsWith('front') ? 'front' : 'rear';
  return 'rear';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fuel tanks are saddle tanks: a channel along the underside carries the prop shaft, the exhaust
 * and coolant pipes past. Under a rear seat, behind the seats or in the nose the tank is flat and
 * wide; between the seats and the engine of a mid-engined two-seater it stands up as a bulkhead.
 */
export const FUEL_TANK = {
  /** half width of the channel along the underside */
  tunnelHalfMm: 190,
  /** channel height above the tank bottom */
  tunnelHMm: 170,
  /** tank bottom above the road (behind the rear axle it rides at hub height, over the silencer) */
  bottomMm: 130,
  flatHMm: 240,
  bulkheadHMm: 460,
};

/** mm the drawn engine (timing cover, flywheel, manifolds) reaches beyond its envelope */
export const ENGINE_DRESS_MM = 100;

/** A placed part's box in the vehicle frame, as [min, max] (yaw and roll applied). */
export function partBounds(p: PlacedPart, inflate: Vec3 = [0, 0, 0]): [Vec3, Vec3] {
  const cy = Math.cos(p.yawDeg * DEG);
  const sy = Math.sin(p.yawDeg * DEG);
  const cr = Math.cos(p.rollDeg * DEG);
  const sr = Math.sin(p.rollDeg * DEG);
  // R = Ry(yaw)·Rx(roll), the order the scene applies them in
  const R = [
    [cy, 0, -sy],
    [sy * sr, cr, cy * sr],
    [sy * cr, -sr, cy * cr],
  ];
  const off = p.boxOffsetMm ?? [0, 0, 0];
  const h = [0, 1, 2].map((i) => p.sizeMm[i] / 2 + inflate[i]);
  const lo: Vec3 = [0, 0, 0];
  const hi: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const c = p.posMm[i] + R[0][i] * off[0] + R[1][i] * off[1] + R[2][i] * off[2];
    const e = Math.abs(R[0][i]) * h[0] + Math.abs(R[1][i]) * h[1] + Math.abs(R[2][i]) * h[2];
    lo[i] = c - e;
    hi[i] = c + e;
  }
  if (p.kind === 'diff' && p.kg > 0) {
    // the pinion nose reaches toward the prop shaft
    const nose = 0.8 * p.sizeMm[0];
    if (p.axle === 'rear') hi[0] = Math.max(hi[0], p.posMm[0] + nose);
    else lo[0] = Math.min(lo[0], p.posMm[0] - nose);
  }
  return [lo, hi];
}

function placeFuelTank(v: VehicleSpec, pt: IcePowertrain, parts: PlacedPart[]): PlacedPart {
  const L = v.dims.wheelbaseMm;
  const T = FUEL_TANK;
  const { litres, xMm } = pt.fuelTank;
  const bulkhead = pt.position === 'mid' && v.seats.layout === '2' && xMm < -0.3 * L;
  const h = bulkhead ? T.bulkheadHMm : T.flatHMm;
  const inner =
    Math.min(v.dims.trackFMm - v.tires.widthFMm, v.dims.trackRMm - v.tires.widthRMm) - 160;
  const w = Math.min(0.55 * v.dims.widthMm, inner);
  const len = (litres * 1e6) / (h * w - 2 * T.tunnelHalfMm * T.tunnelHMm);
  const y0 = xMm < -L ? v.tires.diameterMm / 2 : T.bottomMm;
  const gap = 30;
  const engine = parts.find((p) => p.kind === 'engine');
  let x = xMm;
  // a bulkhead tank stands against the engine's front face
  if (bulkhead && engine) {
    const front = partBounds(engine, [ENGINE_DRESS_MM, 0, 0])[1][0];
    if (front < xMm) x = front + gap + len / 2;
  }
  // the tank gives way along the car to the driveline it would otherwise sit in
  const blocked: [number, number][] = [];
  for (const p of parts) {
    if (p.kind === 'wheel') continue;
    const d = p.kind === 'engine' ? ENGINE_DRESS_MM : 0;
    const [lo, hi] = partBounds(p, [d, d, d]);
    if (hi[1] <= y0 || lo[1] >= y0 + h || hi[2] <= -w / 2 || lo[2] >= w / 2) continue;
    blocked.push([lo[0] - gap, hi[0] + gap]);
  }
  const free = (c: number) => blocked.every(([a, b]) => c + len / 2 <= a || c - len / 2 >= b);
  if (!free(x)) {
    const want = x;
    const ok = blocked.flatMap(([a, b]) => [a - len / 2, b + len / 2]).filter(free);
    if (ok.length) x = ok.reduce((p, c) => (Math.abs(c - want) < Math.abs(p - want) ? c : p));
  }
  return {
    id: 'fuel-tank',
    kind: 'fuel-tank',
    label: `Fuel tank (${litres} L)`,
    posMm: [x, y0 + h / 2, 0],
    sizeMm: [len, h, w],
    yawDeg: 0,
    rollDeg: 0,
    kg: litres * 0.745,
  };
}

export function layoutPowertrain(v: VehicleSpec): PowertrainLayout {
  const L = v.dims.wheelbaseMm;
  const wheelR = v.tires.diameterMm / 2;
  const pt = v.powertrain;
  const parts: PlacedPart[] = [];
  const shafts: Shaft[] = [];
  const axleX = (a: Axle) => (a === 'front' ? 0 : -L);
  const track = (a: Axle) => (a === 'front' ? v.dims.trackFMm : v.dims.trackRMm);
  const tireW = (a: Axle) => (a === 'front' ? v.tires.widthFMm : v.tires.widthRMm);
  const drivenAxles: Axle[] = pt.driven === 'all' ? ['front', 'rear'] : [pt.driven];

  // Wheels carry the unsprung corner mass (wheel, tyre, brake, upright, half the links).
  const cornerKg = clamp(0.028 * v.published.curbKg, 25, 55);
  for (const axle of ['front', 'rear'] as const) {
    for (const side of [-1, 1] as const) {
      const s = side < 0 ? 'left' : 'right';
      parts.push({
        id: `wheel-${axle}-${s}`,
        kind: 'wheel',
        label: `${axle === 'front' ? 'Front' : 'Rear'} ${s} wheel`,
        posMm: [axleX(axle), wheelR, (side * track(axle)) / 2],
        sizeMm: [v.tires.diameterMm, v.tires.diameterMm, tireW(axle)],
        yawDeg: 0,
        rollDeg: 0,
        kg: cornerKg,
        axle,
        driven: drivenAxles.includes(axle),
      });
    }
  }

  const halfShafts = (axle: Axle, from: Vec3) => {
    for (const side of [-1, 1] as const) {
      shafts.push({
        id: `half-${axle}-${side < 0 ? 'left' : 'right'}`,
        kind: 'half',
        label: `${axle === 'front' ? 'Front' : 'Rear'} half shaft`,
        fromMm: [axleX(axle), wheelR, from[2] + side * 90],
        toMm: [axleX(axle), wheelR, side * (track(axle) / 2 - tireW(axle) * 0.35)],
        axle,
      });
    }
  };
  const diff = (axle: Axle, posMm: Vec3, kg: number, label: string) => {
    parts.push({
      id: `diff-${axle}`,
      kind: 'diff',
      label,
      posMm,
      sizeMm: [260, 260, 300],
      yawDeg: 0,
      rollDeg: 0,
      kg,
      axle,
      driven: true,
    });
    halfShafts(axle, posMm);
  };

  if (pt.kind === 'ice') {
    const eng = getEngine(pt.engine);
    const env = envelope(eng);
    const yaw = engineYawDeg(pt);
    const gb = GEARBOX[pt.gearbox];
    const gbLen = gb.sizeMm[0];
    let origin: Vec3 = [pt.engineXMm, pt.crankYMm, 0];
    let gbPos: Vec3;
    if (pt.gearbox === 'transverse-endon') {
      // centre the engine + gearbox unit across the car
      const unitCentre = (env.max[0] + env.min[0] - gbLen) / 2;
      origin = add(origin, alongYaw(yaw, -unitCentre));
      gbPos = add(add(origin, alongYaw(yaw, env.min[0] - gbLen / 2)), [-60, -40, 0]);
    } else if (pt.gearbox === 'rear-transaxle') {
      gbPos = [-L + 60, wheelR + 40, 0];
    } else {
      // bolted to the flywheel end: behind a forward-facing engine, ahead of a 911-style one
      gbPos = add(add(origin, alongYaw(yaw, env.min[0] - gbLen / 2)), [0, -20, 0]);
    }

    parts.push({
      id: 'engine',
      kind: 'engine',
      label: eng.name,
      posMm: origin,
      sizeMm: [env.lengthMm, env.heightMm, env.widthMm],
      boxOffsetMm: [
        (env.min[0] + env.max[0]) / 2,
        (env.min[1] + env.max[1]) / 2,
        (env.min[2] + env.max[2]) / 2,
      ],
      yawDeg: yaw,
      // transverse: + leans the top rearward whichever side the gearbox is on (the crank points
      // the other way with the gearbox on the right)
      rollDeg:
        (pt.engineTiltDeg ?? 0) *
        (pt.orientation === 'transverse' && pt.gearboxSide === 'right' ? -1 : 1),
      kg: eng.massKg,
    });
    parts.push({
      id: 'gearbox',
      kind: 'gearbox',
      label: gb.label,
      posMm: gbPos,
      sizeMm: gb.sizeMm,
      yawDeg: pt.gearbox === 'rear-transaxle' ? 0 : yaw,
      rollDeg: 0,
      kg: pt.gearboxKg ?? gb.kg,
    });

    const main = primaryAxle(pt);
    const mainDiffPos: Vec3 = [
      axleX(main),
      wheelR,
      pt.gearbox === 'transverse-endon' ? gbPos[2] * 0.5 : 0,
    ];
    const inGearbox = pt.gearbox !== 'inline';
    diff(
      main,
      mainDiffPos,
      inGearbox ? 0 : 35,
      inGearbox ? 'Differential (in gearbox)' : 'Rear differential',
    );

    if (pt.gearbox === 'inline') {
      shafts.push({
        id: 'prop-rear',
        kind: 'prop',
        label: 'Prop shaft',
        fromMm: add(gbPos, alongYaw(yaw, -gbLen / 2)),
        toMm: [-L + 150, wheelR, 0],
      });
    } else if (pt.gearbox === 'rear-transaxle') {
      shafts.push({
        id: 'prop-rear',
        kind: 'prop',
        label: 'Prop shaft (torque tube)',
        fromMm: add(origin, alongYaw(yaw, env.min[0])),
        toMm: add(gbPos, [gbLen / 2, 0, 0]),
      });
    }

    if (pt.driven === 'all') {
      const other: Axle = main === 'front' ? 'rear' : 'front';
      const otherX = axleX(other);
      const awd = pt.awd ?? (main === 'front' ? 'clutch-on-demand' : 'rear-biased-clutch');
      if (awd === 'clutch-on-demand') {
        parts.push({
          id: 'coupling',
          kind: 'coupling',
          label: 'On-demand clutch (Haldex-type)',
          posMm: [otherX + (other === 'rear' ? 320 : -320), wheelR, 0],
          sizeMm: [220, 200, 200],
          yawDeg: 0,
          rollDeg: 0,
          kg: 12,
        });
      } else if (awd === 'center-diff' || awd === 'transfer-case') {
        parts.push({
          id: 'coupling',
          kind: 'coupling',
          label:
            awd !== 'transfer-case'
              ? 'Centre differential'
              : // part-time 4WD has no centre diff: 4H locks the two prop shafts together
                pt.awdDevice?.type === 'locked'
                ? 'Transfer case (low range, part-time 4WD)'
                : 'Transfer case (low range, locking centre diff)',
          posMm: add(gbPos, alongYaw(yaw, -gbLen / 2 + 80)),
          sizeMm: [200, 220, 220],
          yawDeg: yaw,
          rollDeg: 0,
          kg: 15,
        });
      }
      const label =
        awd === 'rear-biased-clutch'
          ? 'Front differential + clutch'
          : `${other === 'front' ? 'Front' : 'Rear'} differential`;
      diff(other, [otherX, wheelR, 0], 30, label);
      const propY = Math.min(wheelR, pt.crankYMm - env.heightMm * 0.25);
      shafts.push({
        id: `prop-${other}`,
        kind: 'prop',
        label: other === 'front' ? 'Front prop shaft' : 'Rear prop shaft',
        fromMm: [main === 'front' ? -120 : gbPos[0], propY, 0],
        toMm: [otherX + (other === 'rear' ? 150 : -150), wheelR, 0],
      });
    } else if (pt.gearbox === 'inline' && main !== 'rear') {
      throw new Error(`${v.id}: inline gearbox must drive the rear axle`);
    }

    parts.push(placeFuelTank(v, pt, parts));
  } else {
    const b = pt.battery;
    // the pack lies between the axles, clear of the wheels (trimmed if the spec's is longer)
    const front = -wheelR - 40;
    const rear = -L + wheelR + 40;
    const len = Math.min(b.lengthMm, front - rear);
    parts.push({
      id: 'battery',
      kind: 'battery',
      label: `Battery (${b.kWh} kWh)`,
      posMm: [clamp(b.xMm, rear + len / 2, front - len / 2), 120 + b.heightMm / 2, 0],
      sizeMm: [len, b.heightMm, b.widthMm],
      yawDeg: 0,
      rollDeg: 0,
      kg: b.massKg,
    });
    for (const { motor, axle } of pt.motors) {
      const m = getMotor(motor);
      const pos: Vec3 = [axleX(axle), wheelR, 0];
      parts.push({
        id: `motor-${axle}`,
        kind: 'motor',
        label: `${axle === 'front' ? 'Front' : 'Rear'} drive unit (${m.name})`,
        posMm: pos,
        sizeMm: [m.lengthMm, m.diameterMm, m.diameterMm],
        yawDeg: -90,
        rollDeg: 0,
        kg: m.massKg,
        axle,
        driven: true,
      });
      halfShafts(axle, pos);
    }
  }

  return { parts, shafts, wheelRadiusMm: wheelR };
}

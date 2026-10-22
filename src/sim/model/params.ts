/**
 * Everything the handling model needs, derived from one VehicleSpec. Mass, CG and yaw inertia
 * come from massProps(); tyres, tracks and the drivetrain from the spec. The few chassis numbers
 * a spec doesn't carry (roll-stiffness split, steering compliance, brake balance) follow ONE rule
 * for every car, so differences between cars come from their layout, not from per-car tuning.
 */
import { getEngine, getMotor } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { layoutCode } from '../../spec/describe';
import type { AwdKind, BodyStyle, VehicleSpec } from '../../spec/types';
import { awdParams, type AwdParams } from './awd';

export const G = 9.81;
const RHO_AIR = 1.2;
export const DRIVELINE_EFF = 0.88;
/** Engine friction against the Barnes-Moss correlation (overrun.ts): it was fitted to 1980s
 *  engines, and modern ones (roller followers, low-tension rings, thin oil) run about 30% less. */
export const FRICTION_MODERN = 0.7;
/** ~ a Wankel's mechanical friction against a piston engine's: no valvetrain, no piston rings */
const ROTARY_FRICTION = 0.6;
/** Road speed at the top of first gear (m/s), generic: it caps launch force by engine torque. */
const FIRST_GEAR_TOP = 15;

export interface AxleParams {
  /** longitudinal position from the CG (m): front +a, rear −b */
  x: number;
  track: number;
  /** nominal (design) load of one tyre (N); grows with tyre width */
  fz0: number;
  mu: number;
  /** share of the total lateral load transfer this axle takes (roll-stiffness distribution) */
  rollShare: number;
  /** share of the braking force */
  brakeShare: number;
  /** extra slip angle per newton of axle lateral force (rad/N): steering/bush compliance */
  compliance: number;
  driven: boolean;
  /** cap on the drive force this axle's motor can deliver (N per (m/s) above the power knee):
   *  only EVs have per-axle motors; Infinity otherwise */
  motorKw: number;
  motorForceN: number;
}

export interface DriveParams {
  kind: 'ice' | 'ev';
  /** nominal share of drive force sent to the front axle (0 = RWD, 1 = FWD) */
  frontShare: number;
  awd: AwdKind | null;
  /** the combustion AWD device (centre diff, clutch…); EVs with a motor per axle have none:
   *  their controller moves what one axle can't use to the other at once */
  device: AwdParams | null;
  /** wheel power (W) */
  powerW: number;
  /** low-speed force cap from engine/motor torque (N) */
  forceN: number;
  /** closed throttle, on the driven axles (overrun.ts): an EV's lift-off regen (N); 0 for an
   *  engine, whose braking follows from the two fields below */
  regenN: number;
  /** volume the engine sweeps per crank revolution (m³): half a four-stroke's displacement, all
   *  of a rotary's per eccentric-shaft turn; 0 for an EV */
  sweptPerRev: number;
  /** the engine's friction as a multiple of the Barnes-Moss correlation; 0 for an EV */
  fmepScale: number;
  /** locking factor of the axle differentials (0 = open, 1 = spool) */
  lsd: number;
  idleRpm: number;
  redlineRpm: number;
  /** overall ratio wheel → engine/motor in the lowest gear */
  lowRatio: number;
  gears: number;
}

export interface CarParams {
  id: string;
  name: string;
  /** "FF", "FR", "MR", "RR", "EV-AWD"… */
  layout: string;
  m: number;
  izz: number;
  /** CG to front axle, CG to rear axle, wheelbase (m) */
  a: number;
  b: number;
  L: number;
  /** CG height (m) */
  h: number;
  front: AxleParams;
  rear: AxleParams;
  wheelRadius: number;
  drive: DriveParams;
  /** brake force at full pedal before ABS (N) */
  brakeN: number;
  /** aero drag factor: F = drag·V² (N·s²/m²) */
  drag: number;
  crr: number;
  steerMax: number;
  /** body roll / pitch per m/s² (rad·s²/m) for the visual pose */
  rollGain: number;
  pitchGain: number;
  /** body-x offset from the CG to the wheelbase midpoint (m), the pose origin of the 3D car */
  poseOffset: number;
  dims: { length: number; width: number; height: number; overhangF: number };
}

/** Rule-of-thumb drag coefficients by body style (Cd); specs don't carry one. */
const CD: Record<BodyStyle, number> = {
  city: 0.34,
  hatch: 0.3,
  saloon: 0.27,
  estate: 0.29,
  coupe: 0.3,
  supercar: 0.34,
  roadster: 0.34,
  suv: 0.33,
  offroader: 0.54,
  fastback: 0.25,
};

/** Body roll stiffness relative to a saloon: sports cars are stiffer, off-roaders softer. */
const ROLL_SOFTNESS: Record<BodyStyle, number> = {
  city: 1.15,
  hatch: 1,
  saloon: 1,
  estate: 1,
  coupe: 0.7,
  supercar: 0.6,
  roadster: 0.8,
  suv: 1.25,
  offroader: 1.5,
  fastback: 0.9,
};

/** Full-pedal brake force (× m·g): enough that ABS, not the brakes, limits every car's stop
 *  (grippy road cars stop at ~1.3 g, slicks ~1.45 g). */
const BRAKE_FORCE_G = 1.7;
/** Deceleration (g) the fixed brake balance is ideal for: a hard stop on good summer tyres. */
const BRAKE_BALANCE_G = 1.1;

/** Same chassis rule for every car: the front axle takes its share of the weight, plus this,
 *  of the lateral load transfer (anti-roll bars set for mild understeer). */
export const ROLL_BIAS_FRONT = 0.05;
/** Steering + bush compliance (rad per N of front-axle side force): ~0.1° per kN. */
const STEER_COMPLIANCE = (0.1 * Math.PI) / 180 / 1000;
/** Reference tyre: a 225 mm tyre is designed for ~4 kN. */
export const FZ0_PER_MM = 4000 / 225;

export interface Tuning {
  /** no steering compliance, roll stiffness split = weight split: what the layout alone does */
  neutral?: boolean;
  /** the rear tyres' grip (μ) times this: the same car with more or less grip at the back
   *  (1 = as built) */
  rearGrip?: number;
}

export function carParams(v: VehicleSpec, tuning: Tuning = {}): CarParams {
  const mp = massProps(v);
  const m = mp.totalKg;
  const L = v.dims.wheelbaseMm / 1000;
  const a = -mp.cgMm[0] / 1000;
  const b = L - a;
  const h = mp.cgMm[1] / 1000;
  const pt = v.powertrain;
  const wheelRadius = v.tires.diameterMm / 2000;
  const tF = v.dims.trackFMm / 1000;
  const tR = v.dims.trackRMm / 1000;
  const drivenF = pt.driven !== 'rear';
  const drivenR = pt.driven !== 'front';

  // Brakes balanced for a BRAKE_BALANCE_G stop on every car (ideal distribution at that decel).
  const brakeF = Math.min(0.8, Math.max(0.5, (b + BRAKE_BALANCE_G * h) / L));
  const rollF = Math.min(0.75, Math.max(0.3, b / L + (tuning.neutral ? 0 : ROLL_BIAS_FRONT)));
  const compliance = tuning.neutral ? 0 : STEER_COMPLIANCE;

  let drive: DriveParams;
  let motorF = { kw: Infinity, n: Infinity };
  let motorR = { kw: Infinity, n: Infinity };
  const awd = pt.driven === 'all' ? (pt.awd ?? 'center-diff') : null;
  if (pt.kind === 'ice') {
    const e = getEngine(pt.engine);
    const device = awd ? awdParams(v) : null;
    const redline = (e.redlineRpm * 2 * Math.PI) / 60;
    const lowRatio = (redline * wheelRadius) / FIRST_GEAR_TOP;
    drive = {
      kind: 'ice',
      frontShare: pt.driven === 'front' ? 1 : pt.driven === 'rear' ? 0 : (device?.base ?? 0.5),
      awd,
      device,
      powerW: e.powerKw * 1000 * DRIVELINE_EFF,
      forceN: (e.torqueNm * lowRatio * DRIVELINE_EFF) / wheelRadius,
      // engine braking follows from the engine's size and speed (overrun.ts)
      regenN: 0,
      sweptPerRev: (e.displacementCc * 1e-6) / (e.family === 'rotary' ? 1 : 2),
      fmepScale: FRICTION_MODERN * (e.family === 'rotary' ? ROTARY_FRICTION : 1),
      lsd: 0.4,
      idleRpm: e.idleRpm,
      redlineRpm: e.redlineRpm,
      lowRatio,
      gears: 7,
    };
  } else {
    const axleMotor = (axle: 'front' | 'rear') => {
      const ms = pt.motors.filter((x) => x.axle === axle).map((x) => getMotor(x.motor));
      if (!ms.length) return { kw: 0, n: 0 };
      return {
        kw: ms.reduce((s, x) => s + x.peakKw, 0) * 1000 * DRIVELINE_EFF,
        n: ms.reduce((s, x) => s + (x.peakNm * x.reduction * DRIVELINE_EFF) / wheelRadius, 0),
      };
    };
    motorF = axleMotor('front');
    motorR = axleMotor('rear');
    const powerW = motorF.kw + motorR.kw;
    const first = getMotor(pt.motors[0].motor);
    drive = {
      kind: 'ev',
      frontShare:
        pt.driven === 'front'
          ? 1
          : pt.driven === 'rear'
            ? 0
            : (pt.frontTorqueShare ?? motorF.kw / Math.max(1, powerW)),
      awd,
      device: null,
      powerW,
      forceN: motorF.n + motorR.n,
      // lift-off regen, a stated default: kept modest because the model has no regen cut when
      // the driven wheels slip, as real EVs have (0.15 g spins a Model 3 RWD on a lift)
      regenN: 0.12 * m * G,
      sweptPerRev: 0,
      fmepScale: 0,
      lsd: 0.4,
      idleRpm: 0,
      redlineRpm: first.maxRpm,
      lowRatio: first.reduction,
      gears: 1,
    };
  }

  const axle = (
    x: number,
    track: number,
    widthMm: number,
    rollShare: number,
    brakeShare: number,
    compliance: number,
    driven: boolean,
    motor: { kw: number; n: number },
    grip = 1,
  ): AxleParams => ({
    x,
    track,
    fz0: FZ0_PER_MM * widthMm,
    mu: v.tires.mu * grip,
    rollShare,
    brakeShare,
    compliance,
    driven,
    motorKw: motor.kw,
    motorForceN: motor.n,
  });

  const style = v.body.style;
  const tAvg = (tF + tR) / 2;
  // ~3.2°/g for a 0.5 m CG on a 1.55 m track; scales with CG height over track
  const rollDegPerG = 3.2 * (h / 0.5) * (1.55 / tAvg) * ROLL_SOFTNESS[style];
  const pitchDegPerG = 1.5 * (h / 0.5) * (2.7 / L) * ROLL_SOFTNESS[style];
  const perMs2 = Math.PI / 180 / G;

  return {
    id: v.id,
    name: v.name,
    layout: layoutCode(v),
    m,
    izz: mp.izzKgM2,
    a,
    b,
    L,
    h,
    front: axle(a, tF, v.tires.widthFMm, rollF, brakeF, compliance, drivenF, motorF),
    rear: axle(
      -b,
      tR,
      v.tires.widthRMm,
      1 - rollF,
      1 - brakeF,
      0,
      drivenR,
      motorR,
      tuning.rearGrip ?? 1,
    ),
    wheelRadius,
    drive,
    brakeN: BRAKE_FORCE_G * m * G,
    drag: 0.5 * RHO_AIR * CD[style] * 0.84 * (v.dims.widthMm / 1000) * (v.dims.heightMm / 1000),
    crr: 0.012,
    steerMax: (32 * Math.PI) / 180,
    rollGain: rollDegPerG * perMs2,
    pitchGain: pitchDegPerG * perMs2,
    poseOffset: a - L / 2,
    dims: {
      length: v.dims.lengthMm / 1000,
      width: v.dims.widthMm / 1000,
      height: v.dims.heightMm / 1000,
      overhangF: v.dims.overhangFMm / 1000,
    },
  };
}

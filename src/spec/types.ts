/**
 * THE CONTRACT — shared by every module; change it deliberately (see docs/DEVELOPING.md).
 *
 * Units: specs are mm / kg / degrees / rpm / kW / Nm. The 3D scene is metres (see units.ts).
 *
 * Vehicle frame: +X forward, +Y up, +Z right (driver's view). Origin on the ground at the
 * front-axle centre; the rear axle sits at x = -wheelbase.
 *
 * Engine-local frame: crank axis along X with +X toward the timing (front) end and -X toward
 * the flywheel/output; +Y up for an upright cylinder; +Z right when +X faces forward.
 * Origin on the crank axis, mid-way along the cylinder span.
 *
 * Crank convention: the crank turns clockwise when viewed from the timing end (as almost all
 * production engines do). The pin of cylinder i sits at angle psi = throwDeg - crankDeg,
 * measured in the YZ plane from +Y toward +Z. A cylinder whose bank is tilted tiltDeg (from
 * +Y toward +Z) is at TDC when psi = tiltDeg. A 4-stroke cycle is 720 crank degrees; crankDeg
 * runs 0..720 and cylinder i fires (TDC, power stroke) at crankDeg = fireDeg.
 * Builders derive throwDeg = tiltDeg + fireDeg (mod 360) so specs are always self-consistent.
 */

export type Vec3 = [number, number, number];

// ─────────────────────────────── Engines ───────────────────────────────

export type EngineFamily = 'inline' | 'v' | 'flat' | 'vr' | 'w' | 'rotary';

export interface BankDef {
  /** Cylinder-axis angle from vertical, toward +Z (right) is positive. V8: ±45, boxer: ±90. */
  tiltDeg: number;
  /** Cylinder head index. VR banks share one head; V/flat banks have one each. */
  head: number;
}

export interface CylinderDef {
  /** Cylinder number as the manufacturer counts it (1-based); index in the array is number-1. */
  num: number;
  bank: number;
  /** Position along the crank axis (mm, engine frame; + toward timing end). */
  axialMm: number;
  /** Crank pin index; cylinders on a shared pin (V engines) have the same pin. */
  pin: number;
  /** Derived: crank-pin angle (deg) — see the crank convention above. */
  throwDeg: number;
  /** Derived: crank angle (0..720) at which this cylinder fires. */
  fireDeg: number;
}

export interface TurboSoundParams {
  count: number;
  /** rpm where boost starts building */
  spoolRpm: number;
  /** compressor shaft speed at full boost, thousands of rpm (whine pitch) */
  maxShaftKrpm: number;
  bov: boolean;
  /** Known for anti-lag (rally heritage). Informational: the sound panel offers anti-lag on
   *  every turbo engine and always starts with it off. */
  antiLag: boolean;
}

/** Acoustic parameters for the engine synth (WP4). */
export interface EngineSoundParams {
  /** Primary (header) pipe length per cylinder in mm, or one value for equal-length headers. */
  headerMm: number | number[];
  /** How the primaries merge before the muffler. */
  collector: 'single' | 'per-bank' | 'crossover';
  collectorMm: number;
  mufflerMm: number;
  tailpipeMm: number;
  /** 0..1 levels of the three sources. */
  mix: { exhaust: number; intake: number; mechanical: number };
  /** Hint for tuning by ear; not used by the DSP directly. */
  character: 'smooth' | 'burble' | 'shriek' | 'rumble' | 'warble' | 'howl' | 'thrum' | 'whoosh';
  turbo?: TurboSoundParams;
  /**
   * How the silencer voices the exhaust, where a recording of the real car shows it departs from
   * the default: cutoffHz is the can's low-pass corner (default 600 for a 500 mm muffler) and
   * poles how steeply it rolls off above it (1 = 6, 2 = 12 dB/oct; default 1); leak the share of
   * the highs a straight-through core lets past it (0..1, default 0.45); lowHz the frequency below
   * which the pipe radiates ever less (+6 dB/oct; default 300, lower for a big-bore pipe).
   */
  muffler?: { cutoffHz: number; leak: number; poles?: 1 | 2; lowHz?: number };
}

/** Optional geometry hints for the 3D generator and envelope(); sensible defaults otherwise. */
export interface EngineGeometryHints {
  compressionHeightMm?: number;
  headHeightMm?: number;
  sumpDepthMm?: number;
  /** Dry-sump engines sit lower (supercar V8/V10/V12, 911 GT). */
  drySump?: boolean;
}

export type Induction = 'na' | 'turbo' | 'twin-turbo' | 'quad-turbo' | 'supercharged';

/**
 * A Wankel port: an opening in the side housings ('side') or through the rotor housing's
 * trochoid surface ('peripheral'). Timing is in e-shaft degrees of one rotor face's cycle
 * (see RotaryDef): 0 combustion TDC · 270 BDC · 540 TDC (exhaust → intake) · 810 BDC · 1080.
 */
export interface RotaryPort {
  kind: 'intake' | 'exhaust';
  location: 'side' | 'peripheral';
  /** "primary", "secondary", "auxiliary"… as the maker names them */
  name: string;
  /** openings of this port per rotor */
  perRotor: number;
  openDeg: number;
  closeDeg: number;
}

/**
 * Wankel geometry (family 'rotary'). Each rotor is one entry of `cylinders`: axialMm is the
 * rotor centre on the eccentric (e-)shaft, throwDeg its eccentric lobe (crank-pin convention),
 * fireDeg its first firing; it fires again every 360° because one of its three faces reaches
 * combustion TDC each e-shaft turn (the rotor turns at 1/3 shaft speed). Each face runs a full
 * four-phase cycle in 1080° of shaft. The bank's tiltDeg is the side of the spark plugs, where
 * a face is at combustion TDC. The housing's long (major) axis is the engine's Y axis.
 *
 * The piston fields hold stand-ins so generic code stays finite: boreMm = rotor width,
 * strokeMm = 2e (the eccentric's throw), rodMm = R, borePitchMm = rotor pitch.
 */
export interface RotaryDef {
  /** R: rotor centre → apex tip, the trochoid's generating radius (mm) */
  generatingRadiusMm: number;
  /** e: e-shaft axis → rotor centre (mm) */
  eccentricityMm: number;
  /** rotor (and rotor-housing) width along the e-shaft (mm) */
  rotorWidthMm: number;
  /** side-housing thickness: front, intermediate and rear plates (mm) */
  sideHousingMm: number;
  /** sets the rotor-flank recess volume: V_min = displacement / (CR − 1) */
  compressionRatio: number;
  sparkPlugsPerRotor: number;
  ports: RotaryPort[];
}

export interface EngineSpec {
  id: string;
  name: string;
  family: EngineFamily;
  /** e.g. "90° V8, cross-plane crank" */
  layoutLabel: string;
  /** Real engines that use this layout, e.g. ["BMW B58", "Toyota 2JZ"]. */
  examples: string[];
  boreMm: number;
  strokeMm: number;
  rodMm: number;
  /** Axial distance between adjacent cylinders in one bank (mm). */
  borePitchMm: number;
  /** V/W included angle between banks (deg); 180 for flat, 0 for inline. */
  bankAngleDeg: number;
  banks: BankDef[];
  cylinders: CylinderDef[];
  /** 1-based cylinder numbers in firing sequence. */
  firingOrder: number[];
  displacementCc: number;
  /** 'ports': a rotary has no valves, its rotor flanks uncover the ports (valvesPerCyl 0). */
  valvetrain: { type: 'ohv' | 'sohc' | 'dohc' | 'ports'; valvesPerCyl: number };
  induction: Induction;
  idleRpm: number;
  redlineRpm: number;
  /** Representative installed mass incl. ancillaries (kg). */
  massKg: number;
  powerKw: number;
  torqueNm: number;
  geometry: EngineGeometryHints;
  sound: EngineSoundParams;
  /** Present exactly when family is 'rotary'. */
  rotary?: RotaryDef;
  /** Free-text notes for content: crank type, balance shafts, quirks. */
  notes?: string;
  /** Source/verification notes for the numbers (WP6). "~" means estimated. */
  source?: string;
}

export interface EvSoundParams {
  /** Motor pole pairs: electrical order = polePairs × shaft rpm. */
  polePairs: number;
  /** Inverter switching frequency (Hz) — the high whine. */
  inverterHz: number;
  /** Relative level of reduction-gear whine 0..1. */
  gearWhine: number;
}

export interface MotorSpec {
  id: string;
  name: string;
  kind: 'pmsm' | 'induction' | 'synchronous-reluctance';
  examples: string[];
  peakKw: number;
  peakNm: number;
  maxRpm: number;
  /** Single-speed reduction ratio (motor rpm / wheel rpm). */
  reduction: number;
  /** Drive-unit size: motor + reduction + diff + inverter (mm). */
  lengthMm: number;
  diameterMm: number;
  massKg: number;
  sound: EvSoundParams;
  source?: string;
}

// ─────────────────────────────── Vehicles ───────────────────────────────

export type EnginePos =
  'front-overhang' | 'front-mid' | 'mid' | 'rear-overhang' | 'rear-underfloor';
export type Orientation = 'longitudinal' | 'transverse';
export type GearboxKind =
  /** longitudinal, bolted behind the engine (classic FR) */
  | 'inline'
  /** transverse, on the end of a transverse engine (FF hot hatch) */
  | 'transverse-endon'
  /** at the rear axle, prop shaft from a front engine (GT-R, 812, AMG GT) */
  | 'rear-transaxle'
  /** combined with the rear diff next to a mid/rear engine (R8, F8, 911) */
  | 'mid-transaxle'
  /** EV single-speed reduction integrated in the drive unit */
  | 'ev-reduction';
export type Driven = 'front' | 'rear' | 'all';
export type AwdKind =
  /** Haldex-style clutch: normally FWD, rear on demand (Golf R, RS3) */
  | 'clutch-on-demand'
  /** mechanical centre diff (Torsen quattro, Subaru) */
  | 'center-diff'
  /** normally RWD, front clutch on demand (R8/Huracán, 911 4, GT-R) */
  | 'rear-biased-clutch'
  /** one motor per axle */
  | 'dual-motor'
  /** off-roader: transfer case with low range + locking centre/axle diffs (G-Class, Land Cruiser) */
  | 'transfer-case';

/** What actually splits the torque between the axles of an AWD car (see derive/awd.ts). */
export type AwdDeviceType =
  /** open centre diff: fixed split, the axle with less grip limits both */
  | 'open'
  /** torque-sensing gear diff (Torsen, crown gear): biases toward grip, up to its limits */
  | 'torque-sensing'
  /** planetary centre diff locked by a multi-plate clutch (Subaru DCCD, Mitsubishi ACD) */
  | 'locking-clutch'
  /** centre diff stiffened by a viscous coupling once the axles' speeds differ (Ferguson) */
  | 'viscous'
  /** no centre diff: one axle driven directly, a multi-plate clutch feeds the other */
  | 'clutch'
  /** no centre diff: a part-time transfer case locks both prop shafts together (4H) */
  | 'locked';

export interface AwdDevice {
  type: AwdDeviceType;
  /** trade name for labels ("DCCD", "GR-Four") */
  name?: string;
  /** front torque share the device can reach, [min, max] (0..1): a torque-sensing diff's bias
   *  limits, or how far a clutch can shift torque */
  frontRange?: [number, number];
  /** the driver can lock it rigid (centre-diff lock, DCCD manual) */
  lockable?: boolean;
}

export type ChassisKind =
  /** pressed-steel unibody (almost every road car) */
  | 'monocoque'
  /** separate ladder frame, body bolted on (G-Class, pickups, classic SUVs) */
  | 'ladder-frame'
  /** aluminium/steel space frame (Audi R8, Lotus Elise extruded tub) */
  | 'spaceframe'
  /** carbon-fibre tub (McLaren, many hypercars) */
  | 'carbon-tub';

export type SuspensionKind =
  | 'macpherson'
  | 'double-wishbone'
  | 'multilink'
  | 'twist-beam'
  | 'solid-axle'
  | 'trailing-arm'
  | 'pushrod';

export type Axle = 'front' | 'rear';

interface PowertrainBase {
  driven: Driven;
  awd?: AwdKind;
  /** Nominal front share of drive torque for AWD (0..1). */
  frontTorqueShare?: number;
  /** AWD: what splits the torque; defaults by `awd` kind (derive/awd.ts). */
  awdDevice?: AwdDevice;
}

export interface IcePowertrain extends PowertrainBase {
  kind: 'ice';
  /** EngineSpec id */
  engine: string;
  position: EnginePos;
  orientation: Orientation;
  /** Engine centre along X (vehicle frame, mm). Front axle = 0, rear axle = -wheelbase. */
  engineXMm: number;
  /** Crank-axis height above ground (mm). */
  crankYMm: number;
  /** Install rotation about the crank axis (deg) for laid-over or slanted engines. Longitudinal:
   *  + leans the top to the right (+Z), e.g. BMW's M30 at 30°. Transverse: + leans the top
   *  rearward, e.g. VW's MQB engines at 12° and the Smart ForTwo's triple at ~49°. */
  engineTiltDeg?: number;
  gearbox: Exclude<GearboxKind, 'ev-reduction'>;
  /** Transverse engines: which side the gearbox sits on (default left). */
  gearboxSide?: 'left' | 'right';
  gearboxKg?: number;
  fuelTank: { litres: number; xMm: number };
}

export interface EvPowertrain extends PowertrainBase {
  kind: 'ev';
  motors: { motor: string; axle: Axle }[];
  battery: {
    kWh: number;
    massKg: number;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    xMm: number;
  };
}

export type Powertrain = IcePowertrain | EvPowertrain;

export type BodyStyle =
  | 'city'
  | 'hatch'
  | 'saloon'
  | 'estate'
  | 'coupe'
  | 'supercar'
  | 'roadster'
  | 'suv'
  | 'offroader'
  | 'fastback';

/**
 * Coarse side-profile stations for the procedural body shell (WP3 may propose more).
 * All x values in vehicle frame (mm), heights above ground (mm).
 */
export interface BodyProfile {
  style: BodyStyle;
  tail: 'hatch' | 'notch' | 'fastback' | 'engine-deck';
  bonnetHMm: number;
  beltHMm: number;
  /** windscreen base */
  cowlXMm: number;
  roofFrontXMm: number;
  roofRearXMm: number;
  tailHMm: number;
  /** Exterior paint (hex), e.g. the car's signature colour. */
  paint?: string;
  /** 'procedural' (default) or a glTF shell (WP9). */
  provider?: 'procedural' | 'gltf';
  gltf?: { url: string; credit: string };
}

export interface ComponentMass {
  id: string;
  label: string;
  kg: number;
  /** centre position, vehicle frame (mm) */
  posMm: Vec3;
  /** box size for its own yaw inertia (mm): [length X, height Y, width Z] */
  sizeMm?: Vec3;
}

export interface VehicleSpec {
  id: string;
  name: string;
  archetype: string;
  /** Real cars this archetype stands for, e.g. ["Porsche 911 (992)"]. */
  examples: string[];
  dims: {
    wheelbaseMm: number;
    trackFMm: number;
    trackRMm: number;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    overhangFMm: number;
  };
  tires: { widthFMm: number; widthRMm: number; diameterMm: number; mu: number };
  body: BodyProfile;
  /** Free engine-bay envelope used by the fit check (mm): across the car × along it. */
  bay: { widthMm: number; lengthMm: number };
  powertrain: Powertrain;
  /** Default 'monocoque'. */
  chassis?: ChassisKind;
  suspension?: { front: SuspensionKind; rear: SuspensionKind };
  /** Model years, for classics, e.g. "1980–1991". */
  years?: string;
  seats: { layout: '2' | '2+2' | '4' | '5' | '7'; rows: number };
  luggageL: { front?: number; rear?: number };
  /**
   * Where the remaining (body, interior, chassis) mass sits, as a fraction of the wheelbase
   * behind the front axle. Kept within 0.40..0.60 — powertrain placement must do the real work.
   */
  bodyCgFrac: number;
  /** Extra point masses beyond what massProps derives (spare wheel, 12 V battery…). */
  extraMasses?: ComponentMass[];
  published: { curbKg: number; frontPct: number; source: string };
  blurb?: string;
}

// ─────────────────────────────── Derived ───────────────────────────────

export interface FiringEvent {
  /** 0-based cylinder index */
  cyl: number;
  /** crank angle 0..720 */
  deg: number;
}

export interface EngineEnvelope {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  /** bounding box in engine-local frame (mm) */
  min: Vec3;
  max: Vec3;
}

export interface BalanceOrder {
  /** Peak free force, in units of one cylinder's peak force of this order. */
  force: number;
  /** Peak free couple, in units of (one cylinder's peak force × bore pitch). */
  couple: number;
  /** True when the vector keeps ~constant magnitude and rotates — cancellable by a counterweight
   *  (1st order) or a pair of balance shafts (2nd order). */
  forceRotating: boolean;
  coupleRotating: boolean;
}

export interface BalanceReport {
  primary: BalanceOrder;
  secondary: BalanceOrder;
}

export type PartKind =
  'engine' | 'gearbox' | 'diff' | 'coupling' | 'motor' | 'battery' | 'fuel-tank' | 'wheel';

/** A powertrain component placed in the vehicle frame by layoutPowertrain(). */
export interface PlacedPart {
  id: string;
  kind: PartKind;
  label: string;
  /** Where the part's local origin sits (vehicle frame, mm). Engines: the crank-axis centre
   *  (engine-local origin); everything else: the centre of its box. */
  posMm: Vec3;
  /** local box size (mm): [along local X, Y, Z] */
  sizeMm: Vec3;
  /** Box centre relative to the local origin (local frame, mm); only engines have one. */
  boxOffsetMm?: Vec3;
  /** rotation about +Y (deg, three.js rotation.y sense) taking the part's local +X into the
   *  vehicle frame. Engines: local +X = timing end. 0 = timing end forward, -90 = timing end right. */
  yawDeg: number;
  /** rotation about the part's own local X after yaw (deg), e.g. laid-over engines */
  rollDeg: number;
  kg: number;
  axle?: Axle;
  driven?: boolean;
}

export interface Shaft {
  id: string;
  kind: 'prop' | 'half';
  label: string;
  fromMm: Vec3;
  toMm: Vec3;
  axle?: Axle;
}

export interface PowertrainLayout {
  parts: PlacedPart[];
  shafts: Shaft[];
  wheelRadiusMm: number;
}

export interface MassProps {
  totalKg: number;
  /** centre of gravity, vehicle frame (mm) */
  cgMm: Vec3;
  /** front axle share of static load, 0..100 */
  frontPct: number;
  /** yaw moment of inertia about the CG (kg·m²) */
  izzKgM2: number;
  components: ComponentMass[];
}

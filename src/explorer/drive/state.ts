/**
 * Drive-mode settings (hub ⇄ scene, and what a tour sets), the layout families its comparisons
 * are picked from, and the live telemetry/playback the scene writes every frame for the HUD.
 * Telemetry and playback are plain mutable objects on purpose: the HUD polls them on animation
 * frames instead of re-rendering React 60×/s.
 */
import { create } from 'zustand';
import { getEngine, getMotor, listVehicles, findVehicle } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { HUB_ORDER, SCENARIOS, type Mark, type ScenarioId } from '../../sim/scenarios';
import { REF_LATERAL_LIMIT } from '../../sim/model';
import type { VehicleSpec } from '../../spec/types';
import { VERDICTS, type Verdict } from './freeze';
import type { KeyMoment } from './key';
import type { CompareKind } from './versus';

// ── layout families ─────────────────────────────────────────────────────────────────────
export type Family = 'FF' | 'FR' | 'MR' | 'RR' | 'AWD' | 'EV';
export const FAMILIES: Family[] = ['FF', 'FR', 'MR', 'RR', 'AWD', 'EV'];

/** Each layout in plain words (no codes in the drive HUD). */
export const FAMILY_WORDS: Record<Family, string> = {
  FF: 'Front-drive',
  FR: 'Front engine, rear-drive',
  MR: 'Mid-engine',
  RR: 'Rear-engine',
  AWD: 'All-wheel drive',
  // electric isn't a layout: where its mass is (the battery) and which wheels it drives are
  EV: 'Battery in the floor',
};

/** Electric first, then all-wheel drive (wherever the engine is), then engine position. */
export function familyOf(v: VehicleSpec): Family {
  const pt = v.powertrain;
  if (pt.kind === 'ev') return 'EV';
  if (pt.driven === 'all') return 'AWD';
  const pos = pt.position;
  if (pos === 'mid') return 'MR';
  if (pos === 'rear-overhang' || pos === 'rear-underfloor') return 'RR';
  return pt.driven === 'front' ? 'FF' : 'FR';
}

const kwPerTonne = (v: VehicleSpec) => {
  const pt = v.powertrain;
  const kw =
    pt.kind === 'ice'
      ? getEngine(pt.engine).powerKw
      : pt.motors.reduce((s, m) => s + getMotor(m.motor).peakKw, 0);
  return (1000 * kw) / massProps(v).totalKg;
};

/** Slick-shod race cars and off-roaders only stand in for their own kind; SUVs prefer SUVs. */
const special = (v: VehicleSpec) =>
  v.tires.kind === 'slick' ? 'race' : v.body.style === 'offroader' ? 'offroad' : '';
const tall = (v: VehicleSpec) => v.body.style === 'suv' || v.body.style === 'offroader';

const cache = new Map<string, VehicleSpec | null>();

/**
 * The car of layout `f` nearest to `like` in power-to-weight and mass, so a comparison differs
 * in layout rather than class (a GTI meets a 3 Series, not a Chiron). Picked from traits, never
 * from ids.
 */
export function representative(f: Family, like?: VehicleSpec): VehicleSpec | null {
  const key = `${f}|${like?.id ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  const ref = like
    ? { pw: kwPerTonne(like), kg: massProps(like).totalKg, sp: special(like), tall: tall(like) }
    : null;
  let best: VehicleSpec | null = null;
  let bestD = Infinity;
  for (const v of listVehicles()) {
    if (familyOf(v) !== f || v.id === like?.id) continue;
    const sp = special(v);
    // without a reference: an everyday road car of moderate power
    const d = ref
      ? Math.abs(Math.log(kwPerTonne(v) / ref.pw)) +
        0.5 * Math.abs(Math.log(massProps(v).totalKg / ref.kg)) +
        (sp === ref.sp ? 0 : 3) +
        (tall(v) === ref.tall ? 0 : 0.5)
      : Math.abs(Math.log(kwPerTonne(v) / 150)) + (sp ? 3 : 0) + (tall(v) ? 0.5 : 0);
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && v.id < best.id)) {
      best = v;
      bestD = d;
    }
  }
  cache.set(key, best);
  return best;
}

/** The car the visitor picked to drive against (the last of the URL's `vs`), if any. */
export function pickedRival(vs: readonly string[] | undefined): VehicleSpec | null {
  const id = vs?.at(-1);
  return id ? (findVehicle(id) ?? null) : null;
}

// ── settings ───────────────────────────────────────────────────────────────────────────
export const RATES = [1, 0.5, 0.25, 0.125] as const;
export type Rate = (typeof RATES)[number];
/** who drives the visitor's car: the scripted test driver, or the visitor (keys/touch) */
export type DriveMode = 'watch' | 'drive';
/** chase behind the car, or look straight down on the whole manoeuvre */
export type CameraMode = 'chase' | 'top';
/** car B as a see-through ghost on car A's own line (both start the same, one camera holds
 *  both, lines parting show directly), or a lane over */
export type LaneMode = 'same' | 'side';

export interface DriveSettings {
  scenario: ScenarioId;
  /** km/h per scenario (for a car of the reference grip), remembered while switching */
  speed: Record<ScenarioId, number>;
  /** what car A is compared with (car B): 'auto' = the question's suggestion (versus.ts); a
   *  visitor's choice stays put across questions where the question offers it */
  compare: CompareKind;
  mode: DriveMode;
  camera: CameraMode;
  lanes: LaneMode;
  playing: boolean;
  rate: Rate;
  /** slow down around each scenario's key moment by itself, until the visitor picks a rate */
  autoSlow: boolean;
  /** stop at the key moment and show cause next to effect */
  autoPause: boolean;
  esc: boolean;
  forces: boolean;
  /** the extra controls shown: pedals and revs, sound, stability control, rates */
  more: boolean;
  /** bump to restart the run */
  runId: number;
  /** a car chip asked for the car picker's sheet: the picker is mounted (out of sight) for it */
  picking: boolean;
  setScenario: (s: ScenarioId) => void;
  setSpeed: (kmh: number) => void;
  /** kept for the car picker, which calls it when a car is picked to drive against: nothing
   *  else is on the road to keep any more */
  keepStandIns: (car: VehicleSpec) => void;
  restart: () => void;
}

/**
 * The corner questions' speeds stop here (km/h, for a car of the reference grip): above about
 * 95% of the grip their outcomes flip from one km/h to the next, so the answer would hang on
 * the slider rather than on the layout. A straight stop or a swerve isn't near that edge.
 */
export const MAX_KMH = 65;

/** A question's speed range as the slider offers it (the corner questions capped). */
export function speedRange(id: ScenarioId): { min: number; max: number } {
  const { min, max } = SCENARIOS[id].speed;
  return SCENARIOS[id].radius ? { min, max: Math.max(min, Math.min(max, MAX_KMH)) } : { min, max };
}

/** A speed for a question, inside the range the slider offers (a saved one too). */
export function capKmh(id: ScenarioId, kmh: number): number {
  const { min, max } = speedRange(id);
  return Math.max(min, Math.min(max, kmh));
}

export const useDrive = create<DriveSettings>()((set, get) => ({
  // the first question of the progression
  scenario: HUB_ORDER[0],
  speed: Object.fromEntries(
    HUB_ORDER.map((id) => [id, capKmh(id, SCENARIOS[id].speed.def)]),
  ) as Record<ScenarioId, number>,
  compare: 'auto',
  mode: 'watch',
  camera: 'chase',
  lanes: 'same',
  playing: true,
  rate: 1,
  autoSlow: true,
  autoPause: true,
  esc: false,
  forces: false,
  more: false,
  runId: 0,
  picking: false,
  // the visitor's car B stays put from question to question; nothing else of the last lingers
  setScenario: (scenario) => {
    for (const c of driveCars) {
      c.status = 0;
      c.step = -1;
    }
    set({ scenario, playing: true });
  },
  setSpeed: (kmh) =>
    set({ speed: { ...get().speed, [get().scenario]: capKmh(get().scenario, kmh) } }),
  keepStandIns: () => {},
  restart: () => set({ runId: get().runId + 1, playing: true }),
}));

/** Marks too small to see are drawn this many times their size: the pictures' sideways
 *  distances (their scale bar says so) and the front wheels' angles in a catch. The timeline's
 *  magnifier chip says that marks are drawn larger; the cars' paths and turning are as driven. */
export const SHOWN = 5;
/**
 * The body's pitch, as drawn on both cars in every question: the load the driver moves between
 * the axles, seen the way everyone knows it (the nose dips on a lift or the brake, the tail
 * squats on the throttle). The body's own pitch is a fraction of a degree at a lift (about 0.2°)
 * and in a turn under the brake or the throttle (0.3° to 0.7°), so it is drawn PITCH_SHOWN times
 * deeper: about 3° at a lift, 4 to 7° in those turns. A straight stop pitches 1 to 3° of its own,
 * which that would make 20 to 50°: past PITCH_MAX it is drawn ever less deeper (tanh), so a stop
 * dips about 10°, and a deeper dip is still drawn the deeper of two.
 */
export const PITCH_SHOWN = 15;
export const PITCH_MAX = (10 * Math.PI) / 180;
/** A body pitch (rad) as drawn (PITCH_SHOWN, softly within PITCH_MAX). */
export const shownPitch = (rad: number) => PITCH_MAX * Math.tanh((PITCH_SHOWN * rad) / PITCH_MAX);
/** Opposite lock is a few degrees of road wheel: drawn SHOWN times larger on the cars' front
 *  wheels while catching a slide (never past a road wheel's full lock: shownSteer). */
export const STEER_SHOWN = SHOWN;
/** a road wheel drawn turned at most this far (rad), however far a spinning car's driver winds */
const STEER_DRAWN_MAX = (40 * Math.PI) / 180;
/** A road-wheel angle (rad) as drawn, `scale` times its size, within full lock. */
export const shownSteer = (rad: number, scale: number) =>
  Math.max(-STEER_DRAWN_MAX, Math.min(STEER_DRAWN_MAX, rad * scale));
/** What each question draws larger than life, besides every body's pitch (no longer shown on
 *  its own: the timeline's one chip covers them). */
export const SHOWN_WHAT: Partial<Record<ScenarioId, string>> = {
  braking: 'nose dip',
  catch: 'wheel angles',
};

/** Each question's short name, as the rail lists it (the full question is the card's title);
 *  the car view's lesson buttons name the ones they share the same way (panels/lessons.ts). */
export const SHORT_NAME: Record<ScenarioId, string> = {
  'lift-off': 'Lift mid-corner',
  'power-exit': 'Throttle on exit',
  catch: 'Catch a slide',
  'trail-brake': 'Brake to turn',
  braking: 'Load under braking',
  'left-foot': 'Left-foot braking',
  skidpad: 'Find the limit',
  'lane-change': 'Change direction',
};

/** Share of the reference car's grip a corner speed uses (grip-scaled scenarios), else null. */
export function gripShare(id: ScenarioId, kmh: number): number | null {
  const def = SCENARIOS[id];
  if (!def.radius) return null;
  return (kmh / 3.6) ** 2 / def.radius / REF_LATERAL_LIMIT;
}

// ── live telemetry and playback (scene → HUD) ──────────────────────────────────────────
export const driveTelemetry = {
  live: false,
  speedKmh: 0,
  latG: 0,
  yawDeg: 0,
  /** body slip: heading vs direction of travel (deg) */
  slipDeg: 0,
  /** axle slip angles (deg, magnitude) and how much of each axle's grip is in use (0..1+) */
  alphaF: 0,
  alphaR: 0,
  useF: 0,
  useR: 0,
  /** share of the weight on the front axle right now (0..1) */
  front: 0.5,
  /** −1 oversteer … 0 neutral … +1 understeer */
  balance: 0,
  throttle: 0,
  brake: 0,
  /** road-wheel angle (deg, + = into a left turn) */
  steerDeg: 0,
  /** the test driver is holding the wheel still on purpose (the scripted event window) */
  handsStill: false,
  gear: '1',
  rpm: 0,
  phase: 0,
  spun: false,
  /** bumped each time the scenario loops back to its start (the HUD fades the cut) */
  loops: 0,
  /** 0..1 cover over the scene around the loop cut (eases out before, back in after) */
  fade: 0,
};

/** What a car is doing right now: the step it is in before the
 *  cause, then the freeze frame's verdict (freeze.ts VERDICTS, offset by one). */
export const CAR_STATUS = ['step', ...VERDICTS] as const;

/** Per car on the road (0 = the visitor's, 1 = the comparison), written every frame. */
export const driveCars = [0, 1].map(() => ({
  /** index into CAR_STATUS */
  status: 0,
  /** how much tighter (+) or wider (-) it turns than before the cause (share) */
  turn: 0,
  /** the manoeuvre step it is in (index into its marks), −1 before the first */
  step: -1,
  /** share of the weight on the front axle (0..1) */
  front: 0.5,
  /** grip in use at each axle (0..1+) */
  useF: 0,
  useR: 0,
  /** the driver's hands and feet: the steering asked for (road-wheel deg, + = left; the same
   *  measure as the run's "opposite lock" summary) and the pedals (0..1) */
  steerDeg: 0,
  throttle: 0,
  brake: 0,
  /** which way the road turns where the car is (+1 left, −1 right, 0 straight) */
  turnSign: 0,
  /** where its driver is in the script: 0 before the action, 1 steering held, 2 correcting;
   *  −1 when the visitor drives it */
  phase: 0,
  /** its rear has let go (it shows) or it spun: steering out of the turn is catching a slide */
  slid: false,
  /** car B, the same car without the technique (its wheel is held for the whole test) */
  twin: false,
  /** when its part of the test is over (hands.ts testEnd), and whether that was a spin */
  over: Infinity,
  overSpun: false,
  /** what the car is called on the road ("911 Carrera S Cabriolet", "No catch") */
  name: '',
  /** its speed (km/h) */
  kmh: 0,
  /** share of the weight on the front axle just before its driver's action (0..1; NaN for none):
   *  the load arrow over its axles points from there */
  frontBefore: NaN,
}));

export const drivePlayback = {
  /** the playhead (s of sim time) and the run's length */
  t: 0,
  duration: 1,
  /** furthest the playhead may go: the live edge of a run the visitor is driving */
  head: 1,
  /** when the visitor's car reached the scenario's event (s), NaN before */
  eventT: NaN,
  /** a seek the HUD asks for (s); the scene takes it and sets null */
  seek: null as number | null,
  /** the manoeuvre's steps on the timeline: when the visitor's car got there (s, NaN before) */
  marks: [] as { t: number; label: string; kind: Mark['kind']; holdS?: number }[],
  /** the moment the scenario turns on, pinned on the timeline (null until known) */
  key: null as KeyMoment | null,
  /** playing slowed down by itself around the key moment right now */
  slow: false,
  /** the key moment playing again from above at the end of a run (the dashboard says so) */
  replaying: false,
  /** the playhead is in the key moment's window, through to the end of what it led to (the
   *  spin, the run wide, the catch): the drivers' hands show, both cars stay in frame */
  keyOn: false,
};

/** The key moment's stops in this run (s of sim time, ascending) and each car's verdict at each;
 *  the cars' tags speak from the first on (freeze.ts liveVerdict). */
export const drivePause = {
  t: [] as number[],
  verdicts: [] as Verdict[][],
};

/** Each car's verdict at the latest stop by time t (null before the first). */
export function pauseVerdict(t: number, car: number): Verdict | null {
  let v: Verdict | null = null;
  for (let i = 0; i < drivePause.t.length; i++)
    if (drivePause.t[i] <= t + 1e-6) v = drivePause.verdicts[i][car] ?? null;
  return v;
}

export function resetTelemetry() {
  drivePause.t = [];
  drivePause.verdicts = [];
  driveTelemetry.spun = false;
  drivePlayback.t = 0;
  drivePlayback.eventT = NaN;
  drivePlayback.key = null;
  drivePlayback.slow = false;
  for (const c of driveCars) {
    c.status = 0;
    c.step = -1;
  }
}

/**
 * Drive-mode settings (hub ⇄ scene, and what a tour sets), the lineup of cars it compares, and
 * the live telemetry/playback the scene writes every frame for the HUD. Telemetry and playback
 * are plain mutable objects on purpose: the HUD polls them on animation frames instead of
 * re-rendering React 60×/s.
 */
import { create } from 'zustand';
import { getEngine, getMotor, listVehicles, findVehicle } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { HUB_ORDER, SCENARIOS, type Mark, type ScenarioId } from '../../sim/scenarios';
import { REF_LATERAL_LIMIT } from '../../sim/model';
import type { VehicleSpec } from '../../spec/types';
import type { KeyMoment } from './key';

// ── layout families ─────────────────────────────────────────────────────────────────────
export type Family = 'FF' | 'FR' | 'MR' | 'RR' | 'AWD' | 'EV';
export const FAMILIES: Family[] = ['FF', 'FR', 'MR', 'RR', 'AWD', 'EV'];

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
  v.tires.mu > 1.15 ? 'race' : v.body.style === 'offroader' ? 'offroad' : '';
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

/** Shown when the visitor hasn't picked: every other combustion layout. */
const AUTO: Family[] = ['FF', 'FR', 'MR', 'RR', 'AWD'];

/** The stand-ins shown when the visitor hasn't picked: every other combustion layout. */
export const autoFamilies = (car: VehicleSpec): Family[] => AUTO.filter((f) => f !== familyOf(car));

/** Ghost entries may be vehicle ids (tours) or family codes (the hub). */
export function resolveGhosts(car: VehicleSpec, ghosts: string[] | null): VehicleSpec[] {
  const own = familyOf(car);
  const list = ghosts ?? AUTO.filter((f) => f !== own);
  const out: VehicleSpec[] = [];
  for (const g of list) {
    // a family code stands for another layout; the car's own is already on the road
    const v =
      findVehicle(g) ??
      (FAMILIES.includes(g as Family) && g !== own ? representative(g as Family, car) : null);
    if (v && v.id !== car.id && !out.some((o) => o.id === v.id)) out.push(v);
  }
  return out.slice(0, 5);
}

/**
 * Who runs alongside the visitor's car: the cars they picked to compare with (first, so never
 * dropped), then the layout stand-ins. Stand-ins default to every other layout, or to none when
 * cars were picked (a 911 compared with a Cayman drives against just the Cayman).
 */
export function lineupGhosts(
  car: VehicleSpec,
  ghosts: string[] | null,
  picked: readonly string[] = [],
): VehicleSpec[] {
  if (!picked.length) return resolveGhosts(car, ghosts);
  return resolveGhosts(car, [...picked, ...(ghosts ?? [])]);
}

/** The layout families whose stand-ins are on the road (not the picked cars'). */
export function standInFamilies(
  car: VehicleSpec,
  ghosts: string[] | null,
  picked: readonly string[] = [],
): Family[] {
  return lineupGhosts(car, ghosts, picked)
    .filter((v) => !picked.includes(v.id))
    .map(familyOf);
}

// ── settings ───────────────────────────────────────────────────────────────────────────
export const RATES = [1, 0.5, 0.25, 0.125] as const;
export type Rate = (typeof RATES)[number];
/** who drives the visitor's car: the scripted test driver, or the visitor (keys/touch) */
export type DriveMode = 'watch' | 'drive';
/** chase behind the car, or look straight down on the whole manoeuvre */
export type CameraMode = 'chase' | 'top';
/** what runs alongside: other layouts doing the same, or the same car without the technique */
export type Compare = 'layouts' | 'technique';

export interface DriveSettings {
  scenario: ScenarioId;
  /** km/h per scenario (for a car of the reference grip), remembered while switching */
  speed: Record<ScenarioId, number>;
  /** ghost cars: family codes or vehicle ids; null = every other layout */
  ghosts: string[] | null;
  compare: Compare;
  mode: DriveMode;
  camera: CameraMode;
  playing: boolean;
  rate: Rate;
  /** slow down around each scenario's key moment by itself, until the visitor picks a rate */
  autoSlow: boolean;
  esc: boolean;
  forces: boolean;
  /** bump to restart the run */
  runId: number;
  setScenario: (s: ScenarioId) => void;
  setSpeed: (kmh: number) => void;
  /** a layout stand-in on or off (`picked`: the cars the visitor chose, which stay) */
  toggleGhost: (car: VehicleSpec, f: Family, picked?: readonly string[]) => void;
  /** the default stand-ins become an explicit list, so picking a car keeps them on the road */
  keepStandIns: (car: VehicleSpec) => void;
  restart: () => void;
}

export const useDrive = create<DriveSettings>()((set, get) => ({
  // the first question of the progression
  scenario: HUB_ORDER[0],
  speed: Object.fromEntries(HUB_ORDER.map((id) => [id, SCENARIOS[id].speed.def])) as Record<
    ScenarioId,
    number
  >,
  ghosts: null,
  compare: 'layouts',
  mode: 'watch',
  camera: 'chase',
  playing: true,
  rate: 1,
  autoSlow: true,
  esc: false,
  forces: false,
  runId: 0,
  setScenario: (scenario) =>
    set({
      scenario,
      playing: true,
      // a scenario without a "without" twin compares layouts
      compare: SCENARIOS[scenario].baseline ? get().compare : 'layouts',
    }),
  setSpeed: (kmh) => set({ speed: { ...get().speed, [get().scenario]: kmh } }),
  toggleGhost: (car, f, picked = []) => {
    const now = standInFamilies(car, get().ghosts, picked);
    set({ ghosts: now.includes(f) ? now.filter((x) => x !== f) : [...now, f] });
  },
  keepStandIns: (car) => {
    if (get().ghosts === null) set({ ghosts: autoFamilies(car) });
  },
  restart: () => set({ runId: get().runId + 1, playing: true }),
}));

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
};

export function resetTelemetry() {
  driveTelemetry.spun = false;
  drivePlayback.t = 0;
  drivePlayback.eventT = NaN;
  drivePlayback.key = null;
  drivePlayback.slow = false;
}

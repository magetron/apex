/**
 * The freeze frame: at the key moment the run stops and, for both cars, shows the effect (a
 * top-down car: where it points against where it goes, or at a front that let go, where the
 * wheels point against where the nose goes; the angle between; and which end let go) next to
 * its cause: how much of each end's grip was in use just before the cause and now, against the
 * 100% line (the end that went past it let go), and the weight shift that put it there. Built
 * once from the recordings when the scene stops; the info card draws it.
 *
 * "Let go" here, on the road and on the info card is one signal: the lane's let-go (an axle
 * using all its grip for a moment, lanes.ts).
 */
import { create } from 'zustand';
import { axleUse, betaOf, createState, FL, frontLoadOf, RL, type CarState } from '../../sim/model';
import { FZ0_PER_MM } from '../../sim/model/params';
import { LINE_M } from '../../sim/scenarios/corner';
import { steadyCurvature } from '../../sim/scenarios/trail-brake';
import type { PathPoint, ScenarioId } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import type { KeyMoment } from './key';
import type { PathPicture } from './picture';
import { LET_GO_S, slidAt, type Lane, type LaneKind } from './lanes';

/**
 * What a car is doing in the frozen moment: an end let go (or it spun, or it was caught), or
 * it grips and its line tightened, widened or held; on a stop, its nose dipped; an end that
 * let go a while ago and grips again (the skidpad's second stop: the driver eased off).
 */
export const VERDICTS = [
  'front',
  'rear',
  'spun',
  'caught',
  'tighter',
  'wider',
  'holding',
  'dive',
  'back',
  'catching',
] as const;
export type Verdict = (typeof VERDICTS)[number];
/** the verdicts that mean an end let go (red, the one thing red means) */
export const LET_GO: readonly Verdict[] = ['front', 'rear', 'spun', 'catching'];

/** opposite lock that counts as the driver catching a slide (rad of steering input) */
const LOCK = (1 * Math.PI) / 180;

/** How far the driver's steering points out of the turn (rad, + = opposite lock) at time t. */
export function lockAt(lane: Lane, c: CarState, t: number): number {
  const k = lane.plan.path.at(lane.rec.sAtTime(t), bend).k;
  return Math.abs(k) < 1e-4 ? 0 : -c.steer * Math.sign(k);
}

export interface FreezeCar {
  kind: LaneKind;
  label: string;
  /** car B, the same car without the technique: its line is the normal one to compare with */
  twin?: boolean;
  /** it has slid by now, as its summary judges it (lanes.ts slidAt) */
  slid?: boolean;
  /** the question it stopped in (power out leads with where the nose points) */
  id?: ScenarioId;
  /** its share of the weight on the front wheels at rest (0..1; the layout chip's) */
  frontRest?: number;
  /** the front axle's share of its roll stiffness (the set-up that makes a road car push wide) */
  rollF?: number;
  vehicle?: VehicleSpec;
  /** heading vs direction of travel (deg; + = the car points left of where it goes) */
  pointsDeg: number;
  /** road-wheel angle, and the direction the front axle travels, against the heading (deg,
   *  + = left): their difference is how far the front is sliding */
  steerDeg: number;
  frontGoesDeg: number;
  verdict: Verdict;
  /** the end that let go by now, if one has */
  out: 'front' | 'rear' | null;
  /** how much tighter (+) or wider (−) it is turning than before the cause (share); braking
   *  in a turn (`sameSpeed`), than the same car at this speed without the brake */
  turn: number;
  sameSpeed: boolean;
  /** its turning circle now (m, the radius of the line it is on); braking in a turn, the same
   *  car's at this speed without the brake (NaN otherwise) */
  radius: number;
  refRadius: number;
  /** weight on the front axle just before the driver's action, and the furthest the action
   *  had moved it by then (as the first end let go, or so far) (0..1) */
  frontBefore: number;
  frontNow: number;
  /**
   * Grip in use at each end (0..1; 1 = all of it), as the let-go is decided: the least it used
   * over the let-go's window (LET_GO_S), so a number marked "let go" is the one that held its
   * limit that long. Before the cause, and then: when the first end let go, for a car that let
   * go; the most it held so far, for one that didn't (`at`).
   */
  useF0: number;
  useR0: number;
  useF: number;
  useR: number;
  at: 'let-go' | 'most';
  /** how far it points away from where it goes now (deg, magnitude): the angle drawn */
  swungDeg: number;
  /** …and the most it has since the driver's action: "swung N° so far" (the run's summary
   *  says "swung out N° at most" over the whole stretch) */
  swungMaxDeg: number;
  /** the most opposite lock the driver has used so far (deg; 0 for none): the front wheels
   *  steered out of the turn */
  lockMaxDeg: number;
  /** which way the road turns where the car is (+1 left, −1 right, 0 straight): steering the
   *  other way is opposite lock */
  turnSign: number;
  /** tyre widths (mm, from the spec) and the rear's grip against the car as built */
  tyreF: number;
  tyreR: number;
  rearGrip: number;
  /** which wheels the engine or motors drive */
  driven: 'front' | 'rear' | 'all';
}

export interface FreezeFrame {
  /** the question it stopped in */
  id: ScenarioId;
  /** sim time it stopped at */
  t: number;
  /** what happened there ("Lift", "Front lets go") */
  label: string;
  /** what leads the cause: each end's grip in use, or (a straight stop) the weight moving */
  cause: 'grip' | 'weight';
  cars: FreezeCar[];
  /** the corner questions: both paths so far, from above (picture.ts, `until` the stop) */
  pic?: PathPicture | null;
}

export const useFreeze = create<{ at: FreezeFrame | null }>()(() => ({ at: null }));

/** Carry on from a freeze frame. */
export function carryOn(play: () => void) {
  useFreeze.setState({ at: null });
  play();
}

const st = createState();
const DEG = 180 / Math.PI;
const bend: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
/** "before" is read just ahead of the cause, so the load hasn't started to move yet (s) */
export const LEAD = 0.15;
/** a line this much tighter or wider than before counts as changed */
const TURNED = 0.1;

/**
 * Grip a lane's axle held over the let-go window ending at time t: the least it used then
 * (0..1+), as the let-go latch (lanes.ts) decides.
 */
export function heldUse(lane: Lane, axle: typeof FL | typeof RL, t: number): number {
  const rec = lane.rec;
  if (!rec.count) return 0;
  const i1 = rec.indexAt(t);
  // the frames the latch counted: those inside the window (not the one just before it)
  const from = t - LET_GO_S + 0.002;
  let i0 = rec.indexAt(Math.max(0, from));
  if (i0 < i1 && rec.get(i0, 't') < from) i0++;
  let min = Infinity;
  for (let i = i0; i <= i1; i++) {
    rec.frame(i, held);
    min = Math.min(min, axleUse(held, axle));
  }
  return Number.isFinite(min) ? min : 0;
}
const held = createState();

/** The most grip an axle held (heldUse) between t0 and t1, every recorded frame. */
function mostHeld(lane: Lane, axle: typeof FL | typeof RL, t0: number, t1: number): number {
  const rec = lane.rec;
  if (!rec.count) return 0;
  let most = 0;
  for (let i = rec.indexAt(t0), n = rec.indexAt(t1); i <= n; i++)
    most = Math.max(most, heldUse(lane, axle, rec.get(i, 't')));
  return most;
}

/**
 * The share of the weight on the front axle furthest from `from` between t0 and t1, every
 * recorded frame: where the driver's action had moved it to by then (forward lifting or
 * braking, back on the throttle), not where it has drifted back to since.
 */
function mostMoved(lane: Lane, t0: number, t1: number, from: number): number {
  const rec = lane.rec;
  let most = from;
  for (let i = rec.indexAt(t0), n = rec.indexAt(t1); i <= n; i++) {
    rec.frame(i, held);
    const f = frontLoadOf(held);
    if (Math.abs(f - from) > Math.abs(most - from)) most = f;
  }
  return most;
}

const mean = { k: 0, v: 0 };
/** A lane's mean path curvature (1/m) and speed (m/s) between t0 and t1, every frame. */
function meanCurve(lane: Lane, t0: number, t1: number): { k: number; v: number } {
  const rec = lane.rec;
  let k = 0;
  let v = 0;
  let n = 0;
  for (let i = rec.indexAt(Math.max(0, t0)), m = rec.indexAt(t1); i <= m; i++) {
    rec.frame(i, held);
    k += curvature(held);
    v += Math.hypot(held.vx, held.vy);
    n++;
  }
  mean.k = n ? k / n : 0;
  mean.v = n ? v / n : 0;
  return { k: mean.k, v: mean.v };
}

/** A lane's mean steering (rad) between t0 and t1. */
function meanSteer(lane: Lane, t0: number, t1: number): number {
  const rec = lane.rec;
  let s = 0;
  let n = 0;
  for (let i = rec.indexAt(Math.max(0, t0)), m = rec.indexAt(t1); i <= m; i++) {
    s += rec.get(i, 'steer');
    n++;
  }
  return n ? s / n : 0;
}

const since = { swung: 0, lock: 0 };
/** The most a car swung (|body slip|, deg) and the most opposite lock its driver used (deg)
 *  between t0 and t1, every recorded frame. */
function mostSince(lane: Lane, t0: number, t1: number): { swung: number; lock: number } {
  const rec = lane.rec;
  since.swung = 0;
  since.lock = 0;
  if (!rec.count) return since;
  for (let i = rec.indexAt(t0), n = rec.indexAt(t1); i <= n; i++) {
    rec.frame(i, held);
    if (Math.hypot(held.vx, held.vy) > 1)
      since.swung = Math.max(since.swung, Math.abs(betaOf(held)));
    const turn = Math.sign(lane.plan.path.at(rec.sAt(i), bend).k);
    since.lock = Math.max(since.lock, -(held.steer - held.twist) * turn);
  }
  since.swung *= DEG;
  since.lock *= DEG;
  return { swung: since.swung, lock: since.lock };
}

/** A car that let go is back within its grip, pointing where it goes again. */
export const backInGrip = (c: CarState) =>
  Math.max(axleUse(c, FL), axleUse(c, RL)) < 0.95 && Math.abs(betaOf(c)) < (3 * Math.PI) / 180;

/** How tightly a car is turning: path curvature (1/m). */
export const curvature = (c: CarState) => c.r / Math.max(1, Math.hypot(c.vx, c.vy));

/**
 * Where a lane's line is heading, inside (+) or wide of its reference (m), measured exactly as
 * its summary measures it (the plan's own summary of the recording) as its held wheel ends:
 * against where the driver aimed; braking into a turn, against its own line at the same speed
 * without the brake. The freeze card's "tighter" or "wider" is this, so the two never disagree.
 */
export function lineBy(id: ScenarioId, lane: Lane): number {
  const v = lane.plan.summarize(lane.rec.toTrace(2), lane.p).values;
  return (id === 'trail-brake' || id === 'left-foot' ? v.sameSpeedShift : v.exitErr) ?? 0;
}

export interface Judged {
  verdict: Verdict;
  turn: number;
}

/**
 * What a car in state `c` at time t is doing (the freeze frame's verdict, and the info card's
 * live line once the cause has begun): an end let go, or it spun, or (catching a slide) it
 * was caught; else whether its line tightened or widened from `k0`, the curvature it was on
 * before the cause; on a stop, whether its nose dipped.
 */
export function judge(
  id: ScenarioId,
  lane: Lane,
  c: CarState,
  t: number,
  k0: number,
  out: Judged,
): Judged {
  out.turn = Math.abs(k0) > 1e-3 ? curvature(c) / k0 - 1 : 0;
  out.verdict = verdictOf(id, lane, c, t, out.turn);
  return out;
}

function verdictOf(id: ScenarioId, lane: Lane, c: CarState, t: number, turn: number): Verdict {
  if (c.spun) return 'spun';
  // a let-go counts once it shows (lanes.ts SHOWN_DEG): never "let go" at 0°
  const lg = lane.letGoBy(t);
  if (lg) {
    // a slide that was caught (or that eased off by itself): back within grip, pointing where
    // it goes again; never "let go" with the angle back at nothing
    if (backInGrip(c)) return id === 'catch' ? 'caught' : 'back';
    // the driver steering out of the turn, into the slide: catching it
    if (id === 'catch' && lockAt(lane, c, t) > LOCK) return 'catching';
    return lg.axle;
  }
  // a straight stop works every tyre at its limit (ABS): nothing is sliding sideways
  if (id === 'braking') return c.pitch < 0 ? 'dive' : 'holding';
  // on a circle of rising speed, or a swerve, the line tells nothing about a cause
  if (id === 'skidpad' || id === 'lane-change') return 'holding';
  if (turn > TURNED) return 'tighter';
  if (turn < -TURNED) return 'wider';
  return 'holding';
}

/**
 * The one angle a car's freeze card shows, the icon's and the text's alike (rounded deg): how
 * far it points away from where it goes; at a front that let go, how far the front tyres slide.
 */
export function freezeAngle(c: FreezeCar): number {
  if (c.out === 'front' && c.verdict === 'front' && c.id !== 'power-exit')
    return Math.round(Math.abs(c.steerDeg - c.frontGoesDeg));
  return Math.round(Math.abs(c.pointsDeg));
}

/** What car B leaves out, where it is the same car without the driver's action. */
const LEFT_OUT: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'No lift: the same car, its throttle held',
  'power-exit': 'No throttle: the same car, its speed held',
  'trail-brake': 'No brake: the same car at car A’s speed',
  'left-foot': 'No brake: the same car at car A’s speed',
  catch: 'No catch: the same car, its hands held still',
};

/** Which end decided how a car is doing at the stop, or how its line moved (power out: a nose
 *  turned in from its path is its rear stepping out, as its words say). */
function endOf(c: FreezeCar): 'front' | 'rear' | 'tighter' | 'wider' | 'holding' {
  if (c.verdict === 'spun' || c.verdict === 'catching' || c.verdict === 'caught') return 'rear';
  if (c.id === 'power-exit' && c.pointsDeg * c.turnSign > 0 && Math.abs(c.pointsDeg) >= 2)
    return 'rear';
  if (c.out) return c.out;
  if (c.verdict === 'front' || c.verdict === 'rear') return c.verdict;
  if (c.verdict === 'tighter' || c.verdict === 'wider') return c.verdict;
  return 'holding';
}

/**
 * Why a car is doing what it does at the stop, in one plain line from its own numbers: how much
 * of its weight the driver's action moved (the same measure for every car: the share on the
 * front tyres, before → now), onto or off the end that decided it, and what else pulls on that
 * end (engine braking, drive, braking). Car B without the action says what it leaves out.
 */
export function causeText(c: FreezeCar): string {
  if (c.twin) return (c.id && LEFT_OUT[c.id]) ?? '';
  const d = c.frontNow - c.frontBefore;
  const n = Math.round(100 * Math.abs(d));
  const pct = n < 1 ? 'under 1%' : `${n}%`;
  const end = endOf(c);
  const both = c.driven === 'all';
  switch (c.id) {
    case 'lift-off':
    case 'catch': {
      // the lift moves load forward, and engine braking pulls on the driven tyres
      if (end === 'rear')
        return `Lifting took ${pct} of its weight off the rear tyres${
          c.driven === 'rear'
            ? ', and engine braking pulls on them'
            : both
              ? ', and engine braking pulls on all four'
              : ''
        }`;
      if (end === 'front')
        return `Lifting moved ${pct} of its weight onto the front tyres${
          c.driven === 'front' ? ', but engine braking pulls on them' : ''
        }`;
      return `Lifting moved ${pct} of its weight onto the front tyres${
        end === 'tighter' ? ': they bite harder, the nose turns in' : ''
      }`;
    }
    case 'power-exit': {
      // the throttle moves load back, and asks the driven tyres for drive on top of cornering
      if (end === 'rear' && c.driven !== 'front')
        return `The throttle asks ${both ? 'all four' : 'its rear'} tyres for drive on top of cornering`;
      if (end === 'front' || end === 'wider')
        return c.driven === 'front'
          ? `The throttle asks its front tyres for drive on top of cornering, and took ${pct} of its weight off them`
          : `The throttle took ${pct} of its weight off its front tyres${both ? ', which drive too' : ''}`;
      return `The throttle moved ${pct} of its weight onto the rear tyres`;
    }
    case 'trail-brake':
    case 'left-foot': {
      if (end === 'rear') return `Braking took ${pct} of its weight off the rear tyres`;
      if (end === 'front' || end === 'wider')
        return `Braking asks its front tyres to slow the car as well as turn it`;
      return `Braking moved ${pct} of its weight onto the front tyres${
        end === 'tighter' ? ': they bite harder, the nose turns in' : ''
      }`;
    }
    case 'skidpad': {
      // round a circle nothing moves weight front to rear: which end goes first is how much
      // of the load moved across each end takes, against its share of the weight (or a twin's
      // weaker rear)
      const less = Math.round(100 * (1 - c.rearGrip));
      if (less > 0) return `Its rear tyres have ${less}% less grip`;
      if (less < 0) return `Its rear tyres have ${-less}% more grip`;
      const r = Math.round(100 * (c.rollF ?? 0));
      const w = Math.round(100 * (c.frontRest ?? 0));
      return r > w
        ? `Its front takes a bigger share of the load moved across in a turn (${r}%) than of its weight (${w}%)`
        : `Its front takes no bigger share of the load moved across in a turn (${r}%) than of its weight (${w}%)`;
    }
    case 'braking':
      return `Braking moved ${pct} of its weight onto the front tyres`;
    default:
      return '';
  }
}

/**
 * What a car is doing at the stop, in words: the state, and the icon's angle where it matters
 * (the summary at the end gives the run's own numbers, so nothing here can disagree with it).
 */
export function stateText(c: FreezeCar): { head: string; angle: string } {
  const a = freezeAngle(c);
  // power out: where the nose points against the car's path leads (a rear sliding out turns it
  // in; a front pushing leaves it along the path)
  if (c.id === 'power-exit' && c.verdict !== 'spun') {
    // the result's own test (takeaway.ts `along`): under 2°, unrounded, is along its path
    const along = Math.abs(c.pointsDeg) < 2;
    const inside = c.pointsDeg * c.turnSign > 0;
    const nose = along
      ? 'nose along its path'
      : `nose ${a}° ${inside ? 'inside' : 'outside'} its path`;
    // in the summary's order (takeaway.ts carNumber): a nose turned in from its path is the
    // rear stepping out, even on a path that also ran wide; so "pushed wide" never sits beside
    // "nose inside" (which reads as a slide)
    if (c.verdict === 'rear' || (inside && !along)) return { head: 'Rear slid out', angle: nose };
    if (c.verdict === 'front' || c.verdict === 'wider')
      return { head: 'Front pushed wide', angle: nose };
  }
  const swung =
    c.out === 'front' && c.verdict === 'front' && c.id !== 'power-exit'
      ? `front tyres slide ${a}°`
      : `swung ${a}°`;
  switch (c.verdict) {
    // a slide is said as a slide; a spin, a catch and a slide that gripped again each in their
    // own words, so "let go" never reads as gone
    case 'front':
      return { head: 'Front tyres sliding', angle: swung };
    case 'rear':
      return { head: 'Rear tyres sliding', angle: swung };
    case 'catching':
      return { head: 'Rear sliding: catching it', angle: swung };
    case 'spun':
      return { head: 'Spun', angle: '' };
    case 'caught':
      return { head: 'Caught', angle: swung };
    case 'back':
      return {
        head: `${c.out === 'front' ? 'Front' : 'Rear'} slid, then gripped again`,
        angle: '',
      };
    case 'tighter':
      return {
        head: c.sameSpeed ? 'Tighter than with no brake (same speed)' : 'Turning tighter',
        angle: a >= 1 ? swung : '',
      };
    case 'wider':
      return {
        head: c.sameSpeed ? 'Wider than with no brake (same speed)' : 'Running wider',
        angle: a >= 1 ? swung : '',
      };
    case 'dive':
      return { head: 'Load onto the front', angle: '' };
    default:
      // one meaning per phrase: car B without the technique drives the normal line; on a car
      // that did the thing, it barely changed it
      return {
        head: c.twin ? 'Normal line' : 'Line barely changed',
        angle: a >= 1 ? swung : '',
      };
  }
}

/**
 * What a car's tag says at time t (its state `c` then): nothing before the key moment's first
 * stop (`atStop`, its verdict at the latest stop, null before it); from then, one story per run:
 * the end that let go once one has, and it stays out (the rings going green again show it
 * gripping again); spun once it spins; catching a slide, its own story: catching while the
 * opposite lock is on, caught once it grips again. Otherwise where its line went at the stop
 * (tighter, wider, held), which stays true of the run.
 */
export function liveVerdict(
  id: ScenarioId,
  lane: Lane,
  c: CarState,
  t: number,
  atStop: Verdict | null,
): Verdict | null {
  if (c.spun) return 'spun';
  if (!atStop) return null;
  const lg = lane.letGoBy(t);
  if (lg) {
    if (id === 'catch') {
      if (backInGrip(c)) return 'caught';
      if (lockAt(lane, c, t) > LOCK) return 'catching';
    }
    return lg.axle;
  }
  return atStop;
}

/** A verdict as the one word on a car's tag, from the key moment on. */
const TAG_WORD: Record<Verdict, string> = {
  // which end: a front pushing on and a rear stepping out are opposite lessons
  front: 'front out',
  rear: 'rear out',
  catching: 'catching',
  spun: 'spun',
  caught: 'caught',
  tighter: 'tighter',
  wider: 'wider',
  holding: 'holds',
  back: 'grips',
  dive: '',
};

/**
 * The one word on a car's tag from the key moment on: what it is doing then, as the freeze
 * frame judges it (the rings under its tyres say which end). None where the answer isn't a word:
 * a stop's is the load on its axles, a swerve's how soon it turns.
 */
export function tagWord(id: ScenarioId, v: Verdict | null): string {
  if (!v || id === 'braking' || id === 'lane-change') return '';
  return TAG_WORD[v];
}

/** The freeze frame for these cars at time t (`label`: what happened there). */
export function freezeFrame(
  id: ScenarioId,
  lanes: readonly Lane[],
  key: KeyMoment,
  t: number,
  label = key.label,
): FreezeFrame {
  const cars = lanes.map((lane, i): FreezeCar => {
    const p = lane.p;
    // "before": just ahead of the driver's action (never after the frozen moment, for a car
    // that gets to its own cause later)
    const t0 = Math.min(key.before[i], t);
    const tb = Number.isFinite(t0) ? Math.max(0, t0 - LEAD) : 0;
    lane.rec.sample(tb, st);
    // (a stop: from the share at rest, the layout chip's, as its summary says it)
    const frontBefore = id === 'braking' ? p.b / p.L : frontLoadOf(st);
    const k0 = curvature(st);
    const useF0 = heldUse(lane, FL, tb);
    const useR0 = heldUse(lane, RL, tb);
    const lgAt = lane.letGoBy(t);
    // then: as the first end let go (the instant it decided), or the most held so far
    const useF = lgAt ? heldUse(lane, FL, lgAt.t) : mostHeld(lane, FL, tb, t);
    const useR = lgAt ? heldUse(lane, RL, lgAt.t) : mostHeld(lane, RL, tb, t);
    lane.rec.sample(t, st);
    let { verdict, turn } = judge(id, lane, st, t, k0, { verdict: 'holding', turn: 0 });
    const moving = Math.hypot(st.vx, st.vy) > 1;
    // the line, measured as the run's summary measures it (so the two never disagree): the
    // path's curvature over the last 0.4 s against the 0.3 s before the driver's action; and
    // braking in a turn, against the same car at that speed and steering without the brake
    // (slowing down alone tightens a line)
    const sameSpeed = (id === 'trail-brake' || id === 'left-foot') && moving;
    let kNow = curvature(st);
    let refRadius = NaN;
    if (moving && (verdict === 'tighter' || verdict === 'wider' || verdict === 'holding')) {
      const te = key.before[i];
      const now = meanCurve(lane, t - 0.4, t);
      kNow = now.k;
      if (sameSpeed && Number.isFinite(te)) {
        const steer = meanSteer(lane, te, te + 0.2);
        const kRef = steadyCurvature(p, now.v, steer, now.k);
        if (kRef > 0) {
          turn = now.k / kRef - 1;
          refRadius = 1 / kRef;
        }
      } else if (Number.isFinite(te)) {
        const k0m = meanCurve(lane, te - 0.3, te).k;
        if (Math.abs(k0m) > 1e-3) turn = now.k / k0m - 1;
      }
      // tighter or wider by where the line has got to, against the same reference the summary
      // and the picture use, in metres (so the three never disagree): where the driver aimed,
      // or braking into a turn, the same car's line at this speed without the brake (on a
      // circle of rising speed, a swerve or a stop, the line tells nothing about a cause)
      if (id !== 'skidpad' && id !== 'lane-change' && id !== 'braking' && Number.isFinite(te)) {
        const off = t >= te ? lineBy(id, lane) : 0;
        verdict = off >= LINE_M ? 'tighter' : off <= -LINE_M ? 'wider' : 'holding';
      }
    }
    const lg = lgAt ? lgAt.axle : null;
    const asBuilt = lane.asBuilt ?? p;
    const k = lane.plan.path.at(lane.rec.sAtTime(t), bend).k;
    const most = mostSince(lane, tb, t);
    return {
      kind: lane.info.kind,
      label: lane.info.label ?? lane.info.name,
      twin: lane.info.rival === 'without',
      slid: t >= slidAt(lane),
      id,
      frontRest: p.b / p.L,
      rollF: p.front.rollShare,
      vehicle: lane.info.vehicle,
      pointsDeg: moving ? -betaOf(st) * DEG : 0,
      steerDeg: (st.steer - st.twist) * DEG,
      frontGoesDeg: moving ? Math.atan2(st.vy + p.a * st.r, st.vx) * DEG : 0,
      verdict,
      out: lg,
      turn,
      sameSpeed,
      radius: Math.abs(kNow) > 1e-4 ? 1 / Math.abs(kNow) : Infinity,
      refRadius,
      frontBefore,
      frontNow: mostMoved(lane, tb, lgAt ? lgAt.t : t, frontBefore),
      useF0,
      useR0,
      useF,
      useR,
      at: lgAt ? 'let-go' : 'most',
      turnSign: Math.abs(k) < 1e-4 ? 0 : Math.sign(k),
      swungDeg: moving ? Math.abs(betaOf(st)) * DEG : 0,
      swungMaxDeg: most.swung,
      lockMaxDeg: most.lock,
      tyreF: Math.round(p.front.fz0 / FZ0_PER_MM),
      tyreR: Math.round(p.rear.fz0 / FZ0_PER_MM),
      rearGrip: p.rear.mu / asBuilt.rear.mu,
      driven: p.front.driven && p.rear.driven ? 'all' : p.front.driven ? 'front' : 'rear',
    };
  });
  return { id, t, label, cause: id === 'braking' ? 'weight' : 'grip', cars };
}

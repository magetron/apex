/**
 * One car on the drive road: its sim run, everything it has driven so far (for scrubbing and
 * replays), the state to draw at the playhead, and the moment one of its axles first ran out of
 * grip. The scene advances every lane to the playhead; a lane only simulates the stretch it
 * hasn't driven yet, so going back in time just replays the recording.
 *
 * Both cars drive the plan's own path (the same corner, the same physics); the comparison car is
 * drawn a little behind the visitor's on the same line (`behind`), so the two never sit on each
 * other.
 */
import {
  axleUse,
  betaOf,
  createState,
  FL,
  G,
  RL,
  type CarParams,
  type CarState,
} from '../../sim/model';
import { Recorder, ScenarioRun, type Mark, type PathPoint, type Plan } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { follow } from './motion';
import type { RivalKind } from './versus';
import { poseOrigin, type Ground } from './world';

export type LaneKind = 'main' | 'rival';

/** The first time an axle used all its grip for a moment: which one, where, and at what g. */
export interface LetGo {
  t: number;
  /** where (the plan's ground frame, as driven) and how far along the path */
  x: number;
  n: number;
  s: number;
  axle: 'front' | 'rear';
  g: number;
}

/**
 * A rear that has let go is shown as let go (its ring, its tag, the freeze frame's verdict) only
 * once the car has visibly swung this far from where it goes (deg): never "let go" beside
 * "swung 0°". A front shows at once (the car runs wide, it doesn't swing).
 */
export const SHOWN_DEG = 2;
const scan = createState();

/** grip in use (share of the friction circles) that counts as letting go, and for how long */
export const LET_GO_USE = 0.985;
export const LET_GO_S = 0.12;

export interface LaneInfo {
  kind: LaneKind;
  /** layout code ("RR") and model name */
  code: string;
  name: string;
  /** what it is on the road and in the card ("Golf GTI", "No lift") */
  label?: string;
  /** what the comparison car is (another car, the same without the technique…) */
  rival?: RivalKind;
  /** the car, for its layout sketch */
  vehicle?: VehicleSpec;
}

const tmp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
const tmpB: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

export class Lane {
  readonly run: ScenarioRun;
  readonly rec = new Recorder();
  /** the state at the playhead, on this car's lane */
  readonly view = createState();
  phase = 0;
  letGo: LetGo | null = null;
  /** when this car passed each of the plan's marks (s of sim time), NaN until it does */
  readonly markT: number[];
  readonly marks: Mark[];
  /** the car as built, for a tuned twin (more or less rear grip) */
  asBuilt?: CarParams;
  /**
   * Drawn this far back along the plan's path (m): car B on car A's own line, just behind it
   * so the two never sit on each other. Only the drawing moves (the car where it would be that
   * far back, the same way round the line): the run, its numbers and its moment are its own.
   */
  behind = 0;
  private overF = 0;
  private overR = 0;
  private steps = 0;
  /**
   * Record every n-th sim step. Scripted cars keep every other step; the car the visitor drives
   * keeps every step, so the playhead, never more than a step behind its sim, always falls
   * between two recorded frames instead of waiting on the newest (a stutter in slow motion).
   */
  every = 2;
  /**
   * How much of the car is drawn (0..1): car B on car A's own line fades out while it comes
   * within a car length of car A (apartFade), so two cars are never drawn as one, and back in as
   * the gap opens. Eased (fadeTo), never switched.
   */
  drawn = 1;
  private drawnWant = 1;

  constructor(
    readonly p: CarParams,
    readonly plan: Plan,
    esc: boolean,
    readonly info: LaneInfo,
    /** lateral limit its speeds are quoted for (a tuned twin drives the as-built car's) */
    ayRef?: number,
  ) {
    this.run = new ScenarioRun(p, plan, esc, ayRef);
    this.marks = plan.marks?.(this.run.ctl.vScale) ?? [];
    this.markT = this.marks.map(() => NaN);
    this.reset();
  }

  get head() {
    return this.rec.tEnd;
  }

  /** when the let-go first showed (SHOWN_DEG), NaN until known; and how far it was looked for */
  private shownT = NaN;
  private shownIdx = 0;

  /**
   * When this car's let-go shows (s): at once for a front, once the body has swung SHOWN_DEG
   * for a rear (or it spun); Infinity while it hasn't (yet, as far as the recording goes) or
   * nothing let go. Found from the recording a frame at a time, so a live run costs little.
   */
  shownAt(): number {
    const lg = this.letGo;
    if (!lg) return Infinity;
    if (lg.axle === 'front') return lg.t;
    if (Number.isFinite(this.shownT)) return this.shownT;
    const rec = this.rec;
    const rad = (SHOWN_DEG * Math.PI) / 180;
    if (this.shownIdx === 0) this.shownIdx = rec.indexAt(lg.t);
    for (; this.shownIdx < rec.count; this.shownIdx++) {
      rec.frame(this.shownIdx, scan);
      if (scan.spun || Math.abs(betaOf(scan)) >= rad) {
        this.shownT = Math.max(lg.t, scan.t);
        return this.shownT;
      }
    }
    return Infinity;
  }

  /** The let-go, if it has shown by time t. */
  letGoBy(t: number): LetGo | null {
    return this.letGo && this.shownAt() <= t ? this.letGo : null;
  }

  reset() {
    this.shownT = NaN;
    this.shownIdx = 0;
    this.run.reset();
    this.rec.clear();
    this.letGo = null;
    this.overF = this.overR = 0;
    this.steps = 0;
    this.markT.fill(NaN);
    this.drawn = this.drawnWant = 1;
    this.record();
    this.show(0);
  }

  /** Ease `drawn` towards `want` (0..1) over a frame of `dt` s: the same at any frame rate. */
  fadeTo(want: number, dt: number) {
    const v = follow(this.drawn, this.drawnWant, want, dt, DRAWN_TAU);
    this.drawn = Math.max(0, Math.min(1, v));
    this.drawnWant = want;
  }

  private record() {
    const { run } = this;
    const st = run.st;
    const d = run.ctl.driver;
    this.rec.push(st, run.ctl.phase, d.s, d.err);
    for (let i = 0; i < this.marks.length; i++)
      if (Number.isNaN(this.markT[i]) && d.s >= this.marks[i].s) this.markT[i] = st.t;
    if (this.letGo || Math.hypot(st.vx, st.vy) < 3) return;
    const dt = this.steps > 0 ? this.every * (1 / 240) : 0;
    this.overF = axleUse(st, FL) > LET_GO_USE ? this.overF + dt : 0;
    this.overR = axleUse(st, RL) > LET_GO_USE ? this.overR + dt : 0;
    if (this.overF >= LET_GO_S || this.overR >= LET_GO_S) {
      this.letGo = {
        t: st.t,
        x: st.x,
        n: st.n,
        s: d.s,
        axle: this.overR >= LET_GO_S && this.overR >= this.overF ? 'rear' : 'front',
        g: Math.hypot(st.ax, st.ay) / G,
      };
    }
  }

  /** Simulate until the sim reaches time t (at most `max` steps), recording every n-th step. */
  simTo(t: number, max = Infinity) {
    const { run } = this;
    for (let k = 0; k < max && !run.done && run.st.t < t - 1e-9; k++) {
      run.step();
      if (++this.steps % this.every === 0 || run.done) this.record();
    }
  }

  /** Draw state at time t (what's recorded; the live edge at most), `behind` back. */
  show(t: number) {
    this.phase = this.rec.sample(t, this.view);
    if (this.behind) this.moveBack(this.view, this.rec.sAtTime(t));
  }

  /** Move a drawn car `behind` back along the path, turned with it (lanes.ts `behind`). */
  private moveBack(st: Pick<CarState, 'x' | 'n' | 'yaw'>, s: number) {
    const path = this.plan.path;
    const at = path.at(s, tmp);
    const ax = at.x;
    const an = at.n;
    const ah = at.h;
    const sb = s - this.behind;
    const back = path.at(Math.max(0, sb), tmpB);
    // before the start: straight back along the way it starts
    const bx = back.x + Math.min(0, sb) * Math.cos(back.h);
    const bn = back.n + Math.min(0, sb) * Math.sin(back.h);
    const dh = back.h - ah;
    const c = Math.cos(dh);
    const sn = Math.sin(dh);
    const rx = st.x - ax;
    const rn = st.n - an;
    st.x = bx + c * rx - sn * rn;
    st.n = bn + sn * rx + c * rn;
    st.yaw += dh;
  }

  /** Drive again from the start with the script up to time t, dropping what came after: the
   *  visitor takes the wheel from a moment in a replay. */
  redriveTo(t: number) {
    this.run.manual = null;
    this.reset();
    this.simTo(t);
  }
}

/** First recorded time a lane was in its event phase, NaN if it never got there. */
export function laneEventTime(lane: Lane): number {
  const rec = lane.rec;
  for (let i = 0; i < rec.count; i++) if (rec.phaseAt(i) >= 1) return rec.get(i, 't');
  return NaN;
}

/** a tail swung this far further out than before the event (deg) has slid: the catch's own
 *  "slid" (catch.ts maxSlip > 2°), looked for this long after the event (s) */
const SLID_DEG = 2;
const SLID_WITHIN = 3;
const slidScan = createState();

/**
 * When a lane's car first slid after its event (its tail swung SLID_DEG further out than just
 * before it, or it spun), as its summary judges "slid" and "never slid"; Infinity if it never did.
 */
export function slidAt(lane: Lane): number {
  const rec = lane.rec;
  const te = laneEventTime(lane);
  if (!Number.isFinite(te)) return Infinity;
  let b0 = 0;
  let n = 0;
  for (let i = rec.indexAt(te - 0.3), m = rec.indexAt(te); i <= m; i++) {
    rec.frame(i, slidScan);
    b0 += betaOf(slidScan);
    n++;
  }
  b0 = n ? b0 / n : 0;
  const rad = (SLID_DEG * Math.PI) / 180;
  for (let i = rec.indexAt(te), m = rec.indexAt(te + SLID_WITHIN); i <= m; i++) {
    rec.frame(i, slidScan);
    if (slidScan.spun || b0 - betaOf(slidScan) > rad) return rec.get(i, 't');
  }
  return Infinity;
}

/** car B on car A's line is drawn this many of car A's lengths behind it */
export const STAGGER = 1.5;
/** a car faded this far (Lane.drawn) is not drawn at all */
export const FADED = 0.005;
/** car B on car A's line fades out from this many car lengths apart (centre to centre) and is
 *  gone at APART_GONE; it eases there over about DRAWN_TAU s */
const APART_CLEAR = 1.2;
const APART_GONE = 1;
const DRAWN_TAU = 0.12;
const ga: Ground = { x: 0, z: 0 };
const gb: Ground = { x: 0, z: 0 };

/** The middle of a car's body as drawn (world x, z), not its wheelbase middle. */
function bodyMiddle(lane: Lane, out: Ground): Ground {
  const { p, view: st } = lane;
  poseOrigin(p, st, out);
  const cx = p.L / 2 + p.dims.overhangF - p.dims.length / 2;
  out.x += Math.cos(st.yaw) * cx;
  out.z -= Math.sin(st.yaw) * cx;
  return out;
}

/**
 * How much of car B to draw (0..1) where the two cars are drawn now: all of it while their
 * bodies' middles are more than APART_CLEAR car lengths apart (whichever way), none within
 * APART_GONE, in between in proportion. Car B on car A's own line can catch up with car A (car A
 * slid, or spun and stopped): drawn over it, the two would read as one car seen double.
 */
export function apartFade(a: Lane, b: Lane): number {
  const len = (a.p.dims.length + b.p.dims.length) / 2;
  bodyMiddle(a, ga);
  bodyMiddle(b, gb);
  const d = Math.hypot(gb.x - ga.x, gb.z - ga.z) / len;
  return Math.max(0, Math.min(1, (d - APART_GONE) / (APART_CLEAR - APART_GONE)));
}

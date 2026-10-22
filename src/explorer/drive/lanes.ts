/**
 * One car on the drive road: its sim run, everything it has driven so far (for scrubbing and
 * replays), the state to draw at the playhead, and the moment one of its axles first ran out of
 * grip. The scene advances every lane to the playhead; a lane only simulates the stretch it
 * hasn't driven yet, so going back in time just replays the recording.
 */
import { axleUse, createState, FL, G, RL, type CarParams } from '../../sim/model';
import { Recorder, ScenarioRun, type Mark, type Plan } from '../../sim/scenarios';
import type { Family } from './state';

export type LaneKind = 'main' | 'ghost' | 'twin';

/** The first time an axle used all its grip for a moment: which one, where, and at what g. */
export interface LetGo {
  t: number;
  x: number;
  n: number;
  axle: 'front' | 'rear';
  g: number;
}

/** What to watch on a car around the key moment: one axle, over a stretch of sim time (s). */
export interface Watch {
  axle: 'front' | 'rear';
  t0: number;
  t1: number;
}

/** grip in use (share of the friction circles) that counts as letting go, and for how long */
const LET_GO_USE = 0.985;
const LET_GO_S = 0.12;

export interface LaneInfo {
  kind: LaneKind;
  /** layout code ("RR") and model name */
  code: string;
  name: string;
  /** a comparison car's layout family (its colour); null for the visitor's car and its twin */
  family: Family | null;
  /** which of its family's colours (colorSlots): 0 unless an earlier car wears the first */
  slot?: number;
}

export class Lane {
  readonly run: ScenarioRun;
  readonly rec = new Recorder();
  /** the state at the playhead */
  readonly view = createState();
  phase = 0;
  letGo: LetGo | null = null;
  /** the axle to ring around the key moment (set by the scene once the run is known) */
  watch: Watch | null = null;
  /** when this car passed each of the plan's marks (s of sim time), NaN until it does */
  readonly markT: number[];
  readonly marks: Mark[];
  private overF = 0;
  private overR = 0;
  private steps = 0;

  constructor(
    readonly p: CarParams,
    readonly plan: Plan,
    esc: boolean,
    readonly info: LaneInfo,
  ) {
    this.run = new ScenarioRun(p, plan, esc);
    this.marks = plan.marks?.(this.run.ctl.vScale) ?? [];
    this.markT = this.marks.map(() => NaN);
    this.reset();
  }

  get head() {
    return this.rec.tEnd;
  }

  reset() {
    this.run.reset();
    this.rec.clear();
    this.letGo = null;
    this.overF = this.overR = 0;
    this.steps = 0;
    this.markT.fill(NaN);
    this.record();
    this.show(0);
  }

  private record() {
    const { run } = this;
    const st = run.st;
    const d = run.ctl.driver;
    this.rec.push(st, run.ctl.phase, d.s, d.err);
    for (let i = 0; i < this.marks.length; i++)
      if (Number.isNaN(this.markT[i]) && d.s >= this.marks[i].s) this.markT[i] = st.t;
    if (this.letGo || Math.hypot(st.vx, st.vy) < 3) return;
    const dt = this.steps > 0 ? 2 * (1 / 240) : 0;
    this.overF = axleUse(st, FL) > LET_GO_USE ? this.overF + dt : 0;
    this.overR = axleUse(st, RL) > LET_GO_USE ? this.overR + dt : 0;
    if (this.overF >= LET_GO_S || this.overR >= LET_GO_S) {
      this.letGo = {
        t: st.t,
        x: st.x,
        n: st.n,
        axle: this.overR >= LET_GO_S && this.overR >= this.overF ? 'rear' : 'front',
        g: Math.hypot(st.ax, st.ay) / G,
      };
    }
  }

  /** Simulate until the sim reaches time t (at most `max` steps), recording every other step. */
  simTo(t: number, max = Infinity) {
    const { run } = this;
    for (let k = 0; k < max && !run.done && run.st.t < t - 1e-9; k++) {
      run.step();
      if (++this.steps % 2 === 0 || run.done) this.record();
    }
  }

  /** Draw state at time t (what's recorded; the live edge at most). */
  show(t: number) {
    this.phase = this.rec.sample(t, this.view);
  }

  /** Drive again from the start with the script up to time t, dropping what came after: the
   *  visitor takes the wheel from a moment in a replay. */
  redriveTo(t: number) {
    this.run.manual = null;
    this.reset();
    this.simTo(t);
  }
}

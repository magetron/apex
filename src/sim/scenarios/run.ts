/**
 * One car driving one scenario. The live drive scene steps it from useFrame (allocation-free);
 * tests and the dev sandbox run it headless and record a trace.
 */
import { createState, DT, resetState, step, type CarState, type Inputs } from '../model/car';
import { lateralLimit, REF_LATERAL_LIMIT } from '../model/limits';
import type { CarParams } from '../model/params';
import { Driver } from './driver';
import type { PathPoint } from './path';
import { emptyTrace, record, type Trace } from './trace';
import type { Ctl, Plan, ScenarioResult } from './types';

/** The pose fields drawn between two sim steps. */
const POSE = ['x', 'n', 'yaw', 'roll', 'pitch', 'wheelSpin'] as const;

export class ScenarioRun {
  readonly st: CarState = createState();
  /**
   * What to draw: the state a fraction of a step past the previous one (see interpolate). The
   * sim steps at a fixed DT while frames arrive unevenly; drawing the latest step would make
   * the car jump a step ahead or behind the camera from frame to frame.
   */
  readonly view: CarState = createState();
  private readonly prev: Record<(typeof POSE)[number], number> = {
    x: 0,
    n: 0,
    yaw: 0,
    roll: 0,
    pitch: 0,
    wheelSpin: 0,
  };
  readonly u: Inputs = { steer: 0, throttle: 0, brake: 0, esc: false };
  readonly ctl: Ctl;
  done = false;
  /**
   * Someone else's hands: when set, the car takes its steering and pedals from here instead of
   * the scripted driver (the visitor driving). The plan still marks where its event is.
   */
  manual: Pick<Inputs, 'steer' | 'throttle' | 'brake'> | null = null;
  private readonly pt: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

  constructor(
    readonly p: CarParams,
    readonly plan: Plan,
    public esc = false,
    /** lateral limit (m/s²) a grip-scaled plan's speeds are quoted for; pass the explorer
     *  car's own limit so it drives exactly the chosen speed and ghosts match its margin */
    ayRef = REF_LATERAL_LIMIT,
  ) {
    const vScale = plan.gripScaled ? Math.sqrt(lateralLimit(p) / ayRef) : 1;
    this.ctl = { driver: new Driver(plan.path), phase: 0, tEvent: NaN, hold: 0, vScale, memo: 0 };
    this.reset();
  }

  reset() {
    const { plan, p, st, ctl } = this;
    const at = plan.path.at(plan.startS, this.pt);
    // the CG starts on the line, heading along it
    resetState(st, p, at.x, at.n, at.h, plan.startV * ctl.vScale, at.k);
    ctl.driver.reset(plan.startS);
    ctl.phase = 0;
    ctl.tEvent = NaN;
    ctl.hold = 0;
    ctl.memo = 0;
    this.u.steer = st.steer;
    this.u.throttle = 0;
    this.u.brake = 0;
    this.done = false;
    for (const k of POSE) this.prev[k] = st[k];
    this.interpolate(1);
  }

  /** Fill `view` with the state `a` (0…1) of the way from the previous step to the latest. */
  interpolate(a: number) {
    const { st, view, prev } = this;
    Object.assign(view, st);
    for (const k of POSE) view[k] = prev[k] + (st[k] - prev[k]) * a;
  }

  /** One fixed step of the sim (DT). */
  step() {
    if (this.done) return;
    const { plan, p, st, u, ctl } = this;
    for (const k of POSE) this.prev[k] = st[k];
    u.esc = this.esc;
    ctl.driver.track(st);
    const m = this.manual;
    if (m) {
      u.steer = m.steer;
      u.throttle = m.throttle;
      u.brake = m.brake;
      if (ctl.phase === 0 && ctl.driver.s >= plan.eventS) {
        ctl.phase = 1;
        ctl.tEvent = st.t;
      }
    } else plan.control(ctl, p, st, u, DT);
    step(p, st, u, DT);
    if (st.t >= plan.duration) this.done = true;
  }
}

/** Run a scenario to the end, recording every `every` steps (default 60 Hz). */
export function runHeadless(
  p: CarParams,
  plan: Plan,
  opts: { esc?: boolean; every?: number; ayRef?: number } = {},
): { trace: Trace; result: ScenarioResult; run: ScenarioRun } {
  const run = new ScenarioRun(p, plan, opts.esc ?? false, opts.ayRef);
  const every = opts.every ?? 4;
  const trace = emptyTrace();
  let k = 0;
  record(trace, run.st, run.ctl.driver.s, run.ctl.driver.err, run.ctl.phase);
  while (!run.done) {
    run.step();
    if (++k % every === 0)
      record(trace, run.st, run.ctl.driver.s, run.ctl.driver.err, run.ctl.phase);
  }
  const result = plan.summarize(trace, p);
  result.spun = result.spun || run.st.spun;
  return { trace, result, run };
}

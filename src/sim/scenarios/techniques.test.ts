import { describe, expect, it } from 'vitest';
import { getEngine, getMotor, listVehicles } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import type { VehicleSpec } from '../../spec/types';
import { carParams, createState, DT, FL, FR, resetState, RL, RR, step } from '../model';
import { brakePoint, ENTRY, runUp } from './corner';
import { Recorder, runHeadless, ScenarioRun, SCENARIOS, HUB_ORDER, type ScenarioId } from './index';
import { meanOver, type Trace } from './trace';

const kwPerTonne = (v: VehicleSpec) => {
  const pt = v.powertrain;
  const kw =
    pt.kind === 'ice'
      ? getEngine(pt.engine).powerKw
      : pt.motors.reduce((s, m) => s + getMotor(m.motor).peakKw, 0);
  return (1000 * kw) / massProps(v).totalKg;
};

/** The road car of a layout nearest a hot-hatch/sports-saloon power-to-weight, by traits. */
function pick(pred: (v: VehicleSpec) => boolean): VehicleSpec {
  const road = listVehicles().filter(
    (v) => pred(v) && v.tires.mu <= 1.1 && v.body.style !== 'offroader' && v.body.style !== 'suv',
  );
  road.sort(
    (a, b) =>
      Math.abs(Math.log(kwPerTonne(a) / 160)) - Math.abs(Math.log(kwPerTonne(b) / 160)) ||
      a.id.localeCompare(b.id),
  );
  return road[0];
}
const ice = (v: VehicleSpec) => v.powertrain.kind === 'ice';
const pos = (v: VehicleSpec) => (v.powertrain.kind === 'ice' ? v.powertrain.position : 'ev');
const rwd = (v: VehicleSpec) => ice(v) && v.powertrain.driven === 'rear';
// picked on first use: the catalog registers itself as its modules load
let cars: Record<'FF' | 'FRONT_RWD' | 'MR' | 'RR' | 'HALDEX', VehicleSpec> | null = null;
const car = (k: keyof NonNullable<typeof cars>) =>
  (cars ??= {
    FF: pick((v) => ice(v) && v.powertrain.driven === 'front'),
    FRONT_RWD: pick((v) => rwd(v) && pos(v).startsWith('front')),
    MR: pick((v) => rwd(v) && pos(v) === 'mid'),
    RR: pick((v) => rwd(v) && pos(v).startsWith('rear')),
    HALDEX: pick(
      (v) =>
        ice(v) &&
        v.powertrain.driven === 'all' &&
        v.powertrain.awd === 'clutch-on-demand' &&
        pos(v).startsWith('front'),
    ),
  })[k];

const run = (v: VehicleSpec, id: ScenarioId, baseline = false) => {
  const def = SCENARIOS[id];
  const plan = baseline ? def.baseline!.plan(def.speed.def) : def.plan(def.speed.def);
  return runHeadless(carParams(v), plan);
};

/** Mean |slip angle| of each axle over the first part of the held window (deg). */
function slips(tr: Trace, holdS: number) {
  const te = tr.t[tr.phase.findIndex((p) => p >= 1)];
  const f = meanOver(tr, te + 0.1, te + 0.6 * holdS, (i) => Math.abs(tr.alphaF[i]));
  const r = meanOver(tr, te + 0.1, te + 0.6 * holdS, (i) => Math.abs(tr.alphaR[i]));
  return { f: (f * 180) / Math.PI, r: (r * 180) / Math.PI };
}

describe('every technique drives the whole manoeuvre', () => {
  it.each(HUB_ORDER)('%s: speeds change, the event fires, every car finishes', (id) => {
    for (const v of [car('FF'), car('FRONT_RWD'), car('MR'), car('RR'), car('HALDEX')]) {
      const { trace } = run(v, id);
      const vs = trace.v;
      // a car that only cruised would sit within a km/h or two
      expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(4);
      if (Number.isFinite(SCENARIOS[id].plan(SCENARIOS[id].speed.def).eventS))
        expect(trace.phase.some((p) => p >= 1)).toBe(true);
    }
  });

  it('the run-up reaches the corner speed at turn-in, after accelerating then braking', () => {
    const vC = 15;
    const out = { v: 0, a: 0 };
    expect(runUp(0, ENTRY, vC, out).a).toBeGreaterThan(0);
    const bp = brakePoint(ENTRY, vC);
    expect(bp).toBeGreaterThan(0);
    expect(bp).toBeLessThan(ENTRY);
    expect(runUp(bp + 1, ENTRY, vC, out).a).toBeLessThan(0);
    expect(runUp(ENTRY, ENTRY, vC, out).v).toBeCloseTo(vC, 6);
  });
});

describe('power on mid-corner', () => {
  it('a rear-driven car slips its rear tyres more than its fronts; a front-driver the opposite', () => {
    const rwd = slips(run(car('FRONT_RWD'), 'power-exit').trace, 1);
    const fwd = slips(run(car('FF'), 'power-exit').trace, 1);
    expect(rwd.r).toBeGreaterThan(rwd.f);
    expect(fwd.f).toBeGreaterThan(fwd.r);
  });

  it('a Haldex-type AWD car pushes first, then its clutch sends drive to the rear', () => {
    const p = carParams(car('HALDEX'));
    expect(p.drive.device?.type).toBe('clutch');
    // settled on a 40 m circle at 0.6 g, then the throttle opened with the steering held
    const st = createState();
    const v = Math.sqrt(0.6 * 9.81 * 40);
    resetState(st, p, 0, 0, 0, v, 1 / 40);
    const u = { steer: st.steer, throttle: 1, brake: 0, esc: false };
    const rearShare = () =>
      (st.fx[RL] + st.fx[RR]) / (st.fx[FL] + st.fx[FR] + st.fx[RL] + st.fx[RR]);
    let early = NaN;
    for (let i = 1; i <= 0.6 * 240; i++) {
      step(p, st, u, DT);
      if (i === 8) early = rearShare();
    }
    expect(st.awdLock).toBeGreaterThan(0.3);
    expect(rearShare()).toBeGreaterThan(early + 0.1);
  });
});

describe('lift-off and trail braking', () => {
  it('lifting rotates a mid-engined car more than a front-driver', () => {
    const mr = run(car('MR'), 'lift-off').result.values;
    const ff = run(car('FF'), 'lift-off').result.values;
    expect(mr.yawSpike!).toBeGreaterThan(ff.yawSpike!);
  });

  it('braking in the turn tightens every layout, more than the same car without the brake', () => {
    for (const v of [car('FF'), car('FRONT_RWD'), car('MR'), car('RR')]) {
      const trail = run(v, 'trail-brake').result.values.lineChange!;
      const none = run(v, 'trail-brake', true).result.values.lineChange!;
      expect(trail).toBeGreaterThan(5);
      expect(trail).toBeGreaterThan(none + 5);
    }
  });

  it('left-foot braking tightens a front-driver more than holding the throttle alone', () => {
    const lfb = run(car('FF'), 'left-foot').result.values.lineChange!;
    const none = run(car('FF'), 'left-foot', true).result.values.lineChange!;
    expect(lfb).toBeGreaterThan(none + 8);
  });
});

describe('catching a slide', () => {
  it('the tail-heavy car needs opposite lock and is caught; the front-driver needs none', () => {
    const rr = run(car('RR'), 'catch').result;
    const ff = run(car('FF'), 'catch').result;
    expect(rr.spun).toBe(false);
    expect(rr.values.counterDeg!).toBeGreaterThan(2);
    expect(rr.values.maxSlip!).toBeGreaterThan(ff.values.maxSlip!);
    expect(ff.values.counterDeg!).toBeLessThan(1);
  });

  it('without the catch, the same slide goes further', () => {
    const caught = run(car('RR'), 'catch').result.values.maxSlip!;
    const hands = run(car('RR'), 'catch', true).result.values.maxSlip!;
    expect(hands).toBeGreaterThan(caught);
  });
});

describe('recording and replay', () => {
  it('samples between frames and summarises like the headless run', () => {
    const p = carParams(car('FRONT_RWD'));
    const plan = SCENARIOS['power-exit'].plan(SCENARIOS['power-exit'].speed.def);
    const r = new ScenarioRun(p, plan);
    const rec = new Recorder();
    rec.push(r.st, r.ctl.phase, r.ctl.driver.s, r.ctl.driver.err);
    let k = 0;
    while (!r.done) {
      r.step();
      if (++k % 2 === 0) rec.push(r.st, r.ctl.phase, r.ctl.driver.s, r.ctl.driver.err);
    }
    const out = createState();
    const i = Math.floor(rec.count / 2);
    const ta = rec.get(i, 't');
    const tb = rec.get(i + 1, 't');
    rec.sample((ta + tb) / 2, out);
    expect(out.x).toBeCloseTo((rec.get(i, 'x') + rec.get(i + 1, 'x')) / 2, 3);
    const head = runHeadless(p, plan).result.values;
    const replay = plan.summarize(rec.toTrace(2), p).values;
    // recorded at 120 Hz instead of 60: the same result within a couple of percent
    expect(Math.abs(replay.lineChange! - head.lineChange!)).toBeLessThan(
      0.03 * Math.abs(head.lineChange!) + 0.5,
    );
    rec.truncate(ta);
    expect(rec.tEnd).toBeLessThanOrEqual(ta + 1e-6);
  });

  it('a run takes the visitor’s inputs when they drive', () => {
    const p = carParams(car('FF'));
    const r = new ScenarioRun(p, SCENARIOS['lift-off'].plan(60));
    r.manual = { steer: 0, throttle: 1, brake: 0 };
    const v0 = Math.hypot(r.st.vx, r.st.vy);
    for (let i = 0; i < 240; i++) r.step();
    expect(r.st.throttle).toBeCloseTo(1, 6);
    expect(Math.hypot(r.st.vx, r.st.vy)).toBeGreaterThan(v0 + 2);
    expect(Math.abs(r.st.yaw)).toBeLessThan(0.01);
    // and it is the same model step underneath
    const st = createState();
    expect(() => step(p, st, { steer: 0, throttle: 0, brake: 0, esc: false }, DT)).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import type { VehicleSpec } from '../../spec/types';
import { getEngine, getMotor, getVehicle, listVehicles } from '../../spec/catalog';
import { carParams, G, type Tuning } from '../model';
import { HUB_ORDER, runHeadless, ScenarioRun, SCENARIO_IDS, SCENARIOS } from './index';
import { TRACE_KEYS } from './trace';

const run = (
  v: VehicleSpec,
  id: keyof typeof SCENARIOS,
  opts: { esc?: boolean; kmh?: number; tuning?: Tuning } = {},
) =>
  runHeadless(carParams(v, opts.tuning), SCENARIOS[id].plan(opts.kmh ?? SCENARIOS[id].speed.def), {
    esc: opts.esc,
  });
const car = (id: string) => getVehicle(id);
/** power-to-weight from the spec (kW per tonne of kerb weight) */
const kwPerTonne = (v: VehicleSpec) => {
  const pt = v.powertrain;
  const kw =
    pt.kind === 'ice'
      ? getEngine(pt.engine).powerKw
      : pt.motors.reduce((s, m) => s + getMotor(m.motor).peakKw, 0);
  return (1000 * kw) / v.published.curbKg;
};
/** the same car on one tyre width front and rear: only the layout differs */
const equalTyres = (v: VehicleSpec): VehicleSpec => {
  const w = (v.tires.widthFMm + v.tires.widthRMm) / 2;
  return { ...v, tires: { ...v.tires, widthFMm: w, widthRMm: w } };
};

describe('skidpad: understeer gradient', () => {
  const K = (v: VehicleSpec, tuning?: Tuning) => run(v, 'skidpad', { tuning }).result.values;

  it('layout alone (neutral chassis, equal tyres): FF understeers, FR ~neutral, MR and RR oversteer', () => {
    const neutral = { neutral: true };
    const ff = K(equalTyres(car('vw-golf-gti-mk8')), neutral);
    const fr = K(equalTyres(car('bmw-m340i-g20')), neutral);
    const mr = K(equalTyres(car('audi-r8-v10-gen2')), neutral);
    const rr = K(equalTyres(car('porsche-911-992')), neutral);
    expect(ff.usGradient).toBeGreaterThan(0.3);
    expect(Math.abs(fr.usGradient!)).toBeLessThan(0.3);
    expect(mr.usGradient).toBeLessThan(0);
    expect(rr.usGradient).toBeLessThan(-0.1);
    // and at the limit the FF's fronts let go first, the RR's rears
    expect(ff.limitAxle).toBe(1);
    expect(rr.limitAxle).toBe(-1);
  });

  it('as built, every car understeers mildly (like real road cars); less as weight moves back', () => {
    const ks = Object.fromEntries(
      [
        'vw-golf-gti-mk8',
        'bmw-m340i-g20',
        'porsche-911-992',
        'audi-r8-v10-gen2',
        'tesla-model3-awd',
      ].map((id) => [id, K(car(id)).usGradient!]),
    );
    for (const k of Object.values(ks)) {
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(4);
    }
    expect(ks['vw-golf-gti-mk8']).toBeGreaterThan(ks['bmw-m340i-g20']);
    expect(ks['bmw-m340i-g20']).toBeGreaterThan(ks['porsche-911-992']);
  });

  it("the 911's wide rear tyres are what tame its tail-heavy layout", () => {
    const v = car('porsche-911-992');
    expect(K(v).usGradient!).toBeGreaterThan(K(equalTyres(v)).usGradient!);
  });

  it('every car reaches a plausible limit on the circle', () => {
    for (const v of listVehicles()) {
      const { maxAy } = K(v);
      expect(maxAy).toBeGreaterThan(0.6 * v.tires.mu);
      expect(maxAy).toBeLessThan(1.15 * v.tires.mu);
    }
  });
});

describe('lift-off mid-corner', () => {
  it('RR (911) yaw spike exceeds FR (BMW) at every severity', () => {
    for (const kmh of [58, 60, SCENARIOS['lift-off'].speed.def]) {
      const rr = run(car('porsche-911-992'), 'lift-off', { kmh }).result.values.yawSpike!;
      const fr = run(car('bmw-m340i-g20'), 'lift-off', { kmh }).result.values.yawSpike!;
      expect(rr).toBeGreaterThan(1.4 * fr);
    }
  });

  it('FF stays calmest; ESC catches the RR', () => {
    const ff = run(car('vw-golf-gti-mk8'), 'lift-off').result.values.yawSpike!;
    const rr = run(car('porsche-911-992'), 'lift-off').result.values.yawSpike!;
    expect(ff).toBeLessThan(rr);
    const max = SCENARIOS['lift-off'].speed.max;
    expect(run(car('porsche-911-992'), 'lift-off', { kmh: max }).result.spun).toBe(true);
    expect(run(car('porsche-911-992'), 'lift-off', { kmh: max, esc: true }).result.spun).toBe(
      false,
    );
  });
});

describe('power-on exit', () => {
  const line = (id: string, esc = false) => run(car(id), 'power-exit', { esc }).result.values;

  it('the GTI runs wide while the rear-driven cars rotate', () => {
    const ff = line('vw-golf-gti-mk8');
    expect(ff.lineChange).toBeLessThan(-10);
    expect(line('bmw-m340i-g20').lineChange).toBeGreaterThan(20);
    expect(line('porsche-911-992').lineChange).toBeGreaterThan(0);
    // every rear-driven car with the power to break traction rotates relative to the FF
    for (const v of listVehicles().filter(
      (x) => x.powertrain.driven === 'rear' && kwPerTonne(x) > 60,
    )) {
      const rwd = run(v, 'power-exit').result.values;
      expect(rwd.lineChange! - ff.lineChange!).toBeGreaterThan(15);
      expect(rwd.slipChange).toBeGreaterThan(ff.slipChange!);
    }
  });

  it('rear-driven cars too weak to break traction (a 1957 Fiat 500) stay near neutral', () => {
    for (const v of listVehicles().filter(
      (x) => x.powertrain.driven === 'rear' && kwPerTonne(x) <= 60,
    )) {
      const r = run(v, 'power-exit').result.values;
      expect(Math.abs(r.lineChange!)).toBeLessThan(15);
      expect(Math.abs(r.slipChange!)).toBeLessThan(2);
    }
  });

  it('ESC keeps the FR from spinning', () => {
    expect(run(car('bmw-m340i-g20'), 'power-exit', { esc: true }).result.spun).toBe(false);
  });
});

describe('braking and lane change', () => {
  it('stops from 100 km/h in a plausible distance, nose diving', () => {
    for (const v of listVehicles()) {
      const r = run(v, 'braking').result.values;
      expect(r.meanDecel).toBeGreaterThan(0.75 * v.tires.mu);
      expect(r.meanDecel).toBeLessThan(1.15 * v.tires.mu);
      expect(r.diveDeg).toBeGreaterThan(0.3);
    }
  });

  it('the same driver gets every car through the lane change; the RR lags most', () => {
    const lag = (id: string) => run(car(id), 'lane-change').result.values;
    for (const v of listVehicles())
      expect(run(v, 'lane-change').result.values.pathError).toBeLessThan(1);
    expect(lag('porsche-911-992').yawLag).toBeGreaterThan(lag('bmw-m340i-g20').yawLag!);
  });
});

describe('every catalog car × every scenario', () => {
  const cases = listVehicles().flatMap((v) =>
    SCENARIO_IDS.flatMap((id) => [false, true].map((esc) => [v.id, id, esc] as const)),
  );
  it.each(cases)('%s / %s (ESC %s): finite, bounded', (vid, id, esc) => {
    const v = car(vid);
    const { trace, result } = run(v, id, { esc });
    for (const k of TRACE_KEYS) for (const x of trace[k]) expect(Number.isFinite(x)).toBe(true);
    for (const x of Object.values(result.values)) expect(Number.isFinite(x)).toBe(true);
    const mu = v.tires.mu;
    for (const ay of trace.ay) expect(Math.abs(ay)).toBeLessThan(1.3 * mu);
    for (const r of trace.r) expect(Math.abs(r)).toBeLessThan(4);
    for (const s of trace.v) expect(s).toBeLessThan(70);
  });
});

describe('determinism', () => {
  it('headless runs repeat exactly', () => {
    const a = run(car('porsche-911-992'), 'lift-off');
    const b = run(car('porsche-911-992'), 'lift-off');
    expect(a.trace).toEqual(b.trace);
  });

  it('the live runner (stepped like useFrame) matches the headless run', () => {
    const p = carParams(car('bmw-m340i-g20'));
    const plan = SCENARIOS['power-exit'].plan(46);
    const live = new ScenarioRun(p, plan);
    // uneven "frames" of 1–7 steps, as a variable frame rate would give
    let k = 0;
    while (!live.done) for (let n = 1 + (k++ % 7); n > 0 && !live.done; n--) live.step();
    const head = runHeadless(p, plan).run.st;
    expect([live.st.x, live.st.n, live.st.yaw, live.st.vx]).toEqual([
      head.x,
      head.n,
      head.yaw,
      head.vx,
    ]);
  });

  it('restart resets to the same start', () => {
    const p = carParams(car('vw-golf-gti-mk8'));
    const r = new ScenarioRun(p, SCENARIOS.braking.plan(100));
    const x0 = [r.st.x, r.st.n, r.st.vx];
    for (let i = 0; i < 500; i++) r.step();
    r.reset();
    expect([r.st.x, r.st.n, r.st.vx]).toEqual(x0);
    expect(G).toBeGreaterThan(9);
  });
});

describe('the drive hub', () => {
  it('lists every scenario once, as a progression from a straight stop to a quick swerve', () => {
    expect([...HUB_ORDER].sort()).toEqual(Object.keys(SCENARIOS).sort());
    expect(HUB_ORDER).toEqual([
      'braking',
      'skidpad',
      'lift-off',
      'trail-brake',
      'power-exit',
      'catch',
      'left-foot',
      'lane-change',
    ]);
  });

  it('names each scenario by the question it answers, with its technique', () => {
    const questions = new Set<string>();
    for (const id of HUB_ORDER) {
      const def = SCENARIOS[id];
      expect(def.question).toMatch(/^[A-Z].*\?$/);
      expect(def.label.length).toBeGreaterThan(3);
      questions.add(def.question);
      expect(def.key.before).toBeGreaterThanOrEqual(0);
      expect(def.key.after).toBeGreaterThan(0);
    }
    expect(questions.size).toBe(HUB_ORDER.length);
  });
});

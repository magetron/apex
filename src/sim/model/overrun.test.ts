import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../../spec/catalog';
import { liftOff } from '../scenarios/lift-off';
import { lapCar } from '../track/lap';
import {
  carParams,
  createState,
  DT,
  engineBraking,
  engineRpm,
  FL,
  FR,
  frontLoadOf,
  G,
  gearRatios,
  LIFT_BAND,
  lateralLimit,
  liftRpm,
  overrun,
  REF_LATERAL_LIMIT,
  resetState,
  RL,
  RR,
  speedOf,
  step,
  type CarParams,
} from './index';

const params = (id: string) => carParams(getVehicle(id));
/** closed-throttle force in g at the car's own lift-off speed (the plan is grip-scaled) */
const liftG = (p: CarParams) => {
  const v = (liftOff.speed.def / 3.6) * Math.sqrt(lateralLimit(p) / REF_LATERAL_LIMIT);
  return overrun(p, v) / (p.m * G);
};

describe('engine braking', () => {
  it('lands in the probe’s range per engine (modern friction to Barnes-Moss as published)', () => {
    // [lo, hi] g at each car's lift-off speed: .tools/tmp/engine-braking.md, a little wider
    const ranges: Record<string, [number, number]> = {
      'porsche-911-992': [0.09, 0.13],
      'porsche-911-gt3-992': [0.18, 0.26],
      'vw-golf-gti-mk8': [0.055, 0.085],
      'mazda-rx8-se3p': [0.09, 0.13],
    };
    for (const [id, [lo, hi]] of Object.entries(ranges)) {
      const g = liftG(params(id));
      expect(g, id).toBeGreaterThan(lo);
      expect(g, id).toBeLessThan(hi);
    }
    // a big NA engine at 9,000 rpm brakes hardest, a small turbo four least
    expect(liftG(params('porsche-911-gt3-992'))).toBeGreaterThan(
      1.5 * liftG(params('porsche-911-992')),
    );
    expect(liftG(params('porsche-911-992'))).toBeGreaterThan(liftG(params('vw-golf-gti-mk8')));
  });

  it('EVs keep the 0.12 g regen default (no regen cut on wheel slip in the model)', () => {
    for (const id of ['tesla-model3-rwd', 'tesla-model3-awd'])
      expect(liftG(params(id))).toBeCloseTo(0.12, 6);
  });

  it('holds the engine at the band: a 992 at about 4,100 rpm in a corner', () => {
    const p = params('porsche-911-992');
    expect(liftRpm(p, 65 / 3.6)).toBeCloseTo(LIFT_BAND * 7500, 6);
    // first gear tops out at 54 km/h: crawling, the engine turns slower
    expect(liftRpm(p, 15 / 3.6)).toBeLessThan(0.4 * 7500);
  });

  it('varies smoothly with speed: no jump from one gear to the next', () => {
    for (const v of listVehicles()) {
      const p = carParams(v);
      let prev = engineBraking(p, 2);
      for (let s = 2 * 1.002; s < 80; s *= 1.002) {
        const f = engineBraking(p, s);
        expect(Math.abs(f / prev - 1), v.id).toBeLessThan(0.005);
        prev = f;
      }
    }
  });

  it('every engine brakes plausibly: 0.03–0.3 g at its lift-off speed', () => {
    for (const v of listVehicles()) {
      const g = liftG(carParams(v));
      expect(g, v.id).toBeGreaterThan(0.03);
      expect(g, v.id).toBeLessThan(0.3);
    }
  });
});

describe('AWD on the overrun', () => {
  /** Lift in a straight line at 60 km/h: front share of the overrun, and its total (N). */
  function lift(p: CarParams) {
    const st = createState();
    resetState(st, p, 0, 0, 0, 60 / 3.6);
    const u = { steer: 0, throttle: 0, brake: 0, esc: false };
    let v = 0;
    for (let i = 0; i < 0.5 * 240; i++) {
      v = speedOf(st);
      step(p, st, u, DT);
    }
    const front = st.fx[FL] + st.fx[FR];
    const total = front + st.fx[RL] + st.fx[RR];
    return { share: front / total, total, want: -overrun(p, v), loadF: frontLoadOf(st) };
  }

  it('splits the engine braking through the same coupling as the drive', () => {
    // open centre diff (S4 B8, 40:60), front-primary clutch (Golf R, 80% to the front at
    // preload), dual motors (Model 3 AWD): their nominal split
    for (const id of ['audi-s4-b8', 'vw-golf-r-mk8', 'tesla-model3-awd']) {
      const p = params(id);
      const r = lift(p);
      expect(r.total / r.want, id).toBeCloseTo(1, 3);
      expect(r.share, id).toBeCloseTo(p.drive.frontShare, 3);
      expect(r.share, id).toBeGreaterThan(0.2);
      expect(r.share, id).toBeLessThan(0.9);
    }
    // locked shafts (Fortuner's transfer case): where the load is, and that moves forward
    const p = params('toyota-fortuner-an160');
    expect(p.drive.device?.type).toBe('locked');
    const r = lift(p);
    expect(r.total / r.want).toBeCloseTo(1, 3);
    expect(r.share).toBeCloseTo(r.loadF, 2);
  });
});

describe('one gearbox for the hot lap and the drive', () => {
  it('the lap car drives on the model’s ratios', () => {
    for (const id of ['porsche-911-992', 'fiat-500-1957', 'tesla-model3-awd']) {
      const p = params(id);
      expect(lapCar(p).ratios).toEqual(gearRatios(p).ratios);
      expect(lapCar(p).vTop).toBe(gearRatios(p).vTop);
    }
  });

  it('on a lift the dash shows the engine-braking rpm, in the gear nearest it', () => {
    const p = params('porsche-911-992');
    const { ratios } = gearRatios(p);
    // a gear is never more than half a step (and the hysteresis) from the band
    const most = 0.6 * Math.log(ratios[0] / ratios[1]) + 1e-9;
    const gs = { gear: 1 };
    let gear = 1;
    for (let kmh = 120; kmh >= 5; kmh -= 0.5) {
      const v = kmh / 3.6;
      expect(engineRpm(p, v, 0, gs)).toBeCloseTo(liftRpm(p, v), 6);
      // down a gear at a time as the car slows
      if (kmh < 119) expect(gear - gs.gear).toBeGreaterThanOrEqual(0);
      expect(gear - gs.gear).toBeLessThanOrEqual(1);
      gear = gs.gear;
      const inGear = (v / p.wheelRadius) * ratios[gs.gear - 1] * (30 / Math.PI);
      if (kmh > 40) expect(Math.abs(Math.log(inGear / liftRpm(p, v)))).toBeLessThan(most);
    }
    // on the throttle, the automatic on the same ratios
    expect(engineRpm(p, 100 / 3.6, 0.5, gs)).toBeLessThanOrEqual(7500 * (0.55 + 0.37 * 0.5));
  });
});

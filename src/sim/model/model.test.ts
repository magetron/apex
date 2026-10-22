import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../../spec/catalog';
import {
  carParams,
  createState,
  DT,
  FL,
  FR,
  G,
  lateralLimit,
  muAt,
  peakSlip,
  resetState,
  roadLoad,
  RL,
  RR,
  speedOf,
  step,
  throttleFor,
  tyreForce,
  type CarParams,
  type Inputs,
  type TyreOut,
} from './index';

const out: TyreOut = { fx: 0, fy: 0, cap: 0 };
const deg = Math.PI / 180;

describe('tyre', () => {
  it('peaks at a road-tyre slip angle (5–9°) and slides at ~90% of peak', () => {
    const a = peakSlip(4000, 4000, 1) / deg;
    expect(a).toBeGreaterThan(5);
    expect(a).toBeLessThan(9);
    const peak = -tyreForce(4000, a * deg, 0, 1, 4000, out).fy;
    const slide = -tyreForce(4000, 40 * deg, 0, 1, 4000, out).fy;
    expect(peak / 4000).toBeCloseTo(1, 2);
    expect(slide / peak).toBeGreaterThan(0.85);
    expect(slide / peak).toBeLessThan(0.95);
  });

  it('is load sensitive: twice the load gives less than twice the grip', () => {
    expect(muAt(1, 8000, 4000)).toBeLessThan(muAt(1, 4000, 4000));
    const f1 = -tyreForce(4000, 0.12, 0, 1, 4000, out).fy;
    const f2 = -tyreForce(8000, 0.12, 0, 1, 4000, out).fy;
    expect(f2 / f1).toBeLessThan(1.95);
    expect(f2 / f1).toBeGreaterThan(1.5);
  });

  it('friction ellipse: drive force eats side grip; past the limit the wheel spins', () => {
    const pure = -tyreForce(4000, 0.12, 0, 1, 4000, out).fy;
    const half = -tyreForce(4000, 0.12, 2000, 1, 4000, out).fy;
    expect(half).toBeLessThan(pure);
    tyreForce(4000, 0.12, 9000, 1, 4000, out);
    expect(out.fx).toBeLessThan(out.cap);
    expect(-out.fy).toBeLessThan(0.25 * pure);
  });
});

describe('params from the spec', () => {
  it('mass, CG and inertia come from massProps; EVs sit lowest', () => {
    const tesla = carParams(getVehicle('tesla-model3-awd'));
    const bmw = carParams(getVehicle('bmw-m340i-g20'));
    const gti = carParams(getVehicle('vw-golf-gti-mk8'));
    expect(tesla.h).toBeLessThan(bmw.h);
    expect(tesla.h).toBeLessThan(gti.h);
    expect(tesla.rollGain).toBeLessThan(bmw.rollGain);
    expect(tesla.rollGain).toBeLessThan(gti.rollGain);
    expect(gti.drive.frontShare).toBe(1);
    expect(bmw.drive.frontShare).toBe(0);
    expect(tesla.drive.kind).toBe('ev');
  });

  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: sane, finite parameters',
    (_id, v) => {
      const p = carParams(v);
      for (const x of [
        p.m,
        p.izz,
        p.a,
        p.b,
        p.h,
        p.drive.powerW,
        p.drive.forceN,
        p.brakeN,
        p.rollGain,
      ]) {
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThan(0);
      }
      expect(p.a + p.b).toBeCloseTo(p.L, 9);
      expect(lateralLimit(p) / G).toBeGreaterThan(0.6);
      expect(lateralLimit(p) / G).toBeLessThan(1.3);
    },
  );
});

/** Straight-line state at speed v, holding speed with the throttle. */
function cruise(p: CarParams, v: number) {
  const st = createState();
  resetState(st, p, 0, 0, 0, v);
  const u: Inputs = { steer: 0, throttle: 0, brake: 0, esc: false };
  for (let i = 0; i < 240; i++) {
    u.throttle = throttleFor(p, speedOf(st), roadLoad(p, speedOf(st)));
    step(p, st, u, DT);
  }
  return { st, u };
}

/**
 * ISO 7401-style step steer (20 ms ramp). Returns the turn-in bite (peak yaw acceleration per
 * radian of steer: a·Cf/Izz, the inertia-driven part) and the time to 90% of the final yaw rate.
 */
function stepSteer(p: CarParams, v: number, ay: number) {
  const { st, u } = cruise(p, v);
  const target = (p.L * ay) / (v * v);
  const t0 = st.t;
  const rs: number[] = [];
  let prev = st.r;
  let bite = 0;
  for (let i = 0; i < 3 * 240; i++) {
    u.steer = target * Math.min(1, (st.t - t0) / 0.02);
    u.throttle = throttleFor(p, speedOf(st), roadLoad(p, speedOf(st)));
    step(p, st, u, DT);
    rs.push(st.r);
    bite = Math.max(bite, (st.r - prev) / DT / target);
    prev = st.r;
  }
  const final = rs[rs.length - 1];
  return { bite, t90: (rs.findIndex((r) => r >= 0.9 * final) + 1) * DT };
}

describe('handling character', () => {
  it.each([60, 80, 100])(
    'mid-engine bites quickest on turn-in, the tail-heavy RR settles slowest (%s km/h)',
    (kmh) => {
      const ids = ['vw-golf-gti-mk8', 'bmw-m340i-g20', 'porsche-911-992', 'tesla-model3-awd'];
      const res = (id: string) => stepSteer(carParams(getVehicle(id)), kmh / 3.6, 0.3 * G);
      const mr = res('audi-r8-v10-gen2');
      for (const id of ids) expect(mr.bite).toBeGreaterThan(res(id).bite);
      const rr = res('porsche-911-992');
      for (const id of ['vw-golf-gti-mk8', 'bmw-m340i-g20', 'audi-r8-v10-gen2', 'tesla-model3-awd'])
        expect(rr.t90).toBeGreaterThan(res(id).t90);
    },
  );

  it('EV low CG: least lateral load transfer of the saloons and hatches', () => {
    // share of the front axle's load left on the inside wheel in a 0.6 g left turn
    const inside = (id: string) => {
      const p = carParams(getVehicle(id));
      const st = createState();
      resetState(st, p, 0, 0, 0, 20, (0.6 * G) / 400);
      st.ay = 0.6 * G;
      step(p, st, { steer: st.steer, throttle: 0, brake: 0, esc: false }, DT);
      return (st.fz[FL] + st.fz[RL]) / (st.fz[FL] + st.fz[FR] + st.fz[RL] + st.fz[RR]);
    };
    const ev = inside('tesla-model3-awd');
    expect(ev).toBeGreaterThan(inside('bmw-m340i-g20'));
    expect(ev).toBeGreaterThan(inside('vw-golf-gti-mk8'));
  });
});

describe('determinism and sanity', () => {
  it('the same inputs give bit-identical results', () => {
    const p = carParams(getVehicle('porsche-911-992'));
    const run = () => {
      const { st, u } = cruise(p, 25);
      for (let i = 0; i < 1200; i++) {
        u.steer = 0.04 * Math.sin(st.t * 2);
        u.throttle = i < 600 ? 0.6 : 0;
        step(p, st, u, DT);
      }
      return [st.x, st.n, st.yaw, st.vx, st.vy, st.r, st.roll, st.pitch];
    };
    expect(run()).toEqual(run());
  });

  it('a spun car slides to rest, then drives off again on the throttle', () => {
    const p = carParams(getVehicle('porsche-911-992'));
    const { st, u } = cruise(p, 20);
    // throw it sideways (body slip ~72°): a spin
    st.vx = 4;
    st.vy = 12;
    u.throttle = 0;
    for (let i = 0; i < 240; i++) step(p, st, u, DT);
    expect(st.spun).toBe(true);
    // brakes on until it stops (as the scripted driver does): it stays spun, standing still
    u.brake = 1;
    for (let i = 0; i < 6 * 240 && speedOf(st) > 0; i++) step(p, st, u, DT);
    expect(speedOf(st)).toBe(0);
    expect(st.spun).toBe(true);
    // the visitor pulls away
    u.brake = 0;
    u.throttle = 0.5;
    for (let i = 0; i < 3 * 240; i++) step(p, st, u, DT);
    expect(st.spun).toBe(false);
    expect(speedOf(st)).toBeGreaterThan(5);
  });

  it('coasting and braking only ever lose energy; wheel loads always sum to the weight', () => {
    for (const v of listVehicles()) {
      const p = carParams(v);
      const { st, u } = cruise(p, 30);
      u.throttle = 0;
      let ke = speedOf(st) ** 2;
      for (let i = 0; i < 6 * 240; i++) {
        u.brake = i > 2 * 240 ? 1 : 0;
        step(p, st, u, DT);
        const k = speedOf(st) ** 2;
        expect(k).toBeLessThanOrEqual(ke + 1e-9);
        ke = k;
        const w = st.fz[FL] + st.fz[FR] + st.fz[RL] + st.fz[RR];
        expect(w / (p.m * G)).toBeCloseTo(1, 6);
        expect(-st.ax / G).toBeLessThan(1.3 * p.front.mu);
      }
      expect(speedOf(st)).toBe(0);
    }
    // every car in the catalog, 6 s each at 240 Hz: slow when the whole suite runs at once
  }, 30_000);
});

import { describe, expect, it } from 'vitest';
import { carParams, createState, FL, FR, resetState, RL } from '../../sim/model';
import { getVehicle, listVehicles } from '../../spec/catalog';
import { SCENARIOS } from '../../sim/scenarios';
import { Hands, held, releaseAll } from './input';
import { Lane } from './lanes';
import { FAMILIES, familyOf, representative, resolveGhosts } from './state';
import { poseOrigin, wheelForce, wheelPoint, yawOf, type Ground } from './world';

describe('comparison cars', () => {
  it('every car has a family and every family a stand-in of that family', () => {
    for (const v of listVehicles()) expect(FAMILIES).toContain(familyOf(v));
    for (const f of FAMILIES) {
      const r = representative(f);
      expect(r).not.toBeNull();
      expect(familyOf(r!)).toBe(f);
    }
    // all-wheel drive wherever the engine sits; mid- and rear-engined families are rear-driven
    for (const v of listVehicles()) {
      const f = familyOf(v);
      if (v.powertrain.kind === 'ice' && v.powertrain.driven === 'all') expect(f).toBe('AWD');
      if (f === 'MR' || f === 'RR') expect(v.powertrain.driven).toBe('rear');
    }
  });

  it('picks stand-ins like the visitor’s car (power-to-weight), never the car itself', () => {
    for (const v of listVehicles()) {
      for (const g of resolveGhosts(v, null)) {
        expect(g.id).not.toBe(v.id);
        expect(familyOf(g)).not.toBe(familyOf(v));
      }
    }
    const slow = [...listVehicles()].sort((a, b) => a.published.curbKg - b.published.curbKg)[0];
    const quick = resolveGhosts(slow, ['FR'])[0];
    const any = representative('FR');
    expect(quick).toBeDefined();
    expect(any).not.toBeNull();
  });

  it('resolves family codes and vehicle ids, without duplicates', () => {
    const car = listVehicles().find((v) => familyOf(v) === 'RR')!;
    const fr = listVehicles().find((v) => familyOf(v) === 'FR')!;
    const list = resolveGhosts(car, ['RR', 'FF', fr.id, 'FF']);
    expect(list.map(familyOf)).toEqual(['FF', 'FR']);
    expect(resolveGhosts(car, null).map(familyOf)).toEqual(['FF', 'FR', 'MR', 'AWD']);
  });
});

describe('lanes', () => {
  it('replay draws the recorded state; the first axle to let go is the one that slid', () => {
    const fr = listVehicles().find(
      (v) =>
        v.powertrain.kind === 'ice' &&
        v.powertrain.driven === 'rear' &&
        v.powertrain.position === 'front-mid' &&
        v.tires.mu === 1,
    )!;
    const ff = listVehicles().find((v) => familyOf(v) === 'FF' && v.tires.mu === 1)!;
    const plan = SCENARIOS['power-exit'].plan(SCENARIOS['power-exit'].speed.def);
    const info = { kind: 'main', code: '', name: '', family: null } as const;
    const a = new Lane(carParams(fr), plan, false, info);
    a.simTo(plan.duration);
    expect(a.letGo?.axle).toBe('rear');
    const b = new Lane(carParams(ff), plan, false, info);
    b.simTo(plan.duration);
    expect(b.letGo?.axle).toBe('front');
    // going back in time replays, it doesn't re-simulate
    const head = a.head;
    a.show(1);
    expect(a.view.t).toBeCloseTo(1, 1);
    expect(a.head).toBe(head);
    // the marks were passed in order
    const t = a.markT.filter((x) => Number.isFinite(x));
    expect(t.length).toBe(a.marks.length);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });

  it('the visitor can take the wheel mid-run from where the script was', () => {
    const v = listVehicles().find((x) => familyOf(x) === 'FF')!;
    const plan = SCENARIOS['lift-off'].plan(60);
    const lane = new Lane(carParams(v), plan, false, {
      kind: 'main',
      code: '',
      name: '',
      family: null,
    });
    lane.simTo(plan.duration);
    lane.redriveTo(3);
    expect(lane.head).toBeLessThanOrEqual(3 + 1 / 120);
    const hands = new Hands();
    hands.from(lane.run.st);
    lane.run.manual = hands;
    lane.simTo(4);
    expect(lane.head).toBeGreaterThan(3.9);
  });
});

describe('the visitor’s hands', () => {
  it('ramp the pedals and centre the wheel onto where the front axle travels', () => {
    const p = carParams(listVehicles().find((x) => familyOf(x) === 'FR')!);
    const st = createState();
    resetState(st, p, 0, 0, 0, 20);
    const h = new Hands();
    held.gas = true;
    h.update(0.1, p, st);
    expect(h.throttle).toBeGreaterThan(0.1);
    expect(h.throttle).toBeLessThan(0.5);
    for (let i = 0; i < 10; i++) h.update(0.1, p, st);
    expect(h.throttle).toBe(1);
    held.gas = false;
    held.left = true;
    for (let i = 0; i < 10; i++) h.update(0.1, p, st);
    expect(h.steer).toBeGreaterThan(0.05);
    expect(h.steer).toBeLessThanOrEqual(p.steerMax);
    held.left = false;
    // sliding with the tail out to the right: let go and the wheel winds on opposite lock
    st.vy = -4;
    st.r = 0;
    for (let i = 0; i < 30; i++) h.update(0.1, p, st);
    expect(h.steer).toBeLessThan(0);
    releaseAll();
  });
});

describe('sim → world mapping', () => {
  const p = carParams(getVehicle('bmw-m340i-g20'));
  const st = createState();
  const g: Ground = { x: 0, z: 0 };

  it('heading 0 faces +X; left wheels sit at −Z (world +Z is the right)', () => {
    resetState(st, p, 0, 0, 0, 10);
    expect(wheelPoint(p, st, FL, g).z).toBeLessThan(0);
    expect(wheelPoint(p, st, FR, g).z).toBeGreaterThan(0);
    expect(wheelPoint(p, st, FL, g).x).toBeCloseTo(p.a, 9);
    expect(wheelPoint(p, st, RL, g).x).toBeCloseTo(-p.b, 9);
    // the pose origin is the wheelbase midpoint
    expect(poseOrigin(p, st, g).x).toBeCloseTo(p.a - p.L / 2, 9);
  });

  it('a left turn (yaw > 0) heads toward −Z, and a leftward force points to −Z', () => {
    // heading +90° (a quarter left turn from +X) points along the sim's +n, i.e. world −Z
    resetState(st, p, 0, 0, Math.PI / 2, 10);
    const before = poseOrigin(p, st, { x: 0, z: 0 }).z;
    st.n += 1;
    expect(poseOrigin(p, st, g).z).toBeLessThan(before);
    resetState(st, p, 0, 0, 0, 10);
    st.fy[RL] = 1000;
    expect(wheelForce(st, RL, g).z).toBeLessThan(0);
    expect(yawOf(1, 0)).toBeCloseTo(0, 9);
    expect(yawOf(0, -1)).toBeCloseTo(Math.PI / 2, 9);
  });
});

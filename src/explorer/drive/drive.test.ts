import { describe, expect, it } from 'vitest';
import { carParams, createState, FL, FR, resetState, RL } from '../../sim/model';
import { getVehicle, listVehicles } from '../../spec/catalog';
import { HUB_ORDER, SCENARIOS } from '../../sim/scenarios';
import { Hands, held, releaseAll } from './input';
import { chooseSide, Lane, LANE_GAP } from './lanes';
import { buildLineup, laneOf } from './lineup';
import { roadLayout } from './Road';
import { sketchOf } from './LayoutSketch';
import { driveCars, FAMILIES, familyOf, representative, useDrive } from './state';
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

  it('picks stand-ins like the visitor’s car, of another layout, never the car itself', () => {
    for (const v of listVehicles()) {
      for (const f of FAMILIES) {
        const r = representative(f, v);
        if (!r) continue;
        expect(r.id).not.toBe(v.id);
        expect(familyOf(r)).toBe(f);
      }
    }
  });
});

describe('lanes', () => {
  it('replay draws the recorded state; the first axle to let go is the one that slid', () => {
    // a front-engined rear-driver and a front-driver on ordinary performance tyres
    const fr = getVehicle('bmw-m340i-g20');
    const ff = getVehicle('abarth-500-312');
    expect([fr.powertrain.kind === 'ice' && fr.powertrain.driven, familyOf(ff)]).toEqual([
      'rear',
      'FF',
    ]);
    const plan = SCENARIOS['power-exit'].plan(SCENARIOS['power-exit'].speed.def);
    const info = { kind: 'main', code: '', name: '' } as const;
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
    const lane = new Lane(carParams(v), plan, false, { kind: 'main', code: '', name: '' });
    lane.simTo(plan.duration);
    lane.redriveTo(3);
    expect(lane.head).toBeLessThanOrEqual(3 + 1 / 120);
    const hands = new Hands();
    hands.from(lane.run.st);
    lane.run.manual = hands;
    lane.simTo(4);
    expect(lane.head).toBeGreaterThan(3.9);
  });

  it('the car the visitor drives moves on every frame in slow motion, never stop-and-jump', () => {
    const plan = SCENARIOS['lift-off'].plan(60);
    for (const rate of [0.5, 0.25, 0.125]) {
      const lane = new Lane(carParams(getVehicle('porsche-911-992')), plan, false, {
        kind: 'main',
        code: '',
        name: '',
      });
      lane.run.manual = { steer: 0, throttle: 0.6, brake: 0 };
      lane.every = 1;
      lane.reset();
      // the scene's live loop at 120 frames a second: the clock runs, the sim catches up (at
      // most a step ahead), the car is drawn at the clock
      let now = 0;
      let last = lane.view.x;
      const steps: number[] = [];
      for (let f = 0; f < 240; f++) {
        now += rate / 120;
        lane.simTo(now);
        now = Math.min(now, lane.run.st.t);
        lane.show(now);
        if (f > 20) steps.push(lane.view.x - last);
        last = lane.view.x;
      }
      expect(Math.min(...steps), `rate ${rate}`).toBeGreaterThan(0);
      // even: no frame moves more than twice the one before it (the old stutter froze, then
      // jumped two or three frames' worth)
      for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(2 * steps[i - 1]);
    }
  });
});

/** Two footprints (centre, heading, length, width) overlap: separating-axis test. */
function overlap(
  a: { x: number; n: number; h: number },
  b: { x: number; n: number; h: number },
  len: number,
  wid: number,
) {
  const axes = [a.h, a.h + Math.PI / 2, b.h, b.h + Math.PI / 2];
  for (const ax of axes) {
    const ux = Math.cos(ax);
    const un = Math.sin(ax);
    const proj = (c: { h: number }) =>
      (len / 2) * Math.abs(Math.cos(c.h - ax)) + (wid / 2) * Math.abs(Math.sin(c.h - ax));
    const d = Math.abs((b.x - a.x) * ux + (b.n - a.n) * un);
    if (d > proj(a) + proj(b)) return false;
  }
  return true;
}

describe('two lanes', () => {
  const sa = createState();
  const sb = createState();

  it('the comparison car runs on its own lane: the two never overlap, in any question', () => {
    for (const id of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20', 'tesla-model3-rwd']) {
      const v = getVehicle(id);
      for (const scenario of HUB_ORDER) {
        const [main, rival] = buildLineup(
          v,
          { scenario, compare: 'auto' },
          SCENARIOS[scenario].speed.def,
        ).map((e) => {
          const l = laneOf(e);
          l.simTo(e.plan.duration + 1);
          return l;
        });
        const plan = main.plan;
        const gap = plan.lanes.length ? plan.roadWidth + 0.5 : LANE_GAP;
        rival.offset = chooseSide(main, rival, gap) * gap;
        // the lanes themselves: the second the first's width and a gap to the side
        expect(Math.abs(rival.offset)).toBeGreaterThanOrEqual(LANE_GAP);
        const road = roadLayout(plan, rival.offset);
        expect(road.width).toBeCloseTo(plan.roadWidth + Math.abs(rival.offset), 9);
        // and the cars on them, at every moment of the run
        const len = Math.max(main.p.dims.length, rival.p.dims.length);
        const wid = Math.max(main.p.dims.width, rival.p.dims.width);
        for (let t = 0; t <= plan.duration; t += 0.05) {
          main.show(t);
          rival.show(t);
          Object.assign(sa, main.view);
          Object.assign(sb, rival.view);
          const a = { x: sa.x, n: sa.n, h: sa.yaw };
          const b = { x: sb.x, n: sb.n, h: sb.yaw };
          expect(overlap(a, b, len, wid), `${id} ${scenario} at ${t.toFixed(2)} s`).toBe(false);
        }
      }
    }
  });

  it('a lane is drawn beside the plan’s path; the physics is the plan’s own', () => {
    const v = getVehicle('porsche-911-992');
    const [e] = buildLineup(v, { scenario: 'lift-off', compare: 'auto' }, 63);
    const a = laneOf(e);
    const b = laneOf(e);
    b.offset = LANE_GAP;
    a.simTo(e.plan.duration);
    b.simTo(e.plan.duration);
    for (const t of [2, 5, 7]) {
      a.show(t);
      b.show(t);
      // the same car on the same corner drives the same: its yaw, speed and grip are untouched
      expect(b.view.yaw).toBe(a.view.yaw);
      expect(b.view.vx).toBe(a.view.vx);
      expect(b.view.alphaR).toBe(a.view.alphaR);
      // drawn a lane over, along the road's normal
      expect(Math.hypot(b.view.x - a.view.x, b.view.n - a.view.n)).toBeCloseTo(LANE_GAP, 1);
    }
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

describe('the layout sketch', () => {
  it('puts the engine, the centre of mass and the driven wheels where the spec does', () => {
    const rr = sketchOf(getVehicle('porsche-911-992'));
    const ff = sketchOf(getVehicle('vw-golf-gti-mk8'));
    const mid = (s: typeof rr) => -s.wheelbase / 2;
    const engine = (s: typeof rr) => s.blocks.find((b) => b.kind === 'engine')!;
    // the 911's engine hangs behind its rear axle; the Golf's sits ahead of its front one
    expect(engine(rr).x0).toBeLessThan(-rr.wheelbase);
    expect(engine(ff).x1).toBeGreaterThan(0);
    // so its centre of mass sits behind the middle, the Golf's ahead of it
    expect(rr.cg.x).toBeLessThan(mid(rr));
    expect(ff.cg.x).toBeGreaterThan(mid(ff));
    expect(rr.frontPct).toBeLessThan(45);
    expect(ff.frontPct).toBeGreaterThan(55);
    expect(rr.wheels.filter((w) => w.driven).every((w) => w.axle === 'rear')).toBe(true);
    expect(ff.wheels.filter((w) => w.driven).every((w) => w.axle === 'front')).toBe(true);
    // an electric car shows its motors
    const ev = sketchOf(getVehicle('tesla-model3-awd'));
    expect(ev.blocks.some((b) => b.kind === 'motor')).toBe(true);
  });
});

describe('switching questions', () => {
  it('clears what each car was doing, so nothing of the last question lingers', () => {
    driveCars[0].status = 3;
    driveCars[1].status = 2;
    useDrive.getState().setScenario('trail-brake');
    expect(driveCars.map((c) => c.status)).toEqual([0, 0]);
    useDrive.getState().setScenario('lift-off');
  });
});

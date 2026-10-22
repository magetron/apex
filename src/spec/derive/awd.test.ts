import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../catalog';
import type { AwdDevice, VehicleSpec } from '../types';
import {
  AWD_RESPONSE,
  awdPartId,
  awdResponse,
  awdSystem,
  axleTorque,
  fmtSplit,
  newAwdState,
  type AwdSystem,
} from './awd';

const sys = (id: string) => awdSystem(getVehicle(id))!;
/** A catalog car with another AWD device fitted (same masses, same base split). */
const withDevice = (id: string, awdDevice: AwdDevice): AwdSystem => {
  const v = getVehicle(id);
  return awdSystem({ ...v, powertrain: { ...v.powertrain, awdDevice } } as VehicleSpec)!;
};
const total = (s: { front: number; rear: number }) => s.front + s.rear;
const ICE = 0.1;
const LATER = 2;

describe('AWD torque split', () => {
  const awd = listVehicles().filter((v) => v.powertrain.driven === 'all');

  it.each(awd.map((v) => [v.id, v] as const))(
    '%s: dry and straight, every bit of torque reaches the road at the nominal split',
    (_id, v) => {
      const s = awdSystem(v)!;
      expect(s.base).toBeGreaterThanOrEqual(s.range[0]);
      expect(s.base).toBeLessThanOrEqual(s.range[1]);
      const st = axleTorque(s, 1, 1);
      expect(total(st)).toBeCloseTo(1, 6);
      expect(st.spinFront || st.spinRear).toBe(false);
      // (a clutch may have to help a nose-heavy car off the line even on dry tarmac: Tiguan)
      if (s.type !== 'locked' && st.lock === 0) expect(st.front).toBeCloseTo(s.base, 6);
    },
  );

  it.each(awd.map((v) => [v.id, v] as const))(
    '%s: torque never exceeds the input, and more grip never puts less down',
    (_id, v) => {
      const s = awdSystem(v)!;
      for (const t of [0, 0.1, 0.3, Infinity]) {
        let prev = 0;
        for (const g of [0, 0.1, 0.3, 0.6, 1]) {
          const st = axleTorque(s, g, 1, t);
          expect(st.front).toBeGreaterThanOrEqual(-1e-9);
          expect(st.rear).toBeGreaterThanOrEqual(-1e-9);
          expect(total(st)).toBeLessThanOrEqual(1 + 1e-9);
          expect(total(st)).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = total(st);
        }
      }
    },
  );

  it('open centre diff: the split stays fixed, so the axle on ice caps both', () => {
    const s = withDevice('audi-rs6-avant-c8', { type: 'open' });
    const st = axleTorque(s, ICE, 1);
    expect(st.front / total(st)).toBeCloseTo(0.4, 6);
    expect(st.spinFront).toBe(true);
    expect(st.spinRear).toBe(false);
    expect(total(st)).toBeLessThan(0.35);
  });

  it('Torsen (RS 6): biases up to its limits, instantly', () => {
    const s = sys('audi-rs6-avant-c8');
    expect(s.type).toBe('torque-sensing');
    const open = axleTorque(withDevice('audi-rs6-avant-c8', { type: 'open' }), ICE, 1);
    const front = axleTorque(s, ICE, 1, 0);
    // front on ice: at its 15:85 limit, the front still spins
    expect(front.front / total(front)).toBeCloseTo(0.15, 6);
    expect(front.spinFront).toBe(true);
    expect(total(front)).toBeGreaterThan(2 * total(open));
    expect(front.lock).toBeCloseTo(1, 6);
    // rear on ice: 70:30
    const rear = axleTorque(s, 1, ICE, 0);
    expect(rear.front / total(rear)).toBeCloseTo(0.7, 6);
    // no time dependence
    expect(axleTorque(s, ICE, 1, LATER)).toEqual(front);
  });

  it('Torsen: an axle with no grip at all leaves the other with nothing to bias against', () => {
    expect(total(axleTorque(sys('audi-rs6-avant-c8'), 0, 1))).toBeCloseTo(0, 9);
  });

  it('DCCD (WRX STI): 41:59 open, then the clutch locks it once an axle spins', () => {
    const s = sys('subaru-wrx-sti');
    expect(s.type).toBe('locking-clutch');
    const dry = axleTorque(s, 1, 1);
    expect(fmtSplit(dry.front)).toBe('41:59');
    expect(dry.lock).toBe(0);
    const first = axleTorque(s, ICE, 1, 0);
    const later = axleTorque(s, ICE, 1, LATER);
    expect(first.front / total(first)).toBeCloseTo(0.41, 6);
    expect(later.lock).toBeGreaterThan(0.99);
    expect(total(later)).toBeGreaterThan(2.5 * total(first));
    // the driver's lock makes it rigid from the start
    const locked = axleTorque(s, ICE, 1, 0, { locked: true });
    expect(total(locked)).toBeCloseTo(total(later), 2);
  });

  it('viscous coupling (Delta Integrale): slower than a locking clutch and never fully rigid', () => {
    const vc = sys('lancia-delta-integrale-evo2');
    const lc = withDevice('lancia-delta-integrale-evo2', { type: 'locking-clutch' });
    expect(vc.type).toBe('viscous');
    expect(axleTorque(vc, ICE, 1, 0.1).lock).toBeLessThan(axleTorque(lc, ICE, 1, 0.1).lock);
    expect(axleTorque(vc, ICE, 1, LATER).lock).toBeLessThan(0.9);
  });

  it('Haldex-type (Golf R): front-driven until the front spins, then rear a beat later, up to 50 %', () => {
    const s = sys('vw-golf-r-mk8');
    expect(s.primary).toBe('front');
    const dry = axleTorque(s, 1, 1);
    expect(fmtSplit(dry.front)).toBe('80:20');
    // before the clutch reacts the rear only gets its preload
    const early = axleTorque(s, ICE, 1, AWD_RESPONSE.clutch.delayS * 0.9);
    expect(early.rear).toBeCloseTo(0.2, 6);
    expect(early.spinFront).toBe(true);
    const later = axleTorque(s, ICE, 1, LATER);
    expect(later.rear).toBeCloseTo(0.5, 3);
    expect(later.spinFront).toBe(true);
    // rear on ice: the front just carries on
    const rear = axleTorque(s, 1, ICE, LATER);
    expect(total(rear)).toBeCloseTo(1, 6);
    expect(rear.spinRear).toBe(false);
  });

  it('GR-Four: a clutch that may send everything rearward stops the front spinning', () => {
    const later = axleTorque(sys('toyota-gr-yaris-gxpa16'), ICE, 1, LATER);
    expect(total(later)).toBeCloseTo(1, 3);
    expect(later.spinFront).toBe(false);
  });

  it('rear-biased clutch (R8): the mirror case', () => {
    const s = sys('audi-r8-v10-gen2');
    expect(s.primary).toBe('rear');
    // front on ice: hardly matters, the rear is driven directly
    expect(total(axleTorque(s, ICE, 1, 0))).toBeGreaterThan(0.95);
    // rear on ice: the rear spins until the front clutch closes
    const early = axleTorque(s, 1, ICE, 0);
    const later = axleTorque(s, 1, ICE, LATER);
    expect(early.spinRear).toBe(true);
    expect(early.front).toBeCloseTo(0.3, 6);
    expect(later.front).toBeGreaterThan(2 * early.front);
  });

  it('part-time transfer case (Wrangler 4H): locked, follows load and grip, binds in tight turns', () => {
    const s = sys('jeep-wrangler-rubicon-392-jl');
    expect(s.type).toBe('locked');
    const front = axleTorque(s, ICE, 1);
    expect(front.rear / total(front)).toBeGreaterThan(0.85);
    const dry = axleTorque(s, 1, 1, Infinity, { turn: true });
    expect(dry.bind).toBeGreaterThan(0.2);
    expect(dry.front).toBeLessThan(0.1);
    expect(dry.spinRear).toBe(true);
    // on a slippery surface the tyres let the shafts unwind
    const slippery = axleTorque(s, 0.3, 0.3, Infinity, { turn: true });
    expect(slippery.bind).toBeLessThan(dry.bind / 2);
  });

  it('diffs and clutches let the axles turn at different speeds: no wind-up', () => {
    for (const id of ['audi-rs6-avant-c8', 'vw-golf-r-mk8', 'audi-r8-v10-gen2', 'subaru-wrx-sti']) {
      expect(axleTorque(sys(id), 1, 1, Infinity, { turn: true }).bind).toBe(0);
    }
    // ...until the driver locks the centre diff
    const locked = axleTorque(sys('subaru-wrx-sti'), 1, 1, Infinity, { turn: true, locked: true });
    expect(locked.bind).toBeGreaterThan(0.2);
  });

  it('two motors: each axle keeps its own motor, the other cannot borrow it', () => {
    const s = sys('tesla-model3-awd');
    expect(s.type).toBe('motors');
    const st = axleTorque(s, ICE, 1, LATER);
    expect(st.rear).toBeCloseTo(1 - s.base, 6);
    expect(st.spinFront).toBe(true);
  });

  it('the step response starts at t = 0 and reuses no state between calls', () => {
    const r = awdResponse(sys('vw-golf-r-mk8'), ICE, 1, {}, 1, 11);
    expect(r.t[0]).toBe(0);
    expect(r.t[10]).toBe(1);
    expect(r.rear[0]).toBeCloseTo(0.2, 6);
    expect(r.rear[10]).toBeGreaterThan(r.rear[0]);
    const out = newAwdState();
    expect(axleTorque(sys('vw-golf-r-mk8'), 1, 1, 0, {}, out)).toBe(out);
  });

  it('finds the part that does the splitting', () => {
    expect(awdPartId(getVehicle('vw-golf-r-mk8'))).toBe('coupling');
    expect(awdPartId(getVehicle('audi-rs6-avant-c8'))).toBe('coupling');
    expect(awdPartId(getVehicle('jeep-wrangler-rubicon-392-jl'))).toBe('coupling');
    expect(awdPartId(getVehicle('audi-r8-v10-gen2'))).toBe('diff-front');
    expect(awdPartId(getVehicle('tesla-model3-awd'))).toBeNull();
    expect(awdPartId(getVehicle('vw-golf-gti-mk8'))).toBeNull();
  });
});

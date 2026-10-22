import { describe, expect, it } from 'vitest';
import { getEngine, listEngines } from '../catalog';
import { angleDiff } from '../units';
import {
  balance,
  bankCylinders,
  cylinderState,
  envelope,
  firingIntervals,
  headCylinders,
  strokeOf,
  tdcDeg,
} from './index';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('firing', () => {
  it.each([
    ['i3', 240],
    ['i4', 180],
    ['i5', 144],
    ['i6', 120],
    ['flat6', 120],
    ['vr6', 120],
    ['v8-cross', 90],
    ['v8-flat', 90],
    ['v10', 72],
    ['v12', 60],
    ['w12', 60],
    ['w16', 45],
  ])('%s fires evenly every %i°', (id, gap) => {
    const e = getEngine(id);
    for (const g of firingIntervals(e)) expect(g).toBeCloseTo(gap, 6);
  });

  it('cross-plane V8 fires unevenly per bank, flat-plane evenly', () => {
    const cross = getEngine('v8-cross');
    const left = firingIntervals(cross, bankCylinders(cross, 0));
    expect(new Set(left.map((g) => Math.round(g))).size).toBeGreaterThan(1);
    expect(left.reduce((a, b) => a + b, 0)).toBeCloseTo(720);

    const flatPlane = getEngine('v8-flat');
    for (const bank of [0, 1]) {
      for (const g of firingIntervals(flatPlane, bankCylinders(flatPlane, bank)))
        expect(g).toBeCloseTo(180);
    }
  });

  it('every cylinder is at TDC when it fires (specs are self-consistent)', () => {
    // rotaries: rotary.test.ts checks a face at combustion TDC instead of a slider-crank
    for (const e of listEngines().filter((x) => x.family !== 'rotary')) {
      e.cylinders.forEach((c, i) => {
        expect(close(angleDiff(tdcDeg(e, i), c.fireDeg), 0), `${e.id} cyl ${c.num}`).toBe(true);
        expect(cylinderState(e, i, c.fireDeg).travelMm).toBeCloseTo(0, 6);
      });
    }
  });

  it('VR6 shares one head, so one exhaust manifold sees all six evenly', () => {
    const e = getEngine('vr6');
    expect(headCylinders(e, 0)).toHaveLength(6);
  });
});

describe('crank geometry', () => {
  const throws = (id: string) => getEngine(id).cylinders.map((c) => c.throwDeg);
  const rel = (id: string) => {
    const t = throws(id);
    return t.map((x) => Math.round((((x - t[0]) % 360) + 360) % 360));
  };

  it('I4 has a flat crank: 0-180-180-0', () => expect(rel('i4')).toEqual([0, 180, 180, 0]));
  it('I6 crank is mirror-symmetric', () => expect(rel('i6')).toEqual([0, 120, 240, 240, 120, 0]));
  it('I3 pins are 120° apart', () => expect(rel('i3')).toEqual([0, 240, 120]));
  it('flat-plane V8 pins are 0/180, cross-plane pins step by 90°', () => {
    const flatPins = new Set(rel('v8-flat'));
    expect([...flatPins].sort((a, b) => a - b)).toEqual([0, 180]);
    const crossPins = new Set(rel('v8-cross'));
    expect([...crossPins].sort((a, b) => a - b)).toEqual([0, 90, 180, 270]);
  });

  it('V engines with shared pins put both rods on the same throw', () => {
    for (const e of listEngines().filter((x) => x.family === 'v')) {
      const byPin = new Map<number, number[]>();
      for (const c of e.cylinders) byPin.set(c.pin, [...(byPin.get(c.pin) ?? []), c.throwDeg]);
      for (const [pin, t] of byPin) {
        if (t.length === 2)
          expect(close(angleDiff(t[0], t[1]), 0), `${e.id} pin ${pin}`).toBe(true);
      }
    }
  });

  it('90° V10 even-fire needs crank pins split by 18°', () => {
    const e = getEngine('v10');
    const c1 = e.cylinders[0];
    const c6 = e.cylinders[5];
    expect(Math.abs(angleDiff(c1.throwDeg, c6.throwDeg))).toBeCloseTo(18, 6);
  });
});

describe('balance (reciprocating masses, before counterweights)', () => {
  const zero = 1e-6;
  it('inline-6 and 60° V12 are perfectly balanced', () => {
    for (const id of ['i6', 'v12']) {
      const b = balance(getEngine(id));
      expect([b.primary.force, b.primary.couple, b.secondary.force, b.secondary.couple]).toEqual([
        0, 0, 0, 0,
      ]);
    }
  });

  it('inline-4: only a 2nd-order shake, 4× one cylinder, straight up and down', () => {
    const b = balance(getEngine('i4'));
    expect(b.primary.force).toBeLessThan(zero);
    expect(b.primary.couple).toBeLessThan(zero);
    expect(b.secondary.force).toBeCloseTo(4, 3);
    expect(b.secondary.couple).toBeLessThan(zero);
  });

  it('inline-3: forces cancel, rocking couples remain', () => {
    const b = balance(getEngine('i3'));
    expect(b.primary.force).toBeLessThan(zero);
    expect(b.secondary.force).toBeLessThan(zero);
    expect(b.primary.couple).toBeCloseTo(Math.sqrt(3), 3);
    expect(b.secondary.couple).toBeCloseTo(Math.sqrt(3), 3);
  });

  it('flat-plane V8: a 2nd-order horizontal force of 4√2', () => {
    const b = balance(getEngine('v8-flat'));
    expect(b.primary.force).toBeLessThan(zero);
    expect(b.secondary.force).toBeCloseTo(4 * Math.SQRT2, 3);
  });

  it('cross-plane V8: only a rotating primary couple, which counterweights cancel', () => {
    const b = balance(getEngine('v8-cross'));
    expect(b.primary.force).toBeLessThan(zero);
    expect(b.primary.couple).toBeGreaterThan(1);
    expect(b.primary.coupleRotating).toBe(true);
    expect(b.secondary.force).toBeLessThan(zero);
    expect(b.secondary.couple).toBeLessThan(zero);
  });

  it('flat-6 is essentially balanced; flat-4 keeps a small secondary couple', () => {
    const six = balance(getEngine('flat6'));
    expect(
      Math.max(six.primary.force, six.primary.couple, six.secondary.force, six.secondary.couple),
    ).toBeLessThan(0.05);
    const four = balance(getEngine('flat4'));
    expect(four.primary.force + four.secondary.force).toBeLessThan(zero);
    expect(four.secondary.couple).toBeGreaterThan(0.1);
    expect(four.secondary.couple).toBeLessThan(balance(getEngine('i3')).secondary.couple);
  });
});

describe('kinematics', () => {
  it('piston travel spans exactly one stroke', () => {
    const e = getEngine('i4');
    let lo = Infinity;
    let hi = -Infinity;
    for (let d = 0; d < 720; d += 0.5) {
      const t = cylinderState(e, 0, d).travelMm;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    expect(lo).toBeCloseTo(0, 3);
    expect(hi).toBeCloseTo(e.strokeMm, 3);
  });

  it('connecting rod length is preserved', () => {
    const e = getEngine('v8-cross');
    for (let d = 0; d < 360; d += 17) {
      e.cylinders.forEach((_, i) => {
        const s = cylinderState(e, i, d);
        const len = Math.hypot(s.pistonYZ[0] - s.pinYZ[0], s.pistonYZ[1] - s.pinYZ[1]);
        expect(len).toBeCloseTo(e.rodMm, 6);
      });
    }
  });

  it('four strokes in order after firing', () => {
    const e = getEngine('i4');
    const f = e.cylinders[0].fireDeg;
    expect([0, 180, 360, 540].map((d) => strokeOf(e, 0, f + d + 1).stroke)).toEqual([
      'power',
      'exhaust',
      'intake',
      'compression',
    ]);
  });
});

describe('envelope', () => {
  it('longer engines are longer: I4 < I5 < I6, and a VR6 is barely longer than an I4', () => {
    const L = (id: string) => envelope(getEngine(id)).lengthMm;
    expect(L('i4')).toBeLessThan(L('i5'));
    expect(L('i5')).toBeLessThan(L('i6'));
    expect(L('vr6')).toBeLessThan(L('i5'));
    expect(L('i6') - L('vr6')).toBeGreaterThan(100);
  });

  it('boxers are wide and low', () => {
    const f = envelope(getEngine('flat6'));
    const i = envelope(getEngine('i6'));
    expect(f.widthMm).toBeGreaterThan(i.widthMm * 2);
    expect(f.heightMm).toBeLessThan(i.heightMm * 0.6);
  });
});

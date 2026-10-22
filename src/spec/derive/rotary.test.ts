import { describe, expect, it } from 'vitest';
import { getEngine, listEngines } from '../catalog';
import { angleDiff, DEG, mod } from '../units';
import { balance } from './balance';
import { envelope } from './envelope';
import { firesPerRev, firingEvents, firingIntervals } from './firing';
import {
  chamberAreaMm2,
  chamberVolumeCc,
  displacementPerFaceCc,
  faceCycleDeg,
  portWindows,
  rotaryDef,
  rotaryPhase,
  rotorFlank,
  rotorOutline,
  rotorPose,
  trochoid,
  type YZ,
} from './rotary';

const e = getEngine('rotary-13b-msp');
const r = rotaryDef(e);

/** Point-in-polygon (ray casting) against a dense housing outline. */
const housing: YZ[] = Array.from({ length: 2000 }, (_, k) => trochoid(r, (2 * Math.PI * k) / 2000));
function inside([y, z]: YZ): boolean {
  let c = false;
  for (let i = 0, j = housing.length - 1; i < housing.length; j = i++) {
    const [yi, zi] = housing[i];
    const [yj, zj] = housing[j];
    if (zi > z !== zj > z && y < ((yj - yi) * (z - zi)) / (zj - zi) + yi) c = !c;
  }
  return c;
}

describe('rotary spec', () => {
  it('every rotary in the catalog carries its geometry, and only rotaries do', () => {
    for (const x of listEngines()) expect(!!x.rotary, x.id).toBe(x.family === 'rotary');
  });

  it('13B-MSP: 2 × 654 cc from 3√3·R·e·B, no valves', () => {
    expect(displacementPerFaceCc(r)).toBeCloseTo(654.7, 1);
    expect(e.displacementCc).toBe(1308);
    expect(e.valvetrain).toEqual({ type: 'ports', valvesPerCyl: 0 });
    expect(e.cylinders).toHaveLength(2);
  });
});

describe('rotary firing', () => {
  it('each rotor fires once per e-shaft turn, the two 180° apart: 2 events per rev, like an I4', () => {
    expect(firesPerRev(e)).toBe(2);
    expect(firesPerRev(getEngine('i4'))).toBe(2);
    const ev = firingEvents(e);
    expect(ev.map((x) => [x.cyl, x.deg])).toEqual([
      [0, 0],
      [1, 180],
      [0, 360],
      [1, 540],
    ]);
    for (const g of firingIntervals(e)) expect(g).toBeCloseTo(180, 9);
    for (const g of firingIntervals(e, [0])) expect(g).toBeCloseTo(360, 9);
  });

  it('eccentric lobes sit 180° apart', () => {
    expect(Math.abs(angleDiff(e.cylinders[0].throwDeg, e.cylinders[1].throwDeg))).toBeCloseTo(
      180,
      9,
    );
  });

  it('at each firing one face is at combustion TDC and its chamber is smallest', () => {
    for (const ev of firingEvents(e)) {
      const cycles = [0, 1, 2].map((f) => faceCycleDeg(e, ev.cyl, f, ev.deg));
      expect(cycles.filter((c) => Math.abs(angleDiff(c, 0, 1080)) < 1e-9)).toHaveLength(1);
      // the three faces are a third of a cycle apart
      expect(cycles.map((c) => Math.round(mod(c - cycles[0], 1080))).sort((a, b) => a - b)).toEqual(
        [0, 360, 720],
      );
    }
    let min = Infinity;
    let at = -1;
    for (let c = 0; c < 1080; c += 1) {
      const v = chamberVolumeCc(r, c);
      if (v < min - 1e-9) [min, at] = [v, c];
    }
    expect([0, 540]).toContain(at);
    expect(min).toBeCloseTo(displacementPerFaceCc(r) / (r.compressionRatio - 1), 6);
    expect(chamberVolumeCc(r, 270) - min).toBeCloseTo(displacementPerFaceCc(r), 6);
  });
});

describe('rotor kinematics', () => {
  it('the rotor centre orbits at e with the shaft; the rotor turns at a third of its speed', () => {
    const a = rotorPose(e, 0, 0);
    const b = rotorPose(e, 0, 90);
    expect(Math.hypot(...a.centre)).toBeCloseTo(r.eccentricityMm, 9);
    const turn = (p: typeof a) => Math.atan2(p.centre[1], p.centre[0]) / DEG;
    expect(angleDiff(turn(b), turn(a))).toBeCloseTo(-90, 9);
    expect(b.angleDeg - a.angleDeg).toBeCloseTo(-30, 9);
  });

  it('all three apexes ride exactly on the epitrochoid, all the time', () => {
    for (let d = 0; d < 720; d += 7.3) {
      for (const i of [0, 1]) {
        const p = rotorPose(e, i, d);
        for (let k = 0; k < 3; k++) {
          const a = (p.angleDeg + 120 * k) * DEG;
          const apex: YZ = [
            p.centre[0] + r.generatingRadiusMm * Math.cos(a),
            p.centre[1] + r.generatingRadiusMm * Math.sin(a),
          ];
          const h = trochoid(r, a);
          expect(Math.hypot(apex[0] - h[0], apex[1] - h[1])).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('the rotor (its inner envelope, recessed) never leaves the housing', () => {
    const outline = rotorOutline(r, 24);
    for (let d = 0; d < 360; d += 3) {
      const p = rotorPose(e, 0, d);
      const c = Math.cos(p.angleDeg * DEG);
      const s = Math.sin(p.angleDeg * DEG);
      outline.forEach(([y, z], k) => {
        // apex tips sit on the housing itself
        if (k % 24 === 0) return;
        const w: YZ = [p.centre[0] + y * c - z * s, p.centre[1] + y * s + z * c];
        expect(inside(w), `crank ${d} point ${k}`).toBe(true);
      });
    }
  });

  it('the drawn chamber has the spec volume: sinusoidal swing, compression ratio at TDC', () => {
    const flank = rotorFlank(r);
    for (const c of [0, 90, 200, 270, 400, 540]) {
      const cc = (chamberAreaMm2(r, flank, c) * r.rotorWidthMm) / 1000;
      expect(Math.abs(cc / chamberVolumeCc(r, c) - 1), `cycle ${c}`).toBeLessThan(0.01);
    }
  });
});

describe('rotary ports and phases', () => {
  it('side exhaust ports shut before the intake opens: no overlap', () => {
    const w = portWindows(r);
    expect(w.overlapDeg).toBe(0);
    expect(w.exhaust).toEqual([220, 537]);
    expect(w.intake).toEqual([543, 890]);
  });

  it('a face goes power → exhaust → intake → compression over 1080° of shaft', () => {
    const seq: string[] = [];
    for (let c = 0; c < 1080; c += 5) {
      const s = rotaryPhase(r, c).stroke;
      if (seq[seq.length - 1] !== s) seq.push(s);
    }
    expect(seq).toEqual(['power', 'exhaust', 'intake', 'compression']);
  });
});

describe('rotary balance and size', () => {
  it('no reciprocating mass: no 2nd order; the eccentric rotors leave only a rotating couple', () => {
    const b = balance(e);
    expect(b.primary.force).toBe(0);
    expect(b.primary.couple).toBeCloseTo(1, 6);
    expect(b.primary.coupleRotating).toBe(true);
    expect(b.secondary.force + b.secondary.couple).toBe(0);
  });

  it('compact: a 338 mm core, shorter than an inline-4', () => {
    const env = envelope(e);
    expect(env.max[1] * 2).toBeCloseTo(338, -1);
    expect(env.lengthMm).toBeLessThan(0.85 * envelope(getEngine('i4')).lengthMm);
    expect(env.widthMm).toBeLessThan(env.heightMm);
  });
});

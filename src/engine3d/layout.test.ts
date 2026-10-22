import { describe, expect, it } from 'vitest';
import { getEngine, listEngines } from '../spec/catalog';
import { cylinderState } from '../spec/derive/kinematics';
import { angleDiff } from '../spec/units';
import { CAM_HALF_DEG, engineLayout, liftFraction, TURBOS } from './layout';
import { motionTables, sampleSlider } from './motion';
import { chainLoop, exhaustRoutes } from './paths';

// piston engines: rotaries have no crank, bores or valves (rotary.test.ts covers them)
const ids = listEngines()
  .filter((e) => e.family !== 'rotary')
  .map((e) => e.id);

describe('crank throws → pins, clusters and main bearings', () => {
  const shape = (id: string) => {
    const c = engineLayout(getEngine(id)).crank;
    return { pins: c.pins.length, clusters: c.clusters.length, mains: c.journals.length };
  };

  it.each([
    ['i3', 3, 3, 4],
    ['i4', 4, 4, 5],
    ['i6', 6, 6, 7],
    ['v8-cross', 4, 4, 5],
    ['v12', 6, 6, 7],
    ['v6-60', 6, 3, 4],
    ['v10', 10, 5, 6],
    ['flat6', 6, 6, 7],
    ['vr6', 6, 6, 7],
    ['w12', 12, 6, 7],
    ['w16', 16, 8, 9],
  ])('%s: %i pins in %i throws, %i mains', (id, pins, clusters, mains) => {
    expect(shape(id)).toEqual({ pins, clusters, mains });
  });

  it('shared pins carry both rods at one throw; split pins sit side by side at their own angles', () => {
    const cross = engineLayout(getEngine('v8-cross')).crank;
    for (const p of cross.pins) expect(p.cylinders).toHaveLength(2);
    const v10 = engineLayout(getEngine('v10')).crank;
    for (const cl of v10.clusters) {
      expect(cl).toHaveLength(2);
      expect(Math.abs(angleDiff(cl[0].throwDeg, cl[1].throwDeg))).toBeCloseTo(18, 6);
    }
  });

  it('every pin sits at its cylinders’ derived throwDeg, and webs never overlap pins', () => {
    for (const id of ids) {
      const e = getEngine(id);
      const c = engineLayout(e).crank;
      for (const p of c.pins) {
        for (const i of p.cylinders)
          expect(Math.abs(angleDiff(p.throwDeg, e.cylinders[i].throwDeg))).toBeLessThan(1e-9);
      }
      const spans = [
        ...c.pins.map((p) => [p.axialMm - p.lengthMm / 2, p.axialMm + p.lengthMm / 2]),
        ...c.journals.map((j) => [j.axialMm - j.lengthMm / 2, j.axialMm + j.lengthMm / 2]),
      ];
      for (const w of c.webs.filter((x) => x.counterweight)) {
        for (const [lo, hi] of spans) {
          const overlap =
            Math.min(hi, w.axialMm + w.thicknessMm / 2) -
            Math.max(lo, w.axialMm - w.thicknessMm / 2);
          expect(overlap, `${id} web at ${w.axialMm.toFixed(1)}`).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe('pistons stay in their bores across 720°', () => {
  it.each(ids)('%s', (id) => {
    const e = getEngine(id);
    const l = engineLayout(e);
    const t = motionTables(e);
    const out = new Float32Array(4);
    for (let i = 0; i < e.cylinders.length; i++) {
      const [uy, uz] = l.cylinders[i].axis;
      for (let deg = 0; deg < 720; deg += 1.5) {
        sampleSlider(t, i, deg, out);
        // on the bore axis…
        expect(Math.abs(out[2] * uz - out[3] * uy)).toBeLessThan(1e-3);
        const along = out[2] * uy + out[3] * uz;
        // …crown below the deck, skirt inside the liner and clear of the counterweights
        expect(along + l.piston.compressionMm).toBeLessThanOrEqual(l.dims.deckMm - 4);
        expect(along - l.piston.skirtMm).toBeGreaterThan(l.linerBottomMm);
        expect(along - l.piston.skirtMm).toBeGreaterThan(l.crank.counterweightRadiusMm + 4);
      }
    }
  });

  it('tables match the exact slider-crank', () => {
    const e = getEngine('v10');
    const t = motionTables(e);
    const out = [0, 0, 0, 0];
    for (const deg of [0, 13.37, 91.2, 359.9, 400.1, 719.3]) {
      e.cylinders.forEach((_, i) => {
        const s = cylinderState(e, i, deg);
        sampleSlider(t, i, deg, out);
        expect(out[0]).toBeCloseTo(s.pinYZ[0], 2);
        expect(out[1]).toBeCloseTo(s.pinYZ[1], 2);
        expect(out[2]).toBeCloseTo(s.pistonYZ[0], 2);
        expect(out[3]).toBeCloseTo(s.pistonYZ[1], 2);
      });
    }
  });
});

describe('heads', () => {
  const heads = (id: string) => engineLayout(getEngine(id)).heads;

  it('VR shares one head across both staggered rows; W is two VR heads', () => {
    const vr = heads('vr6');
    expect(vr).toHaveLength(1);
    expect(vr[0].cylinders).toHaveLength(6);
    expect(vr[0].banks).toEqual([0, 1]);
    const l = engineLayout(getEngine('vr6'));
    const stagger = new Set(l.cylinders.map((c) => Math.sign(Math.round(c.deckAcrossMm))));
    expect([...stagger].sort()).toEqual([-1, 1]);

    for (const [id, n, tilt] of [
      ['w12', 6, 36],
      ['w16', 8, 45],
    ] as const) {
      const h = heads(id);
      expect(h).toHaveLength(2);
      expect(h.map((x) => x.cylinders.length)).toEqual([n, n]);
      expect(h.map((x) => x.tiltDeg)).toEqual([-tilt, tilt]);
      expect(h.every((x) => x.banks.length === 2)).toBe(true);
    }
  });

  it('inline 1 head, V and flat 2 heads tilted along their banks', () => {
    expect(heads('i6')).toHaveLength(1);
    expect(heads('v8-cross').map((h) => h.tiltDeg)).toEqual([-45, 45]);
    expect(heads('flat4').map((h) => h.tiltDeg)).toEqual([-90, 90]);
  });

  it('intake sits in the vee, except the hot-vee V6 which puts its turbos there', () => {
    const v8 = engineLayout(getEngine('v8-cross'));
    expect(v8.plenums).toHaveLength(1);
    expect(v8.plenums[0].at[1]).toBeCloseTo(0, 6);
    const hot = engineLayout(getEngine('v6-120'));
    expect(hot.hotVee).toBe(true);
    expect(hot.plenums).toHaveLength(2);
    for (const t of hot.turbos)
      expect(Math.abs(t.at[2])).toBeLessThan(Math.abs(hot.exhaustPorts[0].at[2]));
  });
});

describe('part counts', () => {
  it.each(ids)('%s', (id) => {
    const e = getEngine(id);
    const l = engineLayout(e);
    const n = e.cylinders.length;
    expect(l.valves).toHaveLength(n * e.valvetrain.valvesPerCyl);
    const camsPerHead = { dohc: 2, sohc: 1, ohv: 0, ports: 0 }[e.valvetrain.type];
    expect(l.cams).toHaveLength(e.valvetrain.type === 'ohv' ? 1 : camsPerHead * l.heads.length);
    expect(l.pushrods).toHaveLength(e.valvetrain.type === 'ohv' ? l.valves.length : 0);
    expect(l.runners).toHaveLength(n);
    expect(l.exhaust.flatMap((g) => g.cylinders).sort((a, b) => a - b)).toEqual(
      e.cylinders.map((_, i) => i),
    );
    const turbos = TURBOS[e.induction] ? (e.sound.turbo?.count ?? TURBOS[e.induction]) : 0;
    expect(l.turbos).toHaveLength(turbos);
    expect(l.timing.loops).toHaveLength(e.valvetrain.type === 'ohv' ? 1 : l.heads.length);
    // every lobe drives exactly one valve
    expect(l.cams.reduce((a, c) => a + c.lobes.length, 0)).toBe(l.valves.length);
  });
});

describe('valvetrain', () => {
  it('cams turn at half crank speed: sprockets are twice the crank’s', () => {
    for (const id of ids) {
      const l = engineLayout(getEngine(id));
      for (const loop of l.timing.loops) {
        const [crank, ...cams] = loop.sprockets;
        for (const c of cams) expect(c.r).toBeCloseTo(2 * crank.r, 9);
        expect(chainLoop(loop).lengthMm).toBeGreaterThan(0);
      }
    }
  });

  it('valves open on the right strokes, intake after exhaust, with overlap at TDC', () => {
    const e = getEngine('i4');
    const l = engineLayout(e);
    const fire = e.cylinders[0].fireDeg;
    const v = l.valves.filter((x) => x.cyl === 0);
    const ex = v.find((x) => x.kind === 'exhaust')!;
    const inn = v.find((x) => x.kind === 'intake')!;
    expect(liftFraction(ex.peakDeg, fire + 270)).toBeGreaterThan(0.9); // mid exhaust stroke
    expect(liftFraction(inn.peakDeg, fire + 450)).toBeGreaterThan(0.9); // mid intake stroke
    expect(liftFraction(inn.peakDeg, fire + 90)).toBe(0); // shut on the power stroke
    expect(liftFraction(ex.peakDeg, fire + 90)).toBe(0);
    expect(
      liftFraction(ex.peakDeg, fire + 360) * liftFraction(inn.peakDeg, fire + 360),
    ).toBeGreaterThan(0);
    expect(liftFraction(ex.peakDeg, ex.peakDeg + 2 * CAM_HALF_DEG)).toBe(0);
  });
});

describe('exhaust headers', () => {
  it('primaries are built to the spec length (equal vs unequal)', () => {
    for (const id of ids) {
      const l = engineLayout(getEngine(id));
      for (const r of exhaustRoutes(l)) {
        expect(r.lengthMm / r.targetMm, `${id} cyl ${r.cyl}`).toBeGreaterThan(0.97);
        expect(r.lengthMm / r.targetMm, `${id} cyl ${r.cyl}`).toBeLessThan(1.4);
      }
    }
    const boxer = exhaustRoutes(engineLayout(getEngine('flat4'))).map((r) =>
      Math.round(r.lengthMm),
    );
    expect(new Set(boxer).size).toBe(4);
  });
});

describe('timing drive', () => {
  it('cam sprockets on one head clear each other', () => {
    for (const id of ids) {
      const l = engineLayout(getEngine(id));
      for (const loop of l.timing.loops) {
        const cams = loop.sprockets.slice(1);
        for (let a = 0; a < cams.length; a++) {
          for (let b = a + 1; b < cams.length; b++) {
            const d = Math.hypot(cams[a].at[0] - cams[b].at[0], cams[a].at[1] - cams[b].at[1]);
            expect(d, id).toBeGreaterThan(cams[a].r + cams[b].r);
          }
        }
      }
    }
  });
});

describe('hot vee', () => {
  it('turbo vees labelled "in the vee" put their turbos between the banks', () => {
    // (a supercharger in the vee, like the Audi 3.0 TFSI's, is not a hot vee)
    for (const e of listEngines().filter(
      (x) => /in the vee/i.test(x.layoutLabel) && /turbo/.test(x.induction),
    )) {
      const l = engineLayout(e);
      expect(l.hotVee, e.id).toBe(true);
      for (const t of l.turbos) expect(t.at[1], e.id).toBeGreaterThan(l.dims.deckMm * 0.6);
    }
    expect(engineLayout(getEngine('v8-cross')).hotVee).toBe(false);
  });
});

describe('cam in block (OHV)', () => {
  it('clears the bores and the spinning crank', () => {
    for (const e of listEngines().filter((x) => x.valvetrain.type === 'ohv')) {
      const l = engineLayout(e);
      const cam = l.cams[0];
      const nose = cam.baseRadiusMm + cam.liftMm;
      expect(Math.hypot(...cam.at), e.id).toBeGreaterThan(l.crank.counterweightRadiusMm + nose);
      for (const c of l.cylinders) {
        const along = cam.at[0] * c.axis[0] + cam.at[1] * c.axis[1];
        const lateral = Math.abs(cam.at[0] * c.axis[1] - cam.at[1] * c.axis[0]);
        if (along > l.linerBottomMm - nose)
          expect(lateral, e.id).toBeGreaterThan(e.boreMm / 2 + nose);
      }
    }
  });
});

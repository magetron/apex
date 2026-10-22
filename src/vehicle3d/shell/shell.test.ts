import { describe, expect, it } from 'vitest';
import { listVehicles } from '../../spec/catalog';
import { measuredProfile } from '../gltf/profile';
import type { VehicleSpec } from '../../spec/types';
import { bodyContext, defaultParams } from './defaults';
import { buildShell } from './build';
import { makeShape } from './shape';

const extent = (v: VehicleSpec) => {
  const sh = buildShell(v);
  const pos = sh.body.getAttribute('position');
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let nan = 0;
  for (let i = 0; i < pos.count; i++) {
    for (let k = 0; k < 3; k++) {
      const val = pos.getComponent(i, k) * 1000;
      if (!Number.isFinite(val)) nan++;
      min[k] = Math.min(min[k], val);
      max[k] = Math.max(max[k], val);
    }
  }
  const nrm = sh.body.getAttribute('normal');
  for (let i = 0; i < nrm.count * 3; i++) if (!Number.isFinite(nrm.array[i])) nan++;
  return { sh, min, max, nan };
};

describe('procedural shell', () => {
  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s respects the spec dimensions',
    (_id, v) => {
      const { min, max, nan, sh } = extent(v);
      const d = v.dims;
      expect(nan).toBe(0);
      if (measuredProfile(v.id)) {
        // the outline measured on the car's model: it should agree with the published numbers
        // within a few percent (a model has its own proportions, a spoiler, a kit)
        expect(Math.abs(max[0] - min[0] - d.lengthMm) / d.lengthMm).toBeLessThan(0.07);
        expect(Math.abs(max[1] - d.heightMm) / d.heightMm).toBeLessThan(0.1);
        expect(Math.abs(max[2] - min[2] - d.widthMm) / d.widthMm).toBeLessThan(0.1);
      } else {
        expect(max[0]).toBeCloseTo(d.overhangFMm, 0);
        expect(min[0]).toBeCloseTo(d.overhangFMm - d.lengthMm, 0);
        expect(Math.abs(max[2] - d.widthMm / 2)).toBeLessThan(3);
        expect(Math.abs(min[2] + d.widthMm / 2)).toBeLessThan(3);
        expect(Math.abs(max[1] - d.heightMm)).toBeLessThan(3);
      }
      // (a model's own floor may run lower: a race car's splitter)
      expect(min[1]).toBeGreaterThan(measuredProfile(v.id) ? 30 : 60);
      // every procedural body gets glass and lamps (a detailed model brings its own)
      if (!measuredProfile(v.id)) {
        expect(sh.decals.has('glass')).toBe(true);
        expect(sh.decals.has('lamp')).toBe(true);
      }
    },
  );

  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: decals, lips and lines are finite',
    (_id, v) => {
      const sh = buildShell(v);
      const geos = [...sh.decals.values(), sh.lines, sh.wells, ...(sh.lips ? [sh.lips] : [])];
      for (const g of geos) {
        for (const name of ['position', 'normal']) {
          const a = g.getAttribute(name);
          if (!a) continue;
          for (let i = 0; i < a.array.length; i++) expect(Number.isFinite(a.array[i])).toBe(true);
        }
      }
    },
  );

  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: tyres sit inside their arches',
    (_id, v) => {
      const c = bodyContext(v);
      const s = makeShape(c, defaultParams(c));
      for (const w of c.wheels) {
        // the arch clears the tyre top
        expect(s.archY(w.x)).toBeGreaterThan(w.y + w.tyreR + 10);
      }
    },
  );

  it('builds fast enough to switch cars interactively', () => {
    const v = listVehicles()[0];
    const t0 = performance.now();
    buildShell(v);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});

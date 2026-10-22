/**
 * Nothing of the engine may hang below the car: every catalog car's engine, as drawn (block,
 * sump, intake, exhaust, turbos), placed at its crank height and install tilt, stays above the
 * road with some ground clearance to spare.
 */
import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { buildEngineGeometry } from '../engine3d/geometry';
import { buildRotaryGeometry, rotaryDrawnBoxesMm } from '../engine3d/rotaryGeometry';
import { getEngine, listVehicles } from '../spec/catalog';

/** mm above the road the lowest drawn engine part must keep */
const MIN_CLEARANCE_MM = 60;

const lowestCache = new Map<string, Box3[]>();
function engineBoxes(id: string): Box3[] {
  let boxes = lowestCache.get(id);
  const spec = getEngine(id);
  if (!boxes && spec.family === 'rotary') {
    // mm boxes → metres, like the piston geometry below
    boxes = rotaryDrawnBoxesMm(buildRotaryGeometry(spec, 'low')).map((b) =>
      b.clone().applyMatrix4(new Matrix4().makeScale(1e-3, 1e-3, 1e-3)),
    );
    lowestCache.set(id, boxes);
  }
  if (!boxes) {
    const g = buildEngineGeometry(spec, 'low');
    const geos: (BufferGeometry | null)[] = [
      g.block,
      g.sump,
      ...g.heads.flatMap((h) => [h.casting, h.cover]),
      g.flywheel,
      g.timingCover,
      ...g.intake,
      ...g.exhaust,
      ...g.turbos.flatMap((t) => [t.hot, t.cold]),
    ];
    boxes = geos
      .filter((x): x is BufferGeometry => !!x)
      .map((x) => {
        x.computeBoundingBox();
        return x.boundingBox!.clone();
      });
    lowestCache.set(id, boxes);
  }
  return boxes;
}

/** lowest point (mm above the road) of the engine as installed */
function lowestMm(v: ReturnType<typeof listVehicles>[number]): number {
  const pt = v.powertrain;
  if (pt.kind !== 'ice') return Infinity;
  const tilt = ((pt.engineTiltDeg ?? 0) * Math.PI) / 180;
  let low = Infinity;
  const p = new Vector3();
  for (const b of engineBoxes(pt.engine))
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          // install tilt rolls the engine about its crank axis (engine-frame X)
          p.set(x, y, z);
          const yy = p.y * Math.cos(tilt) - p.z * Math.sin(tilt);
          low = Math.min(low, yy * 1000);
        }
  return pt.crankYMm + low;
}

describe('ground clearance', () => {
  it.each(
    listVehicles()
      .filter((v) => v.powertrain.kind === 'ice')
      .map((v) => [v.id, v] as const),
  )('%s: no engine part below the car', (_id, v) => {
    expect(lowestMm(v)).toBeGreaterThanOrEqual(MIN_CLEARANCE_MM);
  });
});

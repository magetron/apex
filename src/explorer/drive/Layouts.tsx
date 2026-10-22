/**
 * Every layout, the same test: a car of each layout (the visitor's own for its layout; for the
 * rest, the one nearest it in power and weight: state.ts representative) driven through the
 * question at the same speed, headlessly, each its path alone, in a row ordered by where the
 * engine sits, front to rear, under the timeline at the end of the run. The shape of each path is
 * its answer; its car, drawn where it ended as its layout sketch, shows where its engine sits and
 * the end of it that let go, red. Each is named by its model, nothing more; one axis cue says what
 * the row is ordered by. Worked out a layout per tick once the run ends (and kept), so the run
 * itself stays smooth.
 */
import { useEffect, useState } from 'react';
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { layoutCode } from '../../spec/describe';
import type { VehicleSpec } from '../../spec/types';
import type { DriveColors } from './colors';
import { findKey } from './key';
import { Lane } from './lanes';
import { sketchOf } from './LayoutSketch';
import { laneResult, paramsOf, shortName } from './lineup';
import { PathDrawing } from './PathPicture';
import { buildPicture, type PathPicture } from './picture';
import { FAMILIES, familyOf, FAMILY_WORDS, representative, type Family } from './state';
import { modelName } from './takeaway';

export interface LayoutPath {
  family: Family;
  vehicle: VehicleSpec;
  /** the visitor's own car, standing for its layout */
  own: boolean;
  pic: PathPicture;
}

const cache = new Map<string, LayoutPath | null>();

/** One layout's car through the question, as a picture of its path alone (null: no picture). */
export function layoutPath(
  vehicle: VehicleSpec,
  id: ScenarioId,
  kmh: number,
  f: Family,
): LayoutPath | null {
  const k = `${vehicle.id}|${id}|${kmh}|${f}`;
  if (cache.has(k)) return cache.get(k)!;
  const own = familyOf(vehicle) === f;
  const v = own ? vehicle : representative(f, vehicle);
  let out: LayoutPath | null = null;
  if (v) {
    const lane = new Lane(paramsOf(v), SCENARIOS[id].plan(kmh), false, {
      kind: 'main',
      code: layoutCode(v),
      name: shortName(v),
      label: modelName(v.name),
      vehicle: v,
    });
    lane.simTo(lane.plan.duration + 1);
    const o = laneResult(lane).outcome!;
    // (the picture is of two cars: this one twice, drawn once)
    const pair = [lane, lane];
    const pic = buildPicture(id, pair, findKey(SCENARIOS[id], pair), [o, o], false);
    if (pic) out = { family: f, vehicle: v, own, pic };
  }
  cache.set(k, out);
  return out;
}

/** each small path's size (px), at most and at least */
const CELL_W = 150;
const CELL_MIN = 84;
const CELL_H = 112;

/** The small pictures' axis, in words: the cue under the row (counted in the text budget). */
export const AXIS = ['engine:', 'front', 'rear'] as const;

/**
 * Where a car's mass-making lump sits along it: its engine's middle (an electric car's battery),
 * as a share of the wheelbase back from the front axle (0 the front axle, 1 the rear; below 0
 * ahead of it, above 1 behind). The row is ordered by it.
 */
export function enginePlace(v: VehicleSpec): number {
  const s = sketchOf(v);
  const block =
    s.blocks.find((b) => b.kind === 'engine') ??
    s.blocks.find((b) => b.kind === 'battery') ??
    s.blocks[0];
  if (!block) return 0.5;
  return -(block.x0 + block.x1) / 2 / s.wheelbase;
}

export function EveryLayout({
  vehicle,
  id,
  kmh,
  width,
  colors,
}: {
  vehicle: VehicleSpec;
  id: ScenarioId;
  kmh: number;
  /** the row's width (px) */
  width: number;
  colors: DriveColors;
}) {
  const [paths, setPaths] = useState<{ key: string; list: LayoutPath[] }>({ key: '', list: [] });
  const key = `${vehicle.id}|${id}|${kmh}`;
  useEffect(() => {
    let i = 0;
    let timer = 0;
    const acc: LayoutPath[] = [];
    // one layout per tick, after a moment, so the picture opens smoothly
    const next = () => {
      const f = FAMILIES[i++];
      if (!f) return;
      const p = layoutPath(vehicle, id, kmh, f);
      if (p) {
        acc.push(p);
        // front-engined first, rear-engined last: the row reads along the car
        acc.sort((a, b) => enginePlace(a.vehicle) - enginePlace(b.vehicle));
        setPaths({ key, list: [...acc] });
      }
      timer = window.setTimeout(next, 0);
    };
    timer = window.setTimeout(next, 250);
    return () => window.clearTimeout(timer);
  }, [vehicle, id, kmh, key]);
  const list = paths.key === key ? paths.list : [];
  const cellW = Math.max(CELL_MIN, Math.min(CELL_W, Math.floor(width / FAMILIES.length) - 6));
  return (
    <figure className="apx-drive-every" aria-label="Every layout, the same test">
      <ul>
        {list.map((p) => (
          <li
            key={p.family}
            className={p.own ? 'is-own' : undefined}
            title={`${FAMILY_WORDS[p.family]}: ${p.vehicle.name}`}
          >
            <PathDrawing
              pic={p.pic}
              w={cellW}
              h={CELL_H}
              mini
              sketch={sketchOf(p.vehicle)}
              color={p.own ? colors.you : colors.mark}
            />
            <span className="apx-drive-every__name">{modelName(p.vehicle.name)}</span>
          </li>
        ))}
      </ul>
      {/* the row's axis: where the engine sits, front to rear */}
      <figcaption className="apx-drive-every__axis" style={{ width: cellW * FAMILIES.length }}>
        <span>{AXIS[0]}</span>
        <span>{AXIS[1]}</span>
        <i aria-hidden />
        <span>{AXIS[2]}</span>
      </figcaption>
    </figure>
  );
}

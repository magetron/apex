/**
 * A car from above, from its spec: the body outline, the engine or motors (and an EV's battery)
 * where layoutPowertrain puts them, the driven wheels lit, and the centre of mass (massProps).
 * Next to a car's name it says at a glance where its weight sits: a rear-engined car's dot sits
 * behind the middle. `SketchBody` draws into a caller's SVG (the freeze frame turns it with the
 * car); `LayoutSketch` is the small standalone one, nose to the right.
 */
import type { CSSProperties } from 'react';
import { SYSTEM_COLORS } from '../../scene/palette';
import { layoutPowertrain, partBounds } from '../../spec/derive/layout';
import { massProps } from '../../spec/derive/mass';
import type { VehicleSpec } from '../../spec/types';

export interface Sketch {
  /** metres, vehicle frame: x forward from the front axle, z to the right */
  nose: number;
  tail: number;
  halfWidth: number;
  wheelbase: number;
  blocks: {
    kind: 'engine' | 'motor' | 'battery';
    x0: number;
    x1: number;
    z0: number;
    z1: number;
  }[];
  wheels: {
    x: number;
    z: number;
    len: number;
    w: number;
    axle: 'front' | 'rear';
    driven: boolean;
  }[];
  cg: { x: number; z: number };
  /** share of the weight on the front axle (0..100) */
  frontPct: number;
}

const cache = new WeakMap<VehicleSpec, Sketch>();

export function sketchOf(v: VehicleSpec): Sketch {
  let s = cache.get(v);
  if (s) return s;
  const layout = layoutPowertrain(v);
  const mp = massProps(v, layout);
  const M = 0.001;
  const blocks: Sketch['blocks'] = [];
  const wheels: Sketch['wheels'] = [];
  for (const p of layout.parts) {
    if (p.kind === 'wheel') {
      wheels.push({
        x: p.posMm[0] * M,
        z: p.posMm[2] * M,
        len: p.sizeMm[0] * 0.8 * M,
        w: p.sizeMm[2] * M,
        axle: p.axle ?? 'front',
        driven: !!p.driven,
      });
    } else if (p.kind === 'engine' || p.kind === 'motor' || p.kind === 'battery') {
      const [lo, hi] = partBounds(p);
      blocks.push({ kind: p.kind, x0: lo[0] * M, x1: hi[0] * M, z0: lo[2] * M, z1: hi[2] * M });
    }
  }
  // the battery under the floor first, so the motors draw over it
  blocks.sort((a, b) => (a.kind === 'battery' ? -1 : 0) - (b.kind === 'battery' ? -1 : 0));
  s = {
    nose: v.dims.overhangFMm * M,
    tail: (v.dims.overhangFMm - v.dims.lengthMm) * M,
    halfWidth: (v.dims.widthMm / 2) * M,
    wheelbase: v.dims.wheelbaseMm * M,
    blocks,
    wheels,
    cg: { x: mp.cgMm[0] * M, z: mp.cgMm[2] * M },
    frontPct: mp.frontPct,
  };
  cache.set(v, s);
  return s;
}

const BLOCK_COLOR = {
  engine: SYSTEM_COLORS.engine,
  motor: SYSTEM_COLORS.motor,
  battery: SYSTEM_COLORS.battery,
} as const;

/**
 * The sketch as SVG elements, nose up, the wheelbase midpoint at the origin, `k` px per metre.
 * `out`: the end of the car that let go (its wheels drawn red); `steerDeg` turns the fronts.
 */
export function SketchBody({
  s,
  k,
  color,
  out,
  slide,
  steerDeg = 0,
}: {
  s: Sketch;
  k: number;
  color: string;
  out?: 'front' | 'rear' | null;
  /** the let-go red */
  slide?: string;
  steerDeg?: number;
}) {
  // vehicle frame → drawing: x forward is up the page, z right is right
  const mid = -s.wheelbase / 2;
  const X = (z: number) => z * k;
  const Y = (x: number) => -(x - mid) * k;
  const w = s.halfWidth;
  return (
    <g>
      <rect
        x={X(-w)}
        y={Y(s.nose)}
        width={2 * w * k}
        height={(s.nose - s.tail) * k}
        rx={0.4 * k}
        fill={color}
        fillOpacity={0.14}
        stroke={color}
        strokeWidth={1.4}
      />
      {s.blocks.map((b, i) => (
        <rect
          key={i}
          x={X(b.z0)}
          y={Y(b.x1)}
          width={(b.z1 - b.z0) * k}
          height={(b.x1 - b.x0) * k}
          rx={1}
          fill={BLOCK_COLOR[b.kind]}
          fillOpacity={b.kind === 'battery' ? 0.35 : 0.9}
        />
      ))}
      {s.wheels.map((wh, i) => {
        const red = out === wh.axle;
        return (
          <rect
            key={i}
            x={-(wh.w * k) / 2}
            y={-(wh.len * k) / 2}
            width={wh.w * k}
            height={wh.len * k}
            rx={1}
            fill={red && slide ? slide : wh.driven ? SYSTEM_COLORS['wheel-driven'] : '#8d99ae'}
            transform={`translate(${X(wh.z)} ${Y(wh.x)})${wh.axle === 'front' ? ` rotate(${-steerDeg})` : ''}`}
          />
        );
      })}
      <circle
        cx={X(s.cg.z)}
        cy={Y(s.cg.x)}
        r={Math.max(2.2, 0.16 * k)}
        className="apx-drive-sketch__cg"
      />
    </g>
  );
}

/** Small and standalone, nose to the right, with the weight split under it. */
export function LayoutSketch({
  vehicle,
  color,
  width = 58,
  split = true,
}: {
  vehicle: VehicleSpec;
  color: string;
  width?: number;
  /** the front / rear weight split under the drawing */
  split?: boolean;
}) {
  const s = sketchOf(vehicle);
  // a fixed scale for every car (the longest about fills the box), so sizes compare
  const k = width / 5.4;
  const h = 2.1 * k;
  // turned a quarter clockwise, the nose-up drawing spans (tail + L/2)·k … (nose + L/2)·k
  const tx = (width - (s.nose + s.tail + s.wheelbase) * k) / 2;
  const f = Math.round(s.frontPct);
  return (
    <span className="apx-drive-sketch" style={{ '--sys': color } as CSSProperties}>
      <svg
        viewBox={`0 0 ${width} ${h}`}
        width={width}
        height={h}
        role="img"
        aria-label={`Engine layout: ${f}% of the weight on the front wheels`}
      >
        {/* nose to the right: the nose-up drawing turned a quarter clockwise */}
        <g transform={`translate(${tx} ${h / 2}) rotate(90)`}>
          <SketchBody s={s} k={k} color={color} />
        </g>
      </svg>
      {split && (
        <span className="apx-drive-sketch__split" title="Weight on the front / rear wheels (%)">
          <small>weight</small>F {f} | R {100 - f}
        </span>
      )}
    </span>
  );
}

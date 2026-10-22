/**
 * Bare engine bounding box (block + heads + crankcase/sump) in the engine-local frame.
 * Intake plenum, turbos and belt-driven ancillaries are not included — the fit check
 * adds its own margins for those.
 */
import type { EngineEnvelope, EngineSpec } from '../types';
import { DEG } from '../units';
import { rotaryBounds } from './rotary';

export interface EngineDims {
  /** crank axis → deck face (mm) */
  deckMm: number;
  headHeightMm: number;
  headWidthMm: number;
  blockWidthMm: number;
  /** radius swept by crank throws and counterweights (mm) */
  crankcaseRadiusMm: number;
  sumpDepthMm: number;
  /** timing drive at the front (+X) and bell-housing flange at the rear (mm) */
  frontMm: number;
  rearMm: number;
}

/** Derived block/head proportions; shared with the 3D generator so geometry and envelope agree. */
export function engineDims(spec: EngineSpec): EngineDims {
  const g = spec.geometry;
  const r = spec.strokeMm / 2;
  const bore = spec.boreMm;
  const vt = spec.valvetrain.type;
  const ch = g.compressionHeightMm ?? 0.36 * bore;
  return {
    deckMm: r + spec.rodMm + ch + 5,
    headHeightMm:
      g.headHeightMm ??
      (vt === 'dohc' ? 0.55 * bore + 120 : vt === 'sohc' ? 0.5 * bore + 95 : 0.4 * bore + 70),
    headWidthMm: vt === 'ohv' ? 1.1 * bore + 80 : 1.3 * bore + 110,
    blockWidthMm: bore + 44,
    crankcaseRadiusMm: r + 60,
    sumpDepthMm: g.sumpDepthMm ?? (g.drySump ? 40 : 110),
    frontMm: vt === 'ohv' ? 30 : 45,
    rearMm: 25,
  };
}

export function envelope(spec: EngineSpec): EngineEnvelope {
  if (spec.family === 'rotary') {
    const { min, max } = rotaryBounds(spec);
    return {
      lengthMm: max[0] - min[0],
      heightMm: max[1] - min[1],
      widthMm: max[2] - min[2],
      min,
      max,
    };
  }
  const d = engineDims(spec);
  const pts: [number, number][] = [];
  for (const bank of spec.banks) {
    const t = bank.tiltDeg * DEG;
    const u: [number, number] = [Math.cos(t), Math.sin(t)];
    const p: [number, number] = [-Math.sin(t), Math.cos(t)];
    const at = (along: number, across: number): [number, number] => [
      along * u[0] + across * p[0],
      along * u[1] + across * p[1],
    ];
    pts.push(at(d.deckMm, d.blockWidthMm / 2), at(d.deckMm, -d.blockWidthMm / 2));
    pts.push(
      at(d.deckMm + d.headHeightMm, d.headWidthMm / 2),
      at(d.deckMm + d.headHeightMm, -d.headWidthMm / 2),
    );
  }
  const R = d.crankcaseRadiusMm;
  pts.push([-R - d.sumpDepthMm, R], [-R - d.sumpDepthMm, -R], [R, R], [R, -R]);

  const ys = pts.map((q) => q[0]);
  const zs = pts.map((q) => q[1]);
  const axials = spec.cylinders.map((c) => c.axialMm);
  const half = spec.boreMm / 2 + 12;
  const min: [number, number, number] = [
    Math.min(...axials) - half - d.rearMm,
    Math.min(...ys),
    Math.min(...zs),
  ];
  const max: [number, number, number] = [
    Math.max(...axials) + half + d.frontMm,
    Math.max(...ys),
    Math.max(...zs),
  ];
  return {
    lengthMm: max[0] - min[0],
    heightMm: max[1] - min[1],
    widthMm: max[2] - min[2],
    min,
    max,
  };
}

/**
 * THE engine/motor seam: the one place the vehicle model mounts WP2's models. Same frame as
 * the layout: engines on the crank-axis centre (engine-local axes), drive units with local +X
 * on the motor axis (layoutPowertrain yaws them −90°). Sub-part ids are prefixed by the part.
 */
import { EngineModel, MotorModel } from '../engine3d';
import type { EngineSpec, MotorSpec } from '../spec/types';

export interface EngineSlotProps {
  spec: EngineSpec;
  /** fixed explode (0 inside the car); undefined = follow the global slider (zoomed in) */
  explode?: number;
}

export function EngineSlot({ spec, explode }: EngineSlotProps) {
  // lod stays at the default 'high': changing it rebuilds the geometry
  return <EngineModel key={spec.id} spec={spec} idPrefix="engine" explode={explode} />;
}

export function MotorSlot({
  spec,
  id,
  explode,
}: {
  spec: MotorSpec;
  id: string;
  explode?: number;
}) {
  return <MotorModel key={spec.id} spec={spec} idPrefix={id} explode={explode} />;
}

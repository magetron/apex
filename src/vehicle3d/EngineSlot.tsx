/**
 * THE engine/motor seam: the one place the vehicle model mounts WP2's models. Same frame as
 * the layout: engines on the crank-axis centre (engine-local axes), drive units with local +X
 * on the motor axis (layoutPowertrain yaws them −90°). Sub-part ids are prefixed by the part
 * (and by the car's own prefix when it is a compared car).
 */
import { EngineModel, MotorModel } from '../engine3d';
import type { EngineSpec, MotorSpec } from '../spec/types';
import { usePartPrefix } from './partIds';

export interface EngineSlotProps {
  spec: EngineSpec;
  /** fixed explode (0 inside the car); undefined = follow the global slider (zoomed in) */
  explode?: number;
}

export function EngineSlot({ spec, explode }: EngineSlotProps) {
  const prefix = usePartPrefix();
  // lod stays at the default 'high': changing it rebuilds the geometry
  return <EngineModel key={spec.id} spec={spec} idPrefix={`${prefix}engine`} explode={explode} />;
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
  const prefix = usePartPrefix();
  return <MotorModel key={spec.id} spec={spec} idPrefix={prefix + id} explode={explode} />;
}

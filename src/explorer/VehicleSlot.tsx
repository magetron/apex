/** Seam: which vehicle model the explorer renders (WP3's look-alike VehicleModel). */
import type { VehicleSpec } from '../spec/types';
import { VehicleModel } from '../vehicle3d';
import type { Level } from './view';

export interface VehicleSlotProps {
  vehicle: VehicleSpec;
  level: Level;
  part?: string;
}

export function VehicleSlot(props: VehicleSlotProps) {
  return <VehicleModel {...props} />;
}

/**
 * One drivetrain clock per car: shafts and wheels spin at their correct relative speeds
 * (prop at gearbox output, half shafts and wheels slower by the final drive). Components
 * register their spinning object once; VehicleModel advances everything in a single useFrame.
 */
import { createContext, useContext, useEffect, type RefObject } from 'react';
import type { Object3D } from 'three';

export type SpinSource = 'crank' | 'prop' | 'half' | 'road';

export interface Spinner {
  ref: RefObject<Object3D | null>;
  axis: 'x' | 'y' | 'z';
  src: SpinSource;
  /** +1 / −1 */
  dir: number;
}

export class SpinRegistry {
  list: Spinner[] = [];
  add(s: Spinner) {
    this.list.push(s);
    return () => {
      const i = this.list.indexOf(s);
      if (i >= 0) this.list.splice(i, 1);
    };
  }
}

export const SpinContext = createContext<SpinRegistry | null>(null);

export function useSpin(
  ref: RefObject<Object3D | null>,
  axis: Spinner['axis'],
  src: SpinSource,
  dir = 1,
) {
  const reg = useContext(SpinContext);
  useEffect(() => (reg ? reg.add({ ref, axis, src, dir }) : undefined), [reg, ref, axis, src, dir]);
}

/** Visual final-drive ratio between prop and half shafts. */
export const FINAL_DRIVE = 3.4;

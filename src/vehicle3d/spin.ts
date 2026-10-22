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

/**
 * The most a road wheel turns on screen in one frame. At speed a wheel turns 30–50° a frame, near
 * its spoke spacing (36° for ten spokes), and the spokes strobe back and forth (the wagon-wheel
 * effect): shown slower, it reads as a wheel spinning fast instead of one shaking.
 */
export const ROAD_STEP_MAX = (14 * Math.PI) / 180;
const TAU = 2 * Math.PI;

/**
 * A road wheel's angle as drawn (rad): turned each frame by how far the car went forward over
 * the road, at most ROAD_STEP_MAX. Taken from the car's travel, not from the sim's own wheel
 * angle: that wraps at a full turn, and at speed one slow frame turns a wheel more than half a
 * turn, which the shorter way round would show as a wheel jerking backwards.
 */
export class RoadSpin {
  shown = 0;
  private x = NaN;
  private z = NaN;

  /** The car's middle (world x, z, m) and heading (rad about +Y, 0 = +X) this frame. */
  update(x: number, z: number, yaw: number, radius: number): number {
    if (Number.isFinite(this.x)) {
      const ahead = (x - this.x) * Math.cos(yaw) - (z - this.z) * Math.sin(yaw);
      const step = Math.max(-ROAD_STEP_MAX, Math.min(ROAD_STEP_MAX, ahead / radius));
      this.shown = (this.shown + step) % TAU;
    }
    this.x = x;
    this.z = z;
    return this.shown;
  }

  /** Still, at the rest angle (and the next update takes no step). */
  reset() {
    this.shown = 0;
    this.x = this.z = NaN;
  }
}

import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import type { Vec3 } from '../spec/types';

export interface AssemblyContextValue {
  ref: RefObject<Group | null>;
  /** number of explode stages; stage k moves while explode ∈ [k/stages, (k+1)/stages] */
  stages: number;
  /** explode directions default to "away from this point" (assembly-local, metres) */
  center: Vector3;
  /** fixed explode amount for this assembly (e.g. an engine shown assembled inside a car) */
  explode?: number;
}

const root: AssemblyContextValue = { ref: { current: null }, stages: 1, center: new Vector3() };
export const AssemblyContext = createContext<AssemblyContextValue>(root);
export const useAssembly = () => useContext(AssemblyContext);

export interface AssemblyProps {
  stages?: number;
  center?: Vec3;
  /** override the global explode slider for everything inside */
  explode?: number;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  children: ReactNode;
}

/** A group of <Part>s that explode together. Nest one per engine/car. */
export function Assembly({
  stages = 1,
  center,
  explode,
  position,
  rotation,
  scale,
  children,
}: AssemblyProps) {
  const ref = useRef<Group>(null);
  const [cx, cy, cz] = center ?? [0, 0, 0];
  const value = useMemo<AssemblyContextValue>(
    () => ({ ref, stages, center: new Vector3(cx, cy, cz), explode }),
    [stages, cx, cy, cz, explode],
  );
  return (
    <group ref={ref} position={position} rotation={rotation} scale={scale}>
      <AssemblyContext.Provider value={value}>{children}</AssemblyContext.Provider>
    </group>
  );
}

/** id → live Object3D of every mounted <Part>, so the camera can frame any part by id. */
import type { Object3D } from 'three';

const parts = new Map<string, Object3D>();

export function registerPart(id: string, obj: Object3D): () => void {
  parts.set(id, obj);
  return () => {
    if (parts.get(id) === obj) parts.delete(id);
  };
}

export const getPartObject = (id: string): Object3D | undefined => parts.get(id);

/** Every mounted part (to frame a whole exploded assembly). */
export const allPartObjects = (): Object3D[] => [...parts.values()];

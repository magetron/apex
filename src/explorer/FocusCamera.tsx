/** Flies the camera to frame whatever the current zoom level is about. */
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { Object3D } from 'three';
import { frameObject, type FrameOptions } from '../scene/CameraRig';
import { allPartObjects, getPartObject } from '../scene/registry';
import { useScene } from '../scene/store';
import { useModelLoad } from '../vehicle3d/gltf/load';
import { gltfUrl } from '../vehicle3d/gltf/manifest';
import { freeWindow } from './freeWindow';
import type { Level, View } from './view';

const FRAMING: Record<Level, FrameOptions> = {
  // front three-quarter, a little above
  car: { azimuth: Math.PI * 0.3, polar: Math.PI * 0.39, padding: 0.18 },
  // higher, so the drivetrain reads in plan
  internals: { azimuth: Math.PI * 0.24, polar: Math.PI * 0.3, padding: 0.04 },
  // keep the current angle, fill the view with the part
  part: { padding: 0.15 },
  // a chase distance (~9 m) and height; the drive scene's chase camera takes over the azimuth
  drive: { azimuth: Math.PI * 0.2, polar: Math.PI * 0.3, padding: 0.75 },
};

/** visible, and every ancestor too (an isolated or hidden part must not stretch the frame) */
function shownInScene(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * What to frame: the part; else every visible part (the wheels stand outside the body, and an
 * exploded car spreads in all directions); in drive, the body (a chase distance).
 */
function targets(view: View): Object3D[] {
  if (view.level === 'part' && view.part) return [getPartObject(view.part)].filter((o) => !!o);
  if (view.level !== 'drive') return allPartObjects().filter(shownInScene);
  return [getPartObject('body')].filter((o): o is Object3D => !!o);
}

/** The explode amount once the slider has rested (no camera chase while it is dragged). */
function useSettledExplode(level: Level): number {
  const explode = useScene((s) => s.explode);
  const [settled, setSettled] = useState(explode);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(explode), 300);
    return () => window.clearTimeout(t);
  }, [explode]);
  return level === 'internals' || level === 'part' ? Math.round(settled * 10) : 0;
}

export function FocusCamera({ view }: { view: View }) {
  const canvas = useThree((s) => s.gl.domElement);
  // a detailed model that streams in changes the car's bounds: frame again once it's there
  const url = gltfUrl(view.vehicleId);
  const ready = useModelLoad((s) => (url ? s[url]?.state === 'ready' : true));
  // exploding moves parts outward: frame again once the slider rests, so none leave the view
  const explode = useSettledExplode(view.level);
  const key = `${view.vehicleId}|${view.level}|${view.part ?? ''}|${ready}|${explode}`;
  useEffect(() => {
    // wait a beat so isolation/visibility and layout morphs have applied, then two frames, so the
    // render loop has run since (leaving Drive, the car only returns from down the road there;
    // a timer alone also fires in a background tab, where no frame runs)
    let raf = 0;
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          const objs = targets(view);
          if (!objs.length) return;
          const o = FRAMING[view.level];
          // drive keeps a chase distance; elsewhere fit into the room the HUD leaves
          const free = view.level === 'drive' ? undefined : freeWindow(canvas, 1.6);
          void frameObject(objs, { ...o, window: free });
        });
      });
    }, 80);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
    // the key captures every field that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/**
 * Flies the camera to frame whatever the view is about. One car view: switching see-through
 * never moves the camera. A swap to another car, a zoomed part or a settled explode keeps the
 * visitor's angle and only refits the distance, so it reads as the same view of a different car.
 * Arriving (first load, back from drive) sets the default angle; comparing cars, the angle of
 * the visitor's view preset, through a long lens.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  Box3,
  Fog,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type ShaderMaterial,
} from 'three';
import { frameObject, type FrameOptions } from '../scene/CameraRig';
import { allPartObjects, getPartObject } from '../scene/registry';
import { useScene } from '../scene/store';
import { useModelLoad } from '../vehicle3d/gltf/load';
import { gltfUrl } from '../vehicle3d/gltf/manifest';
import { compareFov, useCompare, VIEW_ANGLES } from './compare';
import { freeWindow } from './freeWindow';
import type { Level, View } from './view';

/** the car view with see-through on or off is one framing */
type Scope = 'car' | 'part' | 'drive';
const scopeOf = (l: Level): Scope => (l === 'internals' ? 'car' : l);

/** front three-quarter, a little above: on arrival */
const ARRIVE = { azimuth: Math.PI * 0.3, polar: Math.PI * 0.36 };

const FRAMING: Record<Scope, FrameOptions> = {
  car: { padding: 0.12 },
  // fill the view with the part
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
 * What to frame: the part; else every visible part (the wheels stand outside the body, an
 * exploded car spreads in all directions, compared cars stand beside it); in drive, the body.
 */
function targets(view: View): Object3D[] {
  if (view.level === 'part' && view.part) return [getPartObject(view.part)].filter((o) => !!o);
  if (view.level !== 'drive') return allPartObjects().filter(shownInScene);
  return [getPartObject('body')].filter((o): o is Object3D => !!o);
}

const hasBounds = (objs: Object3D[]) => {
  const box = new Box3();
  for (const o of objs) box.union(new Box3().setFromObject(o));
  return !box.isEmpty();
};

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

/** The floor grid's fade-out distance (drei <Grid>), found once in the scene. */
type FadeUniform = { value: number };
function gridFade(scene: Object3D): FadeUniform | null {
  let u: FadeUniform | null = null;
  scene.traverse((o) => {
    const uniforms = ((o as Mesh).material as ShaderMaterial | undefined)?.uniforms;
    if (!u && uniforms?.fadeDistance && uniforms.worldCamProjPosition) u = uniforms.fadeDistance;
  });
  return u;
}

/**
 * While cars are compared, a long lens: the field of view narrows and the camera backs off by
 * the same factor in the same frame (a dolly zoom: the cars keep their size on screen), so a car
 * parked further away no longer looks smaller. The fog and the floor grid's fade move back with
 * the camera. All of it returns when the comparison ends.
 */
function useCompareLens(cars: number) {
  const on = cars > 1;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const normal = useRef<number | null>(null);
  const fogged = useRef<{ fog: Fog; near: number; far: number } | null>(null);
  const grid = useRef<{ u: FadeUniform; base: number } | null>(null);
  useFrame(() => {
    // the lens changes with the camera's distance in one step (and only once the camera
    // controls are up, on a deep link straight into a comparison)
    if (normal.current === null) normal.current = camera.fov;
    const lens = cars > 1 ? compareFov(cars) : normal.current;
    const c = useScene.getState().controls;
    if (c && Math.abs(camera.fov - lens) > 1e-3) {
      const k = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((lens * Math.PI) / 360);
      camera.fov = lens;
      camera.updateProjectionMatrix();
      void c.dollyTo(c.distance * k, false);
    }
    const fog = scene.fog;
    const f = fogged.current;
    const g = grid.current;
    if (!on) {
      if (f) {
        f.fog.near = f.near;
        f.fog.far = f.far;
        fogged.current = null;
      }
      if (g) {
        g.u.value = g.base;
        grid.current = null;
      }
      return;
    }
    const d = useScene.getState().controls?.distance ?? 0;
    // (a theme change brings a new fog)
    if (fog instanceof Fog) {
      if (f?.fog !== fog) fogged.current = { fog, near: fog.near, far: fog.far };
      fog.near = Math.max(fogged.current!.near, d * 1.3);
      fog.far = Math.max(fogged.current!.far, d * 3.5);
    }
    if (!g) {
      const u = gridFade(scene);
      if (u) grid.current = { u, base: u.value };
    }
    if (grid.current) grid.current.u.value = Math.max(grid.current.base, d * 1.8);
  });
}

export function FocusCamera({ view, compare = '' }: { view: View; compare?: string }) {
  const canvas = useThree((s) => s.gl.domElement);
  // a detailed model that streams in changes the car's bounds: frame again once it's there
  // (the compared cars' too)
  const urls = [view.vehicleId, ...(view.level === 'drive' ? [] : (view.vs ?? []))]
    .map(gltfUrl)
    .filter((u): u is string => !!u);
  const ready = useModelLoad((s) => urls.filter((u) => s[u]?.state === 'ready').length);
  // exploding moves parts outward: frame again once the slider rests, so none leave the view
  const explode = useSettledExplode(view.level);
  const scope = scopeOf(view.level);
  // comparing (in the car view): the visitor's preset says where to look from
  const mode = useCompare((s) => s.mode);
  const preset = useCompare((s) => s.view);
  const comparing = scope === 'car' && !!view.vs?.length;
  useCompareLens(comparing ? view.vs!.length + 1 : 0);
  const lens = comparing ? `${preset}|${mode}|${view.vs!.join(',')}` : '';
  const key = `${view.vehicleId}|${scope}|${view.part ?? ''}|${ready}|${explode}|${lens}|${compare}`;
  /**
   * The framing the view had before; whether the car has been framed since arriving; and an
   * angle still to fly to (a preset picked, or a comparison ended) once there is something to
   * frame.
   */
  const last = useRef<{
    scope: Scope | null;
    framed: boolean;
    lens: string;
    angles: FrameOptions | null;
  }>({ scope: null, framed: false, lens: '', angles: null });
  useEffect(() => {
    const prev = last.current.scope;
    last.current.scope = scope;
    if (scope === 'drive' || prev === 'drive') last.current.framed = false;
    if (scope === 'car' && (lens !== last.current.lens || !last.current.framed)) {
      // a new comparison, preset or mode (or arriving with one) looks from its preset; the end
      // of one from the front three-quarter again (a plan view suits two cars, not one). A part
      // zoomed and left keeps the angle.
      last.current.angles = lens ? VIEW_ANGLES[preset] : last.current.lens ? ARRIVE : null;
      last.current.lens = lens;
    }
    // wait a beat so isolation/visibility and layout morphs have applied, then two frames, so the
    // render loop has run since (leaving Drive, the car only returns from down the road there;
    // a timer alone also fires in a background tab, where no frame runs)
    let raf = 0;
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          const objs = targets(view);
          // a model still streaming has no bounds yet: frame when it's there
          if (!objs.length || !hasBounds(objs)) return;
          const arrive = scope === 'car' && !last.current.framed;
          const angles = scope === 'car' ? last.current.angles : null;
          if (scope !== 'drive') last.current.framed = true;
          if (scope === 'car') last.current.angles = null;
          const o = { ...FRAMING[scope], ...(arrive ? ARRIVE : {}), ...(angles ?? {}) };
          // drive keeps a chase distance; elsewhere fit into the room the HUD leaves (cars side
          // by side seen from above stand as tall as they are long)
          const free =
            scope === 'drive'
              ? undefined
              : freeWindow(canvas, comparing && preset === 'top' ? 1.1 : 1.6);
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

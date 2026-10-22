/**
 * The hot-lap camera, through the shared camera-controls:
 *  - chase: follows car A from behind and a little above, swinging round with its heading; the
 *    visitor may orbit and zoom (the angle they leave it at is kept relative to the car);
 *  - map: straight down over the whole circuit, turned the way its usual track map is drawn,
 *    fitted into the part of the view the HUD leaves free.
 * A circuit is kilometres across: the far plane, the fog and the controls' distance limit open
 * up while here (and the near plane follows the height from above, for depth precision), and
 * all of them are given back on leaving. It aims at car A's pose for this very frame, before the
 * camera-controls move the camera (drive/motion.ts: the frame order).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Box3, Fog, Vector3, type PerspectiveCamera } from 'three';
import { fitBox } from '../../scene/CameraRig';
import { useScene, type Controls } from '../../scene/store';
import type { TrackPath } from '../../sim/track';
import { angleDiff } from '../../spec/units';
import { CAMERA_PRIORITY, follow, frameDt } from '../drive/motion';
import { freeWindow } from '../freeWindow';
import type { RacerPose } from './pose';
import type { TrackCamera } from './state';

const CHASE = { dist: 10, polar: 1.2, lift: 0.7 };
const TOP_POLAR = 0.02;
const FAR = 40000;
/** the chase swings round with the car over this long (s) */
const SWING = 0.35;

export function useTrackCamera(
  path: TrackPath,
  mapHeadingDeg: number,
  mode: TrackCamera,
  carA: RacerPose,
) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const canvas = useThree((s) => s.gl.domElement);
  // from above, the circuit is fitted again when the view changes size (settled a moment first)
  const size = useThree((s) => s.size);
  const [fit, setFit] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setFit(`${size.width}x${size.height}`), 250);
    return () => window.clearTimeout(t);
  }, [size.width, size.height]);
  const st = useRef({
    offset: 0,
    /** the azimuth the chase aimed for last frame (NaN: none yet) */
    want: NaN,
    dragging: false,
    framed: '' as string,
    saved: null as null | { far: number; near: number; max: number; c: Controls },
    fog: null as null | { fog: Fog; near: number; far: number },
  });

  // give the explorer its camera, fog and limits back on leaving
  useEffect(
    () => () => {
      const s = st.current;
      if (s.saved) {
        camera.far = s.saved.far;
        camera.near = s.saved.near;
        camera.updateProjectionMatrix();
        s.saved.c.maxDistance = s.saved.max;
        void s.saved.c.setFocalOffset(0, 0, 0, false);
      }
      if (s.fog) {
        s.fog.fog.near = s.fog.near;
        s.fog.fog.far = s.fog.far;
      }
    },
    [camera],
  );

  // the visitor taking the camera in the chase: their angle becomes the offset from behind
  useEffect(() => {
    const c = useScene.getState().controls;
    if (!c) return;
    const start = () => (st.current.dragging = true);
    const end = () => {
      st.current.dragging = false;
      st.current.offset = angleDiff(c.azimuthAngle, behind(carA.yaw), 2 * Math.PI);
    };
    c.addEventListener('controlstart', start);
    c.addEventListener('controlend', end);
    return () => {
      c.removeEventListener('controlstart', start);
      c.removeEventListener('controlend', end);
    };
  }, [carA]);

  useFrame((_, delta) => {
    const c = useScene.getState().controls;
    if (!c) return;
    const s = st.current;
    const dt = frameDt(delta);
    if (!s.saved) {
      s.saved = { far: camera.far, near: camera.near, max: c.maxDistance, c };
      camera.far = FAR;
      camera.updateProjectionMatrix();
    }
    if (c.maxDistance < FAR / 4) c.maxDistance = FAR / 4;
    const fog = scene.fog;
    if (fog instanceof Fog && s.fog?.fog !== fog) s.fog = { fog, near: fog.near, far: fog.far };

    const key = mode === 'map' ? `map|${path.id}|${fit}` : `chase|${path.id}`;
    if (mode === 'map') {
      if (s.framed !== key) {
        s.framed = key;
        void c.setFocalOffset(0, 0, 0, true);
        frameMap(c, camera, path, mapHeadingDeg, canvas);
      }
      // the near plane follows the height: depth precision for a ribbon seen from kilometres up
      const near = Math.max(0.1, c.distance * 0.02);
      if (Math.abs(camera.near - near) > near * 0.05) {
        camera.near = near;
        camera.updateProjectionMatrix();
      }
      if (fog instanceof Fog) {
        fog.near = c.distance * 10;
        fog.far = c.distance * 20;
      }
      return;
    }

    // chase
    if (camera.near !== 0.1) {
      camera.near = 0.1;
      camera.updateProjectionMatrix();
    }
    if (fog instanceof Fog) {
      fog.near = Math.max(s.fog?.near ?? 14, 160);
      fog.far = Math.max(s.fog?.far ?? 45, 1600);
    }
    if (s.framed !== key) {
      // arriving (or back from above): from behind, at the chase distance and height
      s.framed = key;
      s.offset = 0;
      s.want = NaN;
      const back = CHASE.dist * Math.sin(CHASE.polar);
      void c.setLookAt(
        carA.x - Math.cos(carA.yaw) * back,
        CHASE.dist * Math.cos(CHASE.polar) + CHASE.lift,
        carA.z + Math.sin(carA.yaw) * back,
        carA.x,
        CHASE.lift,
        carA.z,
        true,
      );
      return;
    }
    void c.moveTo(carA.x, CHASE.lift, carA.z, false);
    if (s.dragging) {
      s.want = NaN;
      return;
    }
    // swung round after the car's heading, the same way behind it through a corner at any frame
    // rate (last frame's aim and this one's, unwrapped next to where the camera is)
    const want = behind(carA.yaw) + s.offset;
    const was = Number.isFinite(s.want) ? s.want : want;
    const cur = c.azimuthAngle;
    const from = cur + angleDiff(was, cur, 2 * Math.PI);
    c.azimuthAngle = follow(cur, from, from + angleDiff(want, was, 2 * Math.PI), dt, SWING);
    s.want = want;
  }, CAMERA_PRIORITY);
}

/**
 * The free part of the view, kept below the breadcrumb (freeWindow lets text overlap the car,
 * but a circuit drawn under it loses its corner).
 */
function clearOfTrail(
  canvas: HTMLElement,
  win: [number, number, number, number] | undefined,
): [number, number, number, number] | undefined {
  const trail = document.querySelector('.apx-dock--top-left')?.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  if (!trail || !c.height) return win;
  const [x0, y0, x1, y1] = win ?? [-1, -1, 1, 1];
  const left = ((trail.right - c.left) / c.width) * 2 - 1;
  const below = ((c.bottom - trail.bottom - 8) / c.height) * 2 - 1;
  // only where the window reaches over the trail
  return x0 < left && y1 > below ? [x0, y0, x1, Math.max(y0 + 0.2, below)] : [x0, y0, x1, y1];
}

/** camera-controls' azimuth that puts the camera behind a car heading `yaw` */
const behind = (yaw: number) => Math.atan2(-Math.cos(yaw), Math.sin(yaw));

const box = new Box3();

/** Straight down over the circuit, turned as its map is drawn, fitted into the free view. */
function frameMap(
  c: Controls,
  camera: PerspectiveCamera,
  path: TrackPath,
  mapHeadingDeg: number,
  canvas: HTMLElement,
) {
  const pts: Vector3[] = [];
  for (let i = 0; i < path.n; i += 8)
    for (const o of [-path.wr[i] - 2, path.wl[i] + 2])
      pts.push(
        new Vector3(
          path.x[i] - o * Math.sin(path.psi[i]),
          0,
          -(path.y[i] + o * Math.cos(path.psi[i])),
        ),
      );
  box.setFromPoints(pts);
  // screen right on the ground is (cos θ, −sin θ): the start straight (+X) at the map's angle
  const az = (-mapHeadingDeg * Math.PI) / 180;
  // how wide the circuit is on screen, turned that way, for the free part of the view to fit it
  const ca = Math.cos(az);
  const sa = Math.sin(az);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of pts) {
    const u = p.x * ca - p.z * sa;
    const v = -p.x * sa - p.z * ca;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const aspect = Math.max(0.6, Math.min(2.5, (u1 - u0) / Math.max(1, v1 - v0)));
  const win = clearOfTrail(canvas, freeWindow(canvas, aspect, 0.3));
  const { target, dist } = fitBox(
    box,
    az,
    TOP_POLAR,
    camera.fov,
    camera.aspect,
    { padding: 0.06, window: win },
    pts,
  );
  void c.setLookAt(
    target.x + dist * Math.sin(TOP_POLAR) * Math.sin(az),
    target.y + dist * Math.cos(TOP_POLAR),
    target.z + dist * Math.sin(TOP_POLAR) * Math.cos(az),
    target.x,
    target.y,
    target.z,
    true,
  );
}

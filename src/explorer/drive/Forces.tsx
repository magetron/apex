/**
 * Friction circles and tyre-force arrows at the four contact patches, drawn over the car
 * (x-ray: no depth test). The circle's radius is the grip that tyre has at its current load,
 * the arrow the force it is making; when the arrow reaches the circle, the tyre is sliding.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import type { CarParams, CarState } from '../../sim/model';
import type { DriveColors } from './colors';
import { gripColor } from './Tracks';
import { wheelForce, wheelPoint, yawOf, type Ground } from './world';

/** metres of radius per newton (a 4.5 kN tyre draws a 0.5 m circle) */
export const FORCE_SCALE = 1 / 9000;
const Y = 0.03;
const HEAD = 0.16;

const ring = new RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2);
const shaft = new PlaneGeometry(1, 0.06).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
const headShape = new Shape();
headShape.moveTo(0, -HEAD * 0.55);
headShape.lineTo(HEAD, 0);
headShape.lineTo(0, HEAD * 0.55);
headShape.closePath();
const head = new ShapeGeometry(headShape).rotateX(-Math.PI / 2);

const pt: Ground = { x: 0, z: 0 };
const f: Ground = { x: 0, z: 0 };

export function Forces({
  run,
  colors,
}: {
  run: { p: CarParams; view: CarState };
  colors: DriveColors;
}) {
  const parts = useMemo(() => {
    const ringMat = new MeshBasicMaterial({
      color: colors.ring,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    });
    const wheels = [0, 1, 2, 3].map(() => {
      const mat = new MeshBasicMaterial({
        color: colors.grip,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      });
      const g = new Group();
      const r = new Mesh(ring, ringMat);
      const s = new Mesh(shaft, mat);
      const h = new Mesh(head, mat);
      for (const m of [r, s, h]) {
        m.renderOrder = 30;
        m.frustumCulled = false;
        g.add(m);
      }
      return { g, r, s, h, mat };
    });
    return { ringMat, wheels };
  }, [colors]);
  useEffect(
    () => () => {
      parts.ringMat.dispose();
      parts.wheels.forEach((w) => w.mat.dispose());
    },
    [parts],
  );
  const palette = useMemo(
    () => ({
      grip: new Color(colors.ring),
      limit: new Color(colors.limit),
      slide: new Color(colors.slide),
    }),
    [colors],
  );

  useFrame(() => {
    const { p, view: st } = run;
    for (let i = 0; i < 4; i++) {
      const w = parts.wheels[i];
      wheelPoint(p, st, i, pt);
      w.g.position.set(pt.x, Y, pt.z);
      const rad = Math.max(0.02, st.cap[i] * FORCE_SCALE);
      w.r.scale.setScalar(rad);
      wheelForce(st, i, f);
      const mag = Math.hypot(f.x, f.z);
      const len = mag * FORCE_SCALE;
      const show = len > 0.03;
      w.s.visible = show;
      w.h.visible = show;
      if (show) {
        const yaw = yawOf(f.x, f.z);
        // the shaft stops where the head starts, so the tip sits exactly at the force
        const body = Math.max(0.001, len - HEAD);
        w.s.rotation.y = yaw;
        w.s.scale.set(body, 1, 1);
        w.h.rotation.y = yaw;
        w.h.position.set((f.x / mag) * body, 0, (f.z / mag) * body);
      }
      gripColor(w.mat.color, st.cap[i] > 0 ? mag / st.cap[i] : 1, palette);
    }
  });

  return (
    <group>
      {parts.wheels.map((w, i) => (
        <primitive key={i} object={w.g} />
      ))}
    </group>
  );
}

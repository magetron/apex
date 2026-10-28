/**
 * Where a car's body sits at rest, for the side view round the key moment (camera.ts): a faint
 * grey line just over its roof's height at rest (the spec's), nose to tail, held level with the
 * road (grey reads over a black car and a pale road alike): it moves and turns with the car but
 * never pitches or rolls. The body's pitch (state.ts shownPitch) shows against it: braking or
 * lifting, the front of the roof drops away from it and the tail rises into it; on the throttle,
 * the other way round. Seen only while the camera is at the side. Shared geometry, nothing
 * allocated per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { driveSide } from './camera';
import { FADED, type Lane } from './lanes';
import { groundScale } from './Tracks';
import { poseOrigin, type Ground } from './world';

const rod = new BoxGeometry(1, 1, 1);
/** how far past the nose and the tail the line runs, and how far over the roof (m) */
const OVER = 0.1;
const GAP = 0.03;
/** its thickness on screen (px), and how faint */
const PX = 2;
const OPACITY = 0.7;
const pt: Ground = { x: 0, z: 0 };

export function Level({ lane, color }: { lane: Lane; color: string }) {
  const group = useRef<Group>(null);
  const line = useRef<Mesh>(null);
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const { p } = lane;
  const { length, height, overhangF } = p.dims;
  // the body's middle, from the pose origin (the wheelbase middle)
  const cx = p.L / 2 + overhangF - length / 2;

  useFrame(() => {
    const g = group.current;
    const m = line.current;
    if (!g || !m) return;
    const k = driveSide.w * lane.drawn;
    g.visible = k > FADED;
    if (!g.visible) return;
    mat.opacity = OPACITY * k;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, 0, pt.z);
    g.rotation.set(0, st.yaw, 0);
    const th = Math.max(0.01, PX * groundScale.mPerPx);
    m.scale.set(length + 2 * OVER, th, th);
    m.position.set(cx, height + GAP + th / 2, 0);
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={line} geometry={rod} material={mat} />
    </group>
  );
}

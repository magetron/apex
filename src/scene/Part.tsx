/**
 * <Part> is the unit of the exploded view: something you can hover, select, label, highlight
 * and explode. Wrap each logical component (crankshaft, gearbox, left half-shaft…) in one.
 *
 *   <Part id="gearbox" system="gearbox" label="Gearbox" position={[x, y, z]}
 *         explode={{ dist: 0.4, stage: 1 }}>
 *     <mesh material={sysMat('gearbox')}>…</mesh>
 *   </Part>
 *
 * - explode.dir defaults to "away from the assembly centre", measured when the explode starts.
 * - Changing position/rotation tweens the part there (layout morphs), unless morph={false}.
 * - Ids must be unique per scene; prefix nested ones (e.g. "engine/crank").
 * - Clicking calls the scene store's pick(id) (the explorer zooms; default toggles selection).
 * - When the store has a focus, unrelated parts hide; parts register so the camera can frame them.
 */
import { Select } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box3, Euler, Quaternion, Vector3, type EulerOrder, type Group } from 'three';
import type { Vec3 } from '../spec/types';
import { useAssembly } from './Assembly';
import type { System } from './palette';
import { PartLabel } from './PartLabel';
import { registerPart } from './registry';
import { relatedToFocus, useScene } from './store';

export interface ExplodeSpec {
  /** direction in the assembly frame; default: away from the assembly centre */
  dir?: Vec3;
  /** travel in metres at full explode */
  dist: number;
  /** which explode stage moves this part (0-based) */
  stage?: number;
}

export interface PartProps {
  id: string;
  system?: System;
  label?: string;
  position?: Vec3;
  rotation?: Vec3;
  rotationOrder?: EulerOrder;
  explode?: ExplodeSpec;
  morph?: boolean;
  /** false = not hoverable/selectable (decorative bits) */
  interactive?: boolean;
  children: ReactNode;
}

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** How far (px) the pointer may move between press and release and still count as a click. */
const CLICK_SLOP_PX = 5;

export function Part({
  id,
  system,
  label,
  position,
  rotation,
  rotationOrder = 'YXZ',
  explode,
  morph = true,
  interactive = true,
  children,
}: PartProps) {
  const asm = useAssembly();
  const outer = useRef<Group>(null);
  const offset = useRef<Group>(null);
  const content = useRef<Group>(null);
  const s = useRef({
    cur: 0,
    dir: new Vector3(0, 1, 0),
    targetPos: new Vector3(),
    targetQuat: new Quaternion(),
    placed: false,
  }).current;

  const hovered = useScene((st) => st.hovered === id);
  const selected = useScene((st) => st.selected === id);
  const highlighted = useScene((st) => st.highlight.includes(id));
  const labels = useScene((st) => st.labels);
  const hidden = useScene((st) => st.focus !== null && !relatedToFocus(id, st.focus));
  const setHovered = useScene((st) => st.setHovered);
  const pick = useScene((st) => st.pick);

  useLayoutEffect(() => (content.current ? registerPart(id, content.current) : undefined), [id]);

  const posKey = position?.join(',') ?? '0,0,0';
  const rotKey = rotation?.join(',') ?? '0,0,0';
  useLayoutEffect(() => {
    const p = position ?? [0, 0, 0];
    const r = rotation ?? [0, 0, 0];
    s.targetPos.set(p[0], p[1], p[2]);
    s.targetQuat.setFromEuler(new Euler(r[0], r[1], r[2], rotationOrder));
    const g = outer.current;
    if (g && (!s.placed || !morph)) {
      g.position.copy(s.targetPos);
      g.quaternion.copy(s.targetQuat);
      s.placed = true;
    }
    // position/rotation are captured via their string keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey, rotKey, rotationOrder, morph]);

  /** Measure the explode direction from where the part is right now. */
  const measureDir = () => {
    const g = outer.current;
    const c = content.current;
    if (!g || !c) return;
    const d = new Vector3();
    if (explode?.dir) {
      d.set(...explode.dir);
    } else {
      const box = new Box3().setFromObject(c);
      if (!box.isEmpty()) {
        box.getCenter(d);
        if (asm.ref.current) asm.ref.current.worldToLocal(d);
        d.sub(asm.center);
      }
    }
    if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
    d.normalize();
    // assembly frame → this part's parent frame
    const qa = new Quaternion();
    if (asm.ref.current) asm.ref.current.getWorldQuaternion(qa);
    const qo = new Quaternion();
    g.getWorldQuaternion(qo);
    s.dir.copy(d.applyQuaternion(qa).applyQuaternion(qo.invert()));
  };

  useFrame((_, dt) => {
    const g = outer.current;
    const o = offset.current;
    if (!g || !o) return;
    if (morph && s.placed) {
      const k = 1 - Math.exp(-6 * dt);
      g.position.lerp(s.targetPos, k);
      g.quaternion.slerp(s.targetQuat, k);
    }
    if (!explode) return;
    const e = asm.explode ?? useScene.getState().explode;
    const t = smooth(Math.min(1, Math.max(0, e * asm.stages - (explode.stage ?? 0))));
    const target = explode.dist * t;
    if (target > 0 && s.cur < 1e-4) measureDir();
    s.cur = Math.abs(target - s.cur) < 1e-5 ? target : damp(s.cur, target, 9, dt);
    o.position.copy(s.dir).multiplyScalar(s.cur);
  });

  const showLabel =
    !!label && (labels === 'all' || (labels === 'hover' && (hovered || selected || highlighted)));
  const [anchor, setAnchor] = useState<Vec3 | null>(null);
  useLayoutEffect(() => {
    const c = content.current;
    if (!showLabel || !c) return;
    const box = new Box3().setFromObject(c);
    if (box.isEmpty()) return setAnchor([0, 0, 0]);
    const top = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    c.worldToLocal(top);
    setAnchor([top.x, top.y, top.z]);
  }, [showLabel]);

  return (
    <group ref={outer} visible={!hidden}>
      <group ref={offset}>
        <group
          ref={content}
          onPointerOver={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  setHovered(id);
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  if (useScene.getState().hovered === id) setHovered(null);
                }
              : undefined
          }
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  // a camera drag that happens to end over a part is not a click on it
                  if (e.delta > CLICK_SLOP_PX) return;
                  pick(id);
                }
              : undefined
          }
        >
          <Select enabled={hovered || selected || highlighted}>{children}</Select>
          {showLabel && anchor && label && (
            <PartLabel
              position={anchor}
              text={label}
              system={system}
              active={hovered || selected}
            />
          )}
        </group>
      </group>
    </group>
  );
}

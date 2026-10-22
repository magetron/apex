/**
 * A comparison car on the road: its footprint (sized from its spec, with a notch at the nose so
 * its heading reads against its line), its layout code as a label with a live balance needle
 * (left = oversteer, right = understeer, from its axle slip angles), and a pin where one of its
 * axles first ran out of grip.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type CSSProperties, type Ref } from 'react';
import {
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import type { Lane } from './lanes';
import { poseOrigin, type Ground } from './world';

const plate = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const outline = new EdgesGeometry(plate);
const notchShape = new Shape();
notchShape.moveTo(0, -0.5);
notchShape.lineTo(1, 0);
notchShape.lineTo(0, 0.5);
notchShape.closePath();
const notch = new ShapeGeometry(notchShape).rotateX(-Math.PI / 2);
const pt: Ground = { x: 0, z: 0 };

/** slip-angle difference (rad) that moves the needle to the end stop */
const FULL = 0.06;
/** needle travel either side (px) */
const TRAVEL = 11;

/** Live balance of a car from its axle slip angles: −1 oversteer … +1 understeer. */
export function balanceOf(lane: Lane): number {
  const st = lane.view;
  if (Math.hypot(st.vx, st.vy) < 3 || Math.abs(st.ay) < 1) return 0;
  return Math.max(-1, Math.min(1, (Math.abs(st.alphaF) - Math.abs(st.alphaR)) / FULL));
}

/** Move a balance needle (called from a useFrame: drei's <Html> content is outside the
 *  canvas, where R3F hooks don't work). `last` keeps the DOM untouched while it doesn't move. */
export function moveNeedle(el: HTMLElement | null, lane: Lane, last: { px: number }) {
  const px = Math.round(balanceOf(lane) * TRAVEL);
  if (px === last.px || !el) return;
  last.px = px;
  el.style.transform = `translateX(${px}px)`;
}

export function BalanceNeedle({ needle }: { needle: Ref<HTMLElement> }) {
  return (
    <span className="apx-drive-needle" aria-hidden>
      <i ref={needle} />
    </span>
  );
}

export function LaneCar({ lane, label, color }: { lane: Lane; label?: string; color: string }) {
  const group = useRef<Group>(null);
  const needle = useRef<HTMLElement>(null);
  const last = useMemo(() => ({ px: NaN }), []);
  const { p } = lane;
  const mats = useMemo(
    () => ({
      floor: new MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false }),
      line: new LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    }),
    [color],
  );
  useEffect(
    () => () => {
      mats.floor.dispose();
      mats.line.dispose();
    },
    [mats],
  );

  // footprint from the spec: bumper to bumper, relative to the wheelbase midpoint
  const { length, width, height, overhangF } = p.dims;
  const cx = p.L / 2 + overhangF - length / 2;
  const nose = cx + length / 2;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, 0, pt.z);
    g.rotation.set(0, st.yaw, 0);
    moveNeedle(needle.current, lane, last);
  });

  return (
    <group ref={group}>
      {/* a footprint on the road, not a 3D box: a translucent volume sitting inside the real
          car z-sorts against its glass and flickers */}
      <mesh
        geometry={plate}
        material={mats.floor}
        position={[cx, 0.01, 0]}
        scale={[length, 1, width]}
        renderOrder={3}
      />
      <lineSegments position={[cx, 0.012, 0]} scale={[length, 1, width]} renderOrder={3}>
        <primitive object={outline} attach="geometry" />
        <primitive object={mats.line} attach="material" />
      </lineSegments>
      <mesh
        geometry={notch}
        position={[nose - 0.02, 0.013, 0]}
        scale={[0.7, 1, width * 0.6]}
        renderOrder={3}
      >
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Html
        position={[cx, Math.min(height * 0.9, 0.5), 0]}
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="apx-label apx-drive-carlabel"
          style={{ '--sys': color } as CSSProperties}
          title={lane.info.name}
        >
          <span className="apx-label__dot" />
          {label ?? lane.info.code}
          <BalanceNeedle needle={needle} />
        </div>
      </Html>
    </group>
  );
}

/** A pin where the car's first axle ran out of grip, once the playhead is past that moment. */
export function LetGoPin({
  lane,
  t,
  full,
  color,
}: {
  lane: Lane;
  t: { now: number };
  full: boolean;
  color: string;
}) {
  const group = useRef<Group>(null);
  const text = useRef<HTMLSpanElement>(null);
  const shown = useRef<string>('');
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const lg = lane.letGo;
    const on = !!lg && t.now >= lg.t;
    g.visible = on;
    const s = on ? `${lg.axle === 'rear' ? 'Rear' : 'Front'} let go · ${lg.g.toFixed(2)} g` : '';
    if (on) g.position.set(lg.x, 0, -lg.n);
    // the comparison cars only get the pin (their verdicts are in the info card)
    if (s !== shown.current && text.current) {
      shown.current = s;
      text.current.textContent = s;
      text.current.parentElement!.style.display = on && full ? '' : 'none';
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <circleGeometry args={[0.35, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Html position={[0, 0.2, 0]} zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className="apx-label apx-drive-letgo"
          style={{ '--sys': color, display: 'none' } as CSSProperties}
        >
          <span className="apx-label__dot" />
          <span ref={text} />
        </div>
      </Html>
    </group>
  );
}

/**
 * The see-through crossfade: one value per car that eases between the painted body (0) and the
 * x-ray (1) when the explorer switches see-through, so the switch reads as the same car turning
 * transparent rather than a new view. Per frame, so it never re-renders React; the few things
 * that must swap (wheel materials, overlays) swap once, at the midpoint, through <FadeGate>.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';

/** seconds for a full fade */
export const SEE_FADE_S = 0.45;

export interface SeeFade {
  /** where it is heading */
  on: boolean;
  /** linear progress 0..1 */
  t: number;
  /** eased progress 0..1: what the materials use */
  k: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Advance a fade by dt toward its target (pure, for the hook and its tests). */
export function stepFade(f: SeeFade, dt: number, duration = SEE_FADE_S) {
  const target = f.on ? 1 : 0;
  if (f.t === target) return;
  const step = dt / duration;
  f.t = f.on ? Math.min(1, f.t + step) : Math.max(0, f.t - step);
  f.k = smooth(f.t);
}

/** A car's fade. It starts where `on` says (a deep link or a car that mounts mid-view doesn't
 *  fade in); later changes ease. */
export function useSeeFade(on: boolean): SeeFade {
  const fade = useMemo<SeeFade>(() => ({ on, t: on ? 1 : 0, k: on ? 1 : 0 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    fade.on = on;
  }, [fade, on]);
  // before everything that reads it this frame
  useFrame((_, dt) => stepFade(fade, Math.min(dt, 0.1)), -2);
  return fade;
}

/** Renders `children(on)` with on = the fade past `at`; re-renders only when that flips. */
export function FadeGate({
  fade,
  at = 0.5,
  children,
}: {
  fade: SeeFade;
  at?: number;
  children: (on: boolean) => ReactNode;
}) {
  const [on, setOn] = useState(() => fade.k >= at);
  useFrame(() => {
    const now = fade.k >= at;
    if (now !== on) setOn(now);
  });
  return <>{children(on)}</>;
}

/** A group shown while the car is (or is turning) see-through: the drivetrain inside the body. */
export function WhileSeeThrough({ fade, children }: { fade: SeeFade; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (g) g.visible = fade.on || fade.k > 0;
  });
  return (
    <group ref={ref} visible={fade.on || fade.k > 0}>
      {children}
    </group>
  );
}

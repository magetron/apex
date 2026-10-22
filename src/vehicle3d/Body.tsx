/**
 * The look-alike body shell: opaque paint, glass and lamps at the car/drive levels; x-ray glass
 * with faint feature lines inside. The geometry comes from shell/build (cached per car).
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { paintMat } from '../scene/materials';
import { useScene } from '../scene/store';
import { useTheme } from '../scene/theme';
import type { VehicleSpec } from '../spec/types';
import { G, span } from './geom';
import {
  applyVehicleTheme,
  BODY_GHOST_OPACITY,
  bodyGhost,
  bodyLines,
  chromeMat,
  decalMat,
  rimMat,
  trimMat,
  tyreMat,
} from './materials';
import type { Shell } from './shell/build';

const DEFAULT_PAINT = '#9aa5b1';

export function useVehicleTheme() {
  const theme = useTheme((s) => s.theme);
  useLayoutEffect(() => applyVehicleTheme(theme), [theme]);
  return theme;
}

/** Fades the x-ray shell as the first explode stage lifts it away. */
export function BodyFade({ stages }: { stages: number }) {
  useFrame(() => {
    const e = useScene.getState().explode;
    const t = Math.min(1, Math.max(0, e * stages));
    const k = 1 - 0.75 * t * t * (3 - 2 * t);
    bodyGhost.uniforms.uOpacity.value = BODY_GHOST_OPACITY * k;
    bodyLines.opacity = (useTheme.getState().theme === 'light' ? 0.4 : 0.32) * (0.35 + 0.65 * k);
  });
  return null;
}

export function BodyShell({
  vehicle,
  shell,
  exterior,
  stages,
}: {
  vehicle: VehicleSpec;
  shell: Shell;
  exterior: boolean;
  stages: number;
}) {
  useVehicleTheme();
  const paint = vehicle.body.paint ?? DEFAULT_PAINT;
  const p = shell.shape.p;
  if (!exterior) {
    return (
      <>
        <BodyFade stages={stages} />
        <mesh geometry={shell.body} material={bodyGhost} renderOrder={5} />
        <mesh geometry={shell.wells} material={bodyGhost} renderOrder={5} />
        <lineSegments geometry={shell.lines} material={bodyLines} renderOrder={6} />
      </>
    );
  }
  const paintM = paintMat(paint);
  const lipM = p.lipMat === 'black' ? trimMat() : paintM;
  return (
    <>
      <mesh geometry={shell.body} material={paintM} castShadow receiveShadow />
      <mesh geometry={shell.wells} material={trimMat()} />
      {[...shell.decals].map(([kind, g]) => (
        <mesh key={kind} geometry={g} material={decalMat(kind, p.accent, paint)} />
      ))}
      {shell.lips && <mesh geometry={shell.lips} material={lipM} castShadow />}
      {shell.mirrors.map((m, i) => {
        const st = span(m.root, m.pos);
        const mirrorM = p.mirrors?.mat === 'black' ? trimMat() : paintM;
        return (
          <group key={i}>
            <mesh
              geometry={G.sphere}
              material={mirrorM}
              position={m.pos}
              scale={m.scale}
              castShadow
            />
            <mesh
              geometry={G.box}
              material={trimMat()}
              position={st.position}
              quaternion={st.quaternion}
              scale={[0.03, st.length, 0.05]}
            />
          </group>
        );
      })}
      {shell.tips.map((t, i) => (
        <group
          key={i}
          position={t.pos}
          rotation={[0, 0, Math.PI / 2]}
          scale={[t.r, 0.09, t.r * t.w]}
        >
          <mesh geometry={G.cyl} material={chromeMat()} />
          <mesh
            geometry={G.cylLo}
            material={trimMat()}
            position={[0, -0.02, 0]}
            scale={[0.78, 1, 0.78]}
          />
        </group>
      ))}
      {shell.spare && (
        <group position={shell.spare.pos} rotation={[0, 0, Math.PI / 2]}>
          <mesh
            geometry={G.cyl}
            material={tyreMat()}
            scale={[shell.spare.r, 0.22, shell.spare.r]}
            castShadow
          />
          <mesh
            geometry={G.cyl}
            material={rimMat(true)}
            position={[0, 0.006, 0]}
            scale={[shell.spare.r * 0.82, 0.22, shell.spare.r * 0.82]}
          />
        </group>
      )}
      {shell.rails.map((r, i) => {
        const st = span(r.from, r.to);
        return (
          <mesh
            key={i}
            geometry={G.cylLo}
            material={trimMat()}
            position={st.position}
            quaternion={st.quaternion}
            scale={[0.014, st.length, 0.014]}
          />
        );
      })}
    </>
  );
}

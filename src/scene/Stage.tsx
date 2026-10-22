/**
 * Common scene furniture: lights, studio environment (no network fetch), blueprint floor grid,
 * outline post-processing for hover/selection, the camera rig and the engine clock.
 * Follows the dark/light theme.
 */
import { Environment, Grid, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Outline, Selection } from '@react-three/postprocessing';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { DirectionalLight, Mesh } from 'three';
import { CameraRig } from './CameraRig';
import { retintGhosts } from './materials';
import { advanceCrank, vehiclePose } from './runtime';
import { useScene } from './store';
import { useSceneTheme, useTheme } from './theme';

function EngineClock() {
  useFrame((_, dt) => advanceCrank(Math.min(dt, 0.1)));
  return null;
}

const SUN: [number, number, number] = [4, 8, 5];
/** Shadow catcher height: just under the floor normally, just above the drive road surface. */
const CATCHER_Y = { stage: -0.0005, drive: 0.0065 };

/**
 * Sun + shadow catcher. The shadow camera only covers ±6 m, so in drive mode both follow the
 * car (vehiclePose); otherwise the car's shadow would clip and pop as it drives away.
 */
function Sun({ shadowOpacity }: { shadowOpacity: number }) {
  const light = useRef<DirectionalLight>(null);
  const catcher = useRef<Mesh>(null);
  useFrame(() => {
    const l = light.current;
    const c = catcher.current;
    if (!l || !c) return;
    const x = vehiclePose.active ? vehiclePose.x : 0;
    const z = vehiclePose.active ? vehiclePose.z : 0;
    l.position.set(x + SUN[0], SUN[1], z + SUN[2]);
    l.target.position.set(x, 0, z);
    l.target.updateMatrixWorld();
    c.position.set(x, vehiclePose.active ? CATCHER_Y.drive : CATCHER_Y.stage, z);
  });
  return (
    <>
      <directionalLight
        ref={light}
        position={SUN}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0002}
        // detailed car bodies shadow themselves in a crawling pattern ("acne") without it, which
        // reads as a dark, flickering car once the shadow map follows it in drive mode
        shadow-normalBias={0.03}
      />
      {/* depthWrite off: a transparent catcher must never z-fight the grid or the road */}
      <mesh ref={catcher} rotation-x={-Math.PI / 2} receiveShadow renderOrder={1}>
        <planeGeometry args={[16, 16]} />
        <shadowMaterial opacity={shadowOpacity} depthWrite={false} />
      </mesh>
    </>
  );
}

function HoverCursor() {
  const hovered = useScene((s) => s.hovered);
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
  }, [hovered]);
  return null;
}

export function Stage({ children }: { children: ReactNode }) {
  const theme = useTheme((s) => s.theme);
  const t = useSceneTheme();
  useLayoutEffect(() => retintGhosts(theme), [theme]);
  return (
    <>
      <color attach="background" args={[t.background]} />
      <fog attach="fog" args={[t.background, 14, 45]} />
      <hemisphereLight intensity={0.35} color={t.hemiSky} groundColor={t.hemiGround} />
      <Sun shadowOpacity={t.shadowOpacity} />
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[0, 6, 0]}
          rotation-x={Math.PI / 2}
          scale={[12, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[-6, 2, 2]}
          rotation-y={Math.PI / 2}
          scale={[8, 3, 1]}
          color="#9bd1ff"
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          position={[6, 2, -2]}
          rotation-y={-Math.PI / 2}
          scale={[8, 3, 1]}
          color="#ffd6a5"
        />
        <Lightformer form="ring" intensity={0.8} position={[0, 3, -8]} scale={4} />
      </Environment>
      <Grid
        infiniteGrid
        cellSize={0.25}
        sectionSize={1}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor={t.gridCell}
        sectionColor={t.gridSection}
        fadeDistance={22}
        fadeStrength={1.5}
        position={[0, -0.001, 0]}
      />
      <Selection>
        {/* stencilBuffer: the scene renders into this target, and the compare overlay's
            silhouette mask needs a stencil there (the canvas's own isn't used) */}
        <EffectComposer autoClear={false} multisampling={4} stencilBuffer>
          <Outline
            visibleEdgeColor={t.outline}
            hiddenEdgeColor={t.outlineHidden}
            edgeStrength={3.5}
            blur
            xRay
          />
        </EffectComposer>
        {children}
      </Selection>
      <CameraRig />
      <EngineClock />
      <HoverCursor />
    </>
  );
}

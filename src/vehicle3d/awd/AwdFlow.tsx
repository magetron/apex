/**
 * AWD explainer in 3D, around the zoomed-in centre diff / coupling: an arrow to each axle whose
 * thickness and dash speed follow the torque it gets right now, a miniature axle at each end
 * on its road surface (dark tarmac or pale ice), tyres that flare red and spin up when they
 * lose grip, and a glow on the device that brightens as it locks (red when it winds up in a
 * turn). Driven by the same model and conditions as the panels (spec/derive/awd.ts, ./store).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  MeshBasicMaterial,
  NormalBlending,
  ShaderMaterial,
  type Group,
  type Mesh,
} from 'three';
import { sysMat } from '../../scene/materials';
import { SYSTEM_COLORS } from '../../scene/palette';
import { useTheme, type Theme } from '../../scene/theme';
import { awdSystem, axleTorque, newAwdState, type AwdOptions } from '../../spec/derive/awd';
import type { PlacedPart, VehicleSpec } from '../../spec/types';
import { DEG, mmVec } from '../../spec/units';
import { G } from '../geom';
import { tyreMat } from '../materials';
import { Tag } from '../overlays/Tag';
import { AWD_WINDOW_S, awdElapsed, gripFront, gripRear, ICE_GRIP, useAwdExplainer } from './store';

/** Same validated front/rear pair as the panel (explorer/panels/awd.css). */
const AXLE_COLORS: Record<Theme, { front: string; rear: string }> = {
  dark: { front: '#3987e5', rear: '#d95926' },
  light: { front: '#2a78d6', rear: '#eb6834' },
};
const ROAD: Record<Theme, Color> = { dark: new Color('#2a3038'), light: new Color('#5b636d') };
const ICE = new Color('#cfeaff');
const SPIN = new Color(SYSTEM_COLORS.brake);
const GRIP = new Color(SYSTEM_COLORS['wheel-driven']);
const GLOW = new Color(SYSTEM_COLORS.coupling);

/** Arrow length from the device centre to each miniature axle (m), tyre size. */
const ARM = 0.52;
const TYRE_R = 0.1;
const TYRE_W = 0.05;
const HALF_TRACK = 0.2;
/** Wheel speed of the slowed-down car rolling along, and how much faster a spinning one turns. */
const ROLL = 3;
const SPIN_X = 5;

const cone = new ConeGeometry(1, 1, 18);

const vert = /* glsl */ `
  varying float vV;
  void main() {
    vV = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uBase;
  varying float vV;
  void main() {
    float d = fract(vV * 4.0 - uPhase);
    float dash = smoothstep(0.0, 0.12, d) * (1.0 - smoothstep(0.45, 0.62, d));
    gl_FragColor = vec4(uColor, uOpacity * (uBase + (1.0 - uBase) * dash));
    #include <colorspace_fragment>
  }
`;
const flowMat = () =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color() },
      uPhase: { value: 0 },
      uOpacity: { value: 0.95 },
      // the gaps between dashes: fainter on the dark ground, where the dashes glow
      uBase: { value: 0.35 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  });

interface ArmRefs {
  shaft: Mesh | null;
  head: Mesh | null;
  tyres: (Group | null)[];
  label: HTMLSpanElement | null;
  shown: number;
}

export function AwdFlow({ vehicle, part }: { vehicle: VehicleSpec; part: PlacedPart }) {
  const sys = useMemo(() => awdSystem(vehicle), [vehicle]);
  const theme = useTheme((s) => s.theme);
  const mats = useMemo(
    () => ({
      flow: [flowMat(), flowMat()],
      head: [new MeshBasicMaterial(), new MeshBasicMaterial()],
      road: [0, 1].map(
        () => new MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }),
      ),
      mark: [0, 1].map(() => new MeshBasicMaterial()),
      glow: new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const m of [...mats.flow, ...mats.head, ...mats.road, ...mats.mark, mats.glow])
        m.dispose();
    },
    [mats],
  );
  useEffect(() => {
    const c = AXLE_COLORS[theme];
    const blend = theme === 'dark' ? AdditiveBlending : NormalBlending;
    [c.front, c.rear].forEach((hex, i) => {
      mats.flow[i].uniforms.uColor.value.set(hex);
      mats.flow[i].blending = blend;
      mats.flow[i].uniforms.uBase.value = theme === 'dark' ? 0.35 : 0.65;
      mats.flow[i].needsUpdate = true;
      mats.head[i].color.set(hex);
    });
    mats.glow.blending = blend;
    mats.glow.needsUpdate = true;
  }, [theme, mats]);

  const arms = useMemo<ArmRefs[]>(
    () => [0, 1].map(() => ({ shaft: null, head: null, tyres: [], label: null, shown: NaN })),
    [],
  );
  const state = useMemo(() => ({ out: newAwdState(), opts: {} as AwdOptions }), []);

  useFrame((_, delta) => {
    if (!sys) return;
    const dt = Math.min(delta, 0.1);
    const ex = useAwdExplainer.getState();
    state.opts.turn = ex.turn;
    state.opts.locked = ex.locked;
    const t = ex.scrub ?? Math.min(AWD_WINDOW_S, awdElapsed(ex.since));
    const gF = gripFront(ex.ice);
    const gR = gripRear(ex.ice);
    const st = axleTorque(sys, gF, gR, t, state.opts, state.out);
    const road = ROAD[theme];
    for (let i = 0; i < 2; i++) {
      const a = arms[i];
      const share = i === 0 ? st.front : st.rear;
      const spinning = i === 0 ? st.spinFront : st.spinRear;
      const r = 0.008 + 0.024 * Math.sqrt(Math.min(1, Math.abs(share)));
      if (a.shaft) a.shaft.scale.set(r, a.shaft.scale.y, r);
      if (a.head) {
        a.head.scale.set(r * 2.2, 0.1, r * 2.2);
        // a dragged axle (wind-up) pushes back: the head turns round
        a.head.rotation.z = (i === 0 ? -1 : 1) * (share < 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      const u = mats.flow[i].uniforms;
      // dashes run toward the axle at a pace set by its torque, backwards when it is dragged
      u.uPhase.value = (u.uPhase.value + dt * 2.5 * share) % 1000;
      u.uOpacity.value = 0.35 + 0.6 * Math.min(1, Math.abs(share) * 1.6);
      mats.road[i].color.lerpColors(
        road,
        ICE,
        Math.min(1, (1 - (i === 0 ? gF : gR)) / (1 - ICE_GRIP)),
      );
      mats.mark[i].color.copy(spinning ? SPIN : GRIP);
      const omega = ROLL * (spinning ? SPIN_X : 1);
      for (const g of a.tyres) if (g) g.rotation.z -= omega * dt;
      const pct = Math.round(share * 100);
      if (a.label && pct !== a.shown) {
        a.label.textContent = `${pct}%`;
        a.shown = pct;
      }
    }
    mats.glow.color.copy(st.bind > 0.02 ? SPIN : GLOW);
    mats.glow.opacity = 0.05 + 0.2 * Math.max(st.lock, Math.min(1, st.bind * 3));
  });

  if (!sys) return null;
  const [l, h, w] = mmVec(part.sizeMm);
  return (
    <>
      {/* glow around the device, in its own frame */}
      <mesh
        geometry={G.sphere}
        material={mats.glow}
        scale={[l * 0.68, h * 0.68, w * 0.68]}
        raycast={() => null}
      />
      {/* the schematic, in the car's frame: +X forward */}
      <group rotation={[-part.rollDeg * DEG, 0, 0]}>
        <group rotation={[0, -part.yawDeg * DEG, 0]}>
          {([1, -1] as const).map((dir, i) => {
            const a = arms[i];
            const x0 = dir * 0.15;
            const x1 = dir * (ARM - 0.15);
            const len = Math.abs(x1 - x0);
            return (
              <group key={dir}>
                <mesh
                  ref={(m) => void (a.shaft = m)}
                  geometry={G.cyl}
                  material={mats.flow[i]}
                  position={[(x0 + x1) / 2, 0, 0]}
                  rotation={[0, 0, -dir * (Math.PI / 2)]}
                  scale={[0.02, len, 0.02]}
                  renderOrder={20}
                  raycast={() => null}
                />
                <mesh
                  ref={(m) => void (a.head = m)}
                  geometry={cone}
                  material={mats.head[i]}
                  position={[x1 + dir * 0.05, 0, 0]}
                  rotation={[0, 0, -dir * (Math.PI / 2)]}
                  raycast={() => null}
                />
                {/* the axle: shaft, two tyres with a rim mark that shows them turn */}
                <group position={[dir * ARM, 0, 0]}>
                  <mesh
                    geometry={G.cylLo}
                    material={sysMat('shaft', 'metal')}
                    rotation={[Math.PI / 2, 0, 0]}
                    scale={[0.01, HALF_TRACK * 2, 0.01]}
                    raycast={() => null}
                  />
                  {[-1, 1].map((side, k) => (
                    <group
                      key={side}
                      position={[0, 0, side * HALF_TRACK]}
                      ref={(g) => void (a.tyres[k] = g)}
                    >
                      <mesh
                        geometry={G.cyl}
                        material={tyreMat()}
                        rotation={[Math.PI / 2, 0, 0]}
                        scale={[TYRE_R, TYRE_W, TYRE_R]}
                        raycast={() => null}
                      />
                      <mesh
                        geometry={G.box}
                        material={mats.mark[i]}
                        position={[0, TYRE_R * 0.55, side * (TYRE_W / 2 + 0.002)]}
                        scale={[0.022, TYRE_R * 0.8, 0.004]}
                        raycast={() => null}
                      />
                    </group>
                  ))}
                  <mesh
                    geometry={G.box}
                    material={mats.road[i]}
                    position={[0, -TYRE_R - 0.004, 0]}
                    scale={[0.34, 0.006, HALF_TRACK * 2 + 0.22]}
                    raycast={() => null}
                  />
                </group>
                <Tag at={[(x0 + x1) / 2, 0.11, 0]}>
                  <span ref={(s) => void (a.label = s)} />
                  <small>{dir > 0 ? 'front' : 'rear'}</small>
                </Tag>
              </group>
            );
          })}
        </group>
      </group>
    </>
  );
}

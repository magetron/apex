/**
 * Torque-flow overlay: glowing dashes running from the crank (or motor) through gearbox,
 * shafts, couplings and diffs to the driven wheels. Tube thickness follows each branch's share
 * of the torque; the split is tagged where it happens. One draw call, animated by a uniform.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { AdditiveBlending, NormalBlending } from 'three';
import { engineRuntime } from '../scene/runtime';
import { useTheme } from '../scene/theme';
import type { PowertrainLayout, VehicleSpec } from '../spec/types';
import { mmVec } from '../spec/units';
import { Tag } from './overlays/Tag';
import { torqueFlow, type FlowSeg } from './torque';

const vert = /* glsl */ `
  attribute float aU;
  varying float vU;
  void main() {
    vU = aU;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying float vU;
  void main() {
    float d = fract(vU * 5.0 - uTime);
    float dash = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.42, 0.6, d));
    gl_FragColor = vec4(uColor, uOpacity * (0.18 + 0.82 * dash));
    #include <colorspace_fragment>
  }
`;

function makeMat(theme: 'dark' | 'light') {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(theme === 'dark' ? '#ffb347' : '#d9480f') },
      uTime: { value: 0 },
      uOpacity: { value: theme === 'dark' ? 0.95 : 0.85 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: theme === 'dark' ? AdditiveBlending : NormalBlending,
  });
}
const MATS = { dark: makeMat('dark'), light: makeMat('light') };

const UP = new Vector3(0, 1, 0);

/** One open tube per segment, merged, with the along-path distance as attribute aU (m). */
function flowGeometry(segs: FlowSeg[]): BufferGeometry {
  const radial = 10;
  const pos: number[] = [];
  const u: number[] = [];
  const idx: number[] = [];
  const q = new Quaternion();
  const a = new Vector3();
  const b = new Vector3();
  const d = new Vector3();
  const p = new Vector3();
  for (const s of segs) {
    a.set(...mmVec(s.a));
    b.set(...mmVec(s.b));
    d.copy(b).sub(a);
    const L = d.length();
    if (L < 1e-4) continue;
    q.setFromUnitVectors(UP, d.normalize());
    const r = 0.012 + 0.024 * Math.sqrt(s.share);
    const base = pos.length / 3;
    for (let end = 0; end < 2; end++) {
      for (let k = 0; k < radial; k++) {
        const th = (k / radial) * Math.PI * 2;
        p.set(Math.cos(th) * r, end * L, Math.sin(th) * r)
          .applyQuaternion(q)
          .add(a);
        pos.push(p.x, p.y, p.z);
        u.push(s.d0 / 1000 + end * L);
      }
    }
    for (let k = 0; k < radial; k++) {
      const k2 = (k + 1) % radial;
      idx.push(
        base + k,
        base + radial + k,
        base + k2,
        base + k2,
        base + radial + k,
        base + radial + k2,
      );
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new Float32BufferAttribute(u, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function TorqueFlowOverlay({
  vehicle,
  layout,
}: {
  vehicle: VehicleSpec;
  layout: PowertrainLayout;
}) {
  const theme = useTheme((s) => s.theme);
  const flow = useMemo(() => torqueFlow(vehicle, layout), [vehicle, layout]);
  const geo = useMemo(() => flowGeometry(flow.segs), [flow]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = MATS[theme];
  useFrame((_, dt) => {
    // dashes run faster with engine speed, but stay readable
    const speed = 0.6 + Math.min(2, engineRuntime.rpm / 3000);
    mat.uniforms.uTime.value = (mat.uniforms.uTime.value + Math.min(dt, 0.1) * speed) % 1000;
  });
  return (
    <>
      <mesh geometry={geo} material={mat} renderOrder={20} />
      {flow.axles.map((a) => {
        const at = mmVec(a.at);
        return (
          <Tag key={a.axle} at={[at[0], at[1] + 0.22, at[2]]} tone="flow">
            {Math.round(a.share * 100)}%<small>{a.axle}</small>
          </Tag>
        );
      })}
    </>
  );
}

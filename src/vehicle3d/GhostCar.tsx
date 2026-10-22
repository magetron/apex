/**
 * <GhostCar vehicle color />: another car drawn as a crisp outline over the one on show, to
 * compare them in place: its silhouette and feature lines (creases, windows) in its own colour,
 * its engine, gearbox, motors and battery as dashed boxes in the system colours, and its centre
 * of gravity. Lines only, no fill: the car on show looks exactly as it does alone. The outline
 * draws over it (painted or x-ray) but hides its own far side. Vehicle frame (front axle at the
 * origin); the caller places it.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { SYSTEM_COLORS } from '../scene/palette';
import { layoutPowertrain } from '../spec/derive/layout';
import { massProps } from '../spec/derive/mass';
import type { PlacedPart, VehicleSpec } from '../spec/types';
import { DEG, mm, mmVec } from '../spec/units';
import { Detailed } from './gltf/Fallback';
import { markReady, useCarModel } from './gltf/load';
import { gltfUrl } from './gltf/manifest';
import { SYSTEM_OF } from './Drivetrain';
import { carOutline, type CarOutline } from './outline';

const ORDER = 20;

/** silhouette width, as a share of the distance to the camera (~2 px at the explorer's framing) */
const HULL_WIDTH = 0.0022;

const hullVert = /* glsl */ `
  uniform float uWidth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // pushed out along the normal by a constant on-screen width
    mv.xyz += normalize(normalMatrix * normal) * uWidth * -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const hullFrag = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`;

interface OutlineMats {
  hull: ShaderMaterial;
  lines: LineBasicMaterial;
}

/**
 * Per colour, shared: the silhouette (an inverted hull: the shell's back faces pushed out, seen
 * only where they stick out past its front) and the feature lines.
 */
const outlineMats = new Map<string, OutlineMats>();
function outlineMat(color: string): OutlineMats {
  let m = outlineMats.get(color);
  if (!m) {
    m = {
      hull: new ShaderMaterial({
        uniforms: { uColor: { value: new Color(color) }, uWidth: { value: HULL_WIDTH } },
        vertexShader: hullVert,
        fragmentShader: hullFrag,
        side: BackSide,
        transparent: true,
        depthWrite: false,
      }),
      lines: new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
    };
    outlineMats.set(color, m);
  }
  return m;
}

const dashes = new Map<string, LineDashedMaterial>();
function dashMat(color: string): LineDashedMaterial {
  let m = dashes.get(color);
  if (!m) {
    m = new LineDashedMaterial({
      color,
      dashSize: 0.06,
      gapSize: 0.04,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    dashes.set(color, m);
  }
  return m;
}

/**
 * Writes only depth (in the transparent pass, after the main car), a hair behind the surface:
 * the outline's own front, so its far side and inner lines stay hidden while the lines on the
 * near surface still pass.
 */
const prepass = new MeshBasicMaterial({
  colorWrite: false,
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
});
const nothing = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true });

/**
 * Clears the depth buffer just before the outlines draw: they show over the main car, painted or
 * not, yet hide their own far side (the prepass above). Everything drawn after them ignores
 * depth anyway (the dashed blocks and the CG).
 */
function DepthReset() {
  const mesh = useMemo(() => {
    const m = new Mesh(new PlaneGeometry(0, 0), nothing);
    m.renderOrder = ORDER - 1;
    m.frustumCulled = false;
    m.onBeforeRender = (renderer) => renderer.clearDepth();
    return m;
  }, []);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

/** a unit circle in the XY plane: a wheel's side, scaled to its tyre */
const ring = new BufferGeometry().setFromPoints(
  Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new Vector3(Math.cos(a), Math.sin(a), 0);
  }),
);

/** The wheels as the spec has them: both sides of each tyre, a ring each. */
function Wheels({ wheels, material }: { wheels: PlacedPart[]; material: LineBasicMaterial }) {
  return (
    <>
      {wheels.flatMap((p) => {
        const [x, y, z] = mmVec(p.posMm);
        const r = mm(p.sizeMm[0] / 2);
        const w = mm(p.sizeMm[2]);
        return [-1, 1].map((s) => (
          <lineLoop
            key={`${p.id}${s}`}
            geometry={ring}
            material={material}
            position={[x, y, z + (s * w) / 2]}
            scale={[r, r, 1]}
            renderOrder={ORDER + 1}
          />
        ));
      })}
    </>
  );
}

/**
 * The detailed model's outline: silhouette and feature lines (built once per model), and its
 * wheels as rings.
 */
function Outline({ id, color, wheels }: { id: string; color: string; wheels: PlacedPart[] }) {
  const model = useCarModel(id);
  const [outline, setOutline] = useState<CarOutline | null>(null);
  useEffect(() => {
    let live = true;
    void carOutline(model).then((o) => live && setOutline(o));
    return () => {
      live = false;
    };
  }, [model]);
  const mats = outlineMat(color);
  useEffect(() => markReady(gltfUrl(id)!), [id]);
  if (!outline) return null;
  const { shell, edges } = outline;
  return (
    <>
      <DepthReset />
      <mesh geometry={shell} material={prepass} renderOrder={ORDER} />
      <mesh geometry={shell} material={mats.hull} renderOrder={ORDER + 1} />
      <lineSegments geometry={edges} material={mats.lines} renderOrder={ORDER + 1} />
      <Wheels wheels={wheels} material={mats.lines} />
    </>
  );
}

/** The part's box as dashed edges, placed and turned like the layout places the part. */
function Block({ p }: { p: PlacedPart }) {
  const lines = useMemo(() => {
    const [l, h, w] = mmVec(p.sizeMm);
    const box = new BoxGeometry(l, h, w);
    const seg = new LineSegments(new EdgesGeometry(box), dashMat(SYSTEM_COLORS[SYSTEM_OF[p.kind]]));
    box.dispose();
    seg.computeLineDistances();
    seg.renderOrder = ORDER + 2;
    seg.position.set(...mmVec(p.boxOffsetMm ?? [0, 0, 0]));
    return seg;
  }, [p]);
  useEffect(() => () => lines.geometry.dispose(), [lines]);
  return (
    <group position={mmVec(p.posMm)} rotation={[p.rollDeg * DEG, p.yawDeg * DEG, 0, 'YXZ']}>
      <primitive object={lines} />
    </group>
  );
}

const BLOCKS = new Set<PlacedPart['kind']>(['engine', 'gearbox', 'motor', 'battery']);

/** Its centre of gravity: a ring in the car's colour and a dashed drop to the ground. */
function Cg({ v, color }: { v: VehicleSpec; color: string }) {
  const at = useMemo(() => {
    try {
      return mmVec(massProps(v).cgMm);
    } catch {
      return null;
    }
  }, [v]);
  const drop = useMemo(() => {
    if (!at) return null;
    const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, at[1], 0)]);
    const seg = new LineSegments(geo, dashMat(color));
    seg.computeLineDistances();
    seg.position.set(at[0], 0, at[2]);
    seg.renderOrder = ORDER + 2;
    return seg;
  }, [at, color]);
  useEffect(() => () => drop?.geometry.dispose(), [drop]);
  if (!at || !drop) return null;
  return (
    <>
      <mesh position={at} renderOrder={ORDER + 3}>
        <torusGeometry args={[0.07, 0.014, 8, 32]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} transparent />
      </mesh>
      <primitive object={drop} />
    </>
  );
}

export function GhostCar({ vehicle, color }: { vehicle: VehicleSpec; color: string }) {
  const layout = useMemo(() => layoutPowertrain(vehicle), [vehicle]);
  const url = gltfUrl(vehicle.id);
  return (
    <group>
      {url && (
        <Detailed url={url}>
          <Outline
            id={vehicle.id}
            color={color}
            wheels={layout.parts.filter((p) => p.kind === 'wheel')}
          />
        </Detailed>
      )}
      {layout.parts
        .filter((p) => BLOCKS.has(p.kind))
        .map((p) => (
          <Block key={p.id} p={p} />
        ))}
      <Cg v={vehicle} color={color} />
    </group>
  );
}

/**
 * <GhostCar vehicle color />: another car drawn as an outline over the one on show, to compare
 * them in place: just its silhouette and its wheels in its own colour, its engine (or motors) as
 * a dashed box in the system colour, its driven axles as a line across in the driven wheels'
 * colour, and its centre of gravity. Lines only, no fill: the car on show looks exactly as it does
 * alone. The outline draws over it (painted or x-ray) but only round the outside: each ghost's
 * shell marks its own stencil bit, and its outline draws only off that mark, so no door, window
 * or seat edge inside it shows. Vehicle frame (front axle at the origin); the caller places it.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import {
  AlwaysStencilFunc,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  PlaneGeometry,
  ReplaceStencilOp,
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
 * How many outlines have been built. A worker builds each one after the model has loaded (the
 * model's load state is ready before it), so whoever frames the ghosts frames again on a change.
 */
export const useGhostOutlines = create<{ built: number }>(() => ({ built: 0 }));

/** each compared car's own stencil bit (the slot: its place in the comparison), so one ghost's
 *  mark never hides another's outline */
const bitOf = (slot: number) => 1 << (slot & 7);

/**
 * Per colour and slot, shared: the silhouette (an inverted hull: the shell's back faces pushed
 * out, drawn only off the shell's own stencil mark, so only past its outer edge) and the wheel
 * lines.
 */
const outlineMats = new Map<string, OutlineMats>();
function outlineMat(color: string, slot: number): OutlineMats {
  const key = `${color}|${slot}`;
  let m = outlineMats.get(key);
  if (!m) {
    const bit = bitOf(slot);
    m = {
      hull: new ShaderMaterial({
        uniforms: { uColor: { value: new Color(color) }, uWidth: { value: HULL_WIDTH } },
        vertexShader: hullVert,
        fragmentShader: hullFrag,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        // three turns the stencil test on for this material only (stencilWrite), writing nothing
        stencilWrite: true,
        stencilWriteMask: 0,
        stencilFunc: NotEqualStencilFunc,
        stencilRef: bit,
        stencilFuncMask: bit,
      }),
      lines: new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
    };
    outlineMats.set(key, m);
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
 * Writes no colour (in the transparent pass, after the main car): depth a hair behind the
 * surface, so the wheel rings' far side stays hidden, and the car's stencil bit wherever the
 * shell covers, the mask its outline keeps off. Only materials with stencilWrite test the
 * stencil, so the bits left set change nothing drawn later (the frame clears them).
 */
const prepasses = new Map<number, MeshBasicMaterial>();
function prepassMat(slot: number): MeshBasicMaterial {
  let m = prepasses.get(slot);
  if (!m) {
    const bit = bitOf(slot);
    m = new MeshBasicMaterial({
      colorWrite: false,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
      stencilWrite: true,
      stencilWriteMask: bit,
      stencilRef: bit,
      stencilFunc: AlwaysStencilFunc,
      // the whole shell, its hidden far side too
      stencilFail: ReplaceStencilOp,
      stencilZFail: ReplaceStencilOp,
      stencilZPass: ReplaceStencilOp,
    });
    prepasses.set(slot, m);
  }
  return m;
}

/** The same mark, no depth: over each wheel, whose well is a hole in the shell (the wheels are
 *  left out of it) that outlined its arch liners and struts as blobs */
const wheelMasks = new Map<number, MeshBasicMaterial>();
function wheelMaskMat(slot: number): MeshBasicMaterial {
  let m = wheelMasks.get(slot);
  if (!m) {
    m = prepassMat(slot).clone();
    m.depthTest = false;
    m.depthWrite = false;
    m.polygonOffset = false;
    wheelMasks.set(slot, m);
  }
  return m;
}

/** a wheel's drum: unit radius and width, its axis across the car (Z) */
const drum = new CylinderGeometry(1, 1, 1, 32).rotateX(Math.PI / 2);
const nothing = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true });

/**
 * Clears the depth buffer just before the outlines draw: they show over the main car, painted or
 * not, yet hide their own far side (the prepass above). Everything drawn after them ignores
 * depth anyway (the dashed blocks and the CG). The stencil too: the masks start empty each frame
 * whoever renders it (nothing else draws with a stencil).
 */
function DepthReset() {
  const mesh = useMemo(() => {
    const m = new Mesh(new PlaneGeometry(0, 0), nothing);
    m.renderOrder = ORDER - 1;
    m.frustumCulled = false;
    m.onBeforeRender = (renderer) => {
      renderer.clearDepth();
      renderer.clearStencil();
    };
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
 * The detailed model's outline: its silhouette (built once per model) and its wheels as rings.
 */
function Outline({
  id,
  color,
  slot,
  wheels,
}: {
  id: string;
  color: string;
  slot: number;
  wheels: PlacedPart[];
}) {
  const model = useCarModel(id);
  const [outline, setOutline] = useState<CarOutline | null>(null);
  useEffect(() => {
    let live = true;
    void carOutline(model).then((o) => {
      if (!live) return;
      setOutline(o);
      useGhostOutlines.setState((s) => ({ built: s.built + 1 }));
    });
    return () => {
      live = false;
    };
  }, [model]);
  const mats = outlineMat(color, slot);
  useEffect(() => markReady(gltfUrl(id)!), [id]);
  if (!outline) return null;
  // the silhouette alone: its creases (doors, lamps, seats) made a busy wireframe of the car
  const { shell } = outline;
  return (
    <>
      <DepthReset />
      <mesh geometry={shell} material={prepassMat(slot)} renderOrder={ORDER} />
      {wheels.map((p) => {
        const r = mm(p.sizeMm[0] / 2);
        return (
          <mesh
            key={p.id}
            geometry={drum}
            material={wheelMaskMat(slot)}
            position={mmVec(p.posMm)}
            scale={[r, r, mm(p.sizeMm[2])]}
            renderOrder={ORDER}
          />
        );
      })}
      <mesh geometry={shell} material={mats.hull} renderOrder={ORDER + 1} />
      <Wheels wheels={wheels} material={mats.lines} />
    </>
  );
}

/** Each driven axle as a line across, wheel to wheel, in the driven wheels' colour. */
function DrivenAxles({ wheels }: { wheels: PlacedPart[] }) {
  const geo = useMemo(() => {
    const pts: Vector3[] = [];
    for (const axle of ['front', 'rear'] as const) {
      const pair = wheels.filter((p) => p.axle === axle && p.driven);
      if (pair.length === 2) pts.push(...pair.map((p) => new Vector3(...mmVec(p.posMm))));
    }
    return new BufferGeometry().setFromPoints(pts);
  }, [wheels]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <lineSegments geometry={geo} material={axleMat} renderOrder={ORDER + 2} />;
}

const axleMat = new LineBasicMaterial({
  color: SYSTEM_COLORS['wheel-driven'],
  transparent: true,
  depthTest: false,
  depthWrite: false,
});

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

// the engine (or motors) only: what the comparison is about
const BLOCKS = new Set<PlacedPart['kind']>(['engine', 'motor']);

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

export function GhostCar({
  vehicle,
  color,
  slot = 0,
}: {
  vehicle: VehicleSpec;
  color: string;
  /** its place among the ghosts (0, 1, 2): its own stencil bit */
  slot?: number;
}) {
  const layout = useMemo(() => layoutPowertrain(vehicle), [vehicle]);
  const url = gltfUrl(vehicle.id);
  return (
    <group>
      {url && (
        <Detailed url={url}>
          <Outline
            id={vehicle.id}
            color={color}
            slot={slot}
            wheels={layout.parts.filter((p) => p.kind === 'wheel')}
          />
        </Detailed>
      )}
      {layout.parts
        .filter((p) => BLOCKS.has(p.kind))
        .map((p) => (
          <Block key={p.id} p={p} />
        ))}
      <DrivenAxles wheels={layout.parts.filter((p) => p.kind === 'wheel')} />
      <Cg v={vehicle} color={color} />
    </group>
  );
}

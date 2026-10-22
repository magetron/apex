/** Wheel: tyre (lathed section), five-spoke rim, brake disc and caliper. Axle along local Z. */
import { useMemo, useRef } from 'react';
import { ExtrudeGeometry, LatheGeometry, Path, Shape, Vector2, type Group } from 'three';
import { sysMat } from '../scene/materials';
import { G } from './geom';
import { discMat, drivenMat, rimMat, trimMat, tyreMat } from './materials';
import { useSpin } from './spin';

const tyres = new Map<string, LatheGeometry>();
function tyreGeo(R: number, w: number, rimR: number): LatheGeometry {
  const key = `${R.toFixed(3)}|${w.toFixed(3)}|${rimR.toFixed(3)}`;
  let g = tyres.get(key);
  if (!g) {
    const h = w / 2;
    const sh = Math.min(0.03, (R - rimR) * 0.35);
    // [radius, along-axle] — lathe sweeps around +Y, rotated onto Z by the caller
    const prof: [number, number][] = [
      [rimR, -h * 0.9],
      [rimR + (R - rimR) * 0.45, -h],
      [R - sh, -h * 0.97],
      [R - sh * 0.2, -h * 0.75],
      [R, -h * 0.45],
      [R, h * 0.45],
      [R - sh * 0.2, h * 0.75],
      [R - sh, h * 0.97],
      [rimR + (R - rimR) * 0.45, h],
      [rimR, h * 0.9],
    ];
    g = new LatheGeometry(
      prof.map(([r, y]) => new Vector2(r, y)),
      48,
    );
    tyres.set(key, g);
  }
  return g;
}

const faces = new Map<string, ExtrudeGeometry>();
function rimFace(r: number, spokes: number): ExtrudeGeometry {
  const key = `${r.toFixed(3)}|${spokes}`;
  let g = faces.get(key);
  if (!g) {
    const s = new Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    const inner = r * 0.86;
    const hub = r * 0.26;
    const gap = (Math.PI * 2) / spokes;
    const spokeHalf = gap * 0.17;
    for (let k = 0; k < spokes; k++) {
      const a0 = k * gap + spokeHalf;
      const a1 = (k + 1) * gap - spokeHalf;
      const hole = new Path();
      hole.moveTo(Math.cos(a0) * hub * 1.25, Math.sin(a0) * hub * 1.25);
      hole.absarc(0, 0, inner, a0 + 0.06, a1 - 0.06, false);
      hole.lineTo(Math.cos(a1) * hub * 1.25, Math.sin(a1) * hub * 1.25);
      hole.absarc(0, 0, hub * 1.25, a1, a0, true);
      s.holes.push(hole);
    }
    g = new ExtrudeGeometry(s, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      bevelSegments: 1,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.009);
    faces.set(key, g);
  }
  return g;
}

export interface WheelProps {
  /** tyre radius, width (m) */
  R: number;
  w: number;
  rimR: number;
  /** +1 right side (rim face toward +Z), −1 left */
  side: number;
  driven: boolean;
  xray: boolean;
  /** brake caliper at the front or rear of the disc */
  caliperAft: boolean;
  spin: boolean;
  dark?: boolean;
}

export function Wheel({ R, w, rimR, side, driven, xray, caliperAft, spin, dark }: WheelProps) {
  const rot = useRef<Group>(null);
  useSpin(rot, 'z', spin ? 'half' : 'road', -side);
  const tyre = useMemo(() => tyreGeo(R, w, rimR), [R, w, rimR]);
  const face = rimFace(rimR * 0.98, 5);
  const tyreM = xray ? (driven ? drivenMat() : sysMat('wheel', 'rubber')) : tyreMat();
  const rimM = xray ? sysMat('chassis', 'metal') : rimMat(dark);
  const discR = rimR * 0.82;
  return (
    <group scale={[1, 1, side]}>
      <group ref={rot}>
        <mesh geometry={tyre} material={tyreM} rotation={[Math.PI / 2, 0, 0]} castShadow />
        {/* rim barrel (open), dark well behind the spokes, spoked face toward the outside */}
        <mesh
          geometry={G.tube}
          material={rimM}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[rimR, w * 0.86, rimR]}
        />
        <mesh
          geometry={G.cylLo}
          material={trimMat()}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, w * 0.12]}
          scale={[rimR * 0.97, 0.01, rimR * 0.97]}
        />
        <mesh geometry={face} material={rimM} position={[0, 0, w * 0.36]} />
        <mesh
          geometry={G.cylLo}
          material={rimM}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, w * 0.38]}
          scale={[rimR * 0.2, 0.03, rimR * 0.2]}
        />
        <mesh
          geometry={G.cyl}
          material={xray ? sysMat('brake', 'metal') : discMat()}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, w * 0.06]}
          scale={[discR, 0.028, discR]}
        />
      </group>
      <mesh
        geometry={G.box}
        material={sysMat('brake', 'satin')}
        position={[(caliperAft ? -1 : 1) * discR * 0.72, discR * 0.5, w * 0.06]}
        rotation={[0, 0, (caliperAft ? 1 : -1) * 0.6]}
        scale={[discR * 0.32, discR * 0.55, 0.075]}
      />
    </group>
  );
}

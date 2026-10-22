/**
 * Drivetrain components as placed by layoutPowertrain(): gearbox, diffs, coupling, motors,
 * battery, fuel tank (a saddle over the tunnel) and shafts. Each renders in its part's local
 * frame (local +X = the part's own axis; gearbox input/bell at +X). Zoomed in (level 'part'), a
 * component's own case ghosts and its insides separate on the explode slider.
 */
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { Assembly } from '../scene/Assembly';
import { ghostMat, sysMat } from '../scene/materials';
import type { System } from '../scene/palette';
import { Part } from '../scene/Part';
import type { PlacedPart, Shaft, Vec3 } from '../spec/types';
import { mmVec } from '../spec/units';
import { cvBoot, G, span } from './geom';
import { hitMat } from './materials';
import { tankSaddle } from './packaging';
import { useSpin } from './spin';

export const SYSTEM_OF: Record<PlacedPart['kind'], System> = {
  engine: 'engine',
  gearbox: 'gearbox',
  diff: 'diff',
  coupling: 'coupling',
  motor: 'motor',
  battery: 'battery',
  'fuel-tank': 'fuel',
  wheel: 'wheel',
};

/** Invisible click envelope over a part's box (renders nothing, still raycast). */
export function HitBox({ p, pad = 1.08 }: { p: PlacedPart; pad?: number }) {
  const [l, h, w] = mmVec(p.sizeMm);
  return (
    <mesh
      position={mmVec(p.boxOffsetMm ?? [0, 0, 0])}
      geometry={G.box}
      material={hitMat()}
      scale={[l * pad, h * pad, w * pad]}
    />
  );
}

interface CompProps {
  p: PlacedPart;
  /** zoomed into this component: ghost the case, follow the explode slider */
  open: boolean;
}

const caseMat = (system: System, open: boolean) =>
  open ? ghostMat(system, 0.5) : sysMat(system, 'satin');

function Gearbox({ p, open, kind }: CompProps & { kind: string }) {
  const [l, h, w] = mmVec(p.sizeMm);
  const m = caseMat('gearbox', open);
  const gears = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => ({
      x: -l * 0.32 + (i * l * 0.64) / (n - 1),
      r1: h * (0.12 + 0.04 * i),
      r2: h * (0.3 - 0.04 * i),
    }));
  }, [l, h]);
  return (
    <Assembly stages={2} explode={open ? undefined : 0}>
      <Part
        id={`${p.id}/case`}
        system="gearbox"
        label="Gearbox case"
        explode={{ dir: [0, 1, 0], dist: 0.35, stage: 0 }}
      >
        {kind === 'inline' ? (
          <group rotation={[0, 0, Math.PI / 2]}>
            <mesh
              geometry={G.cyl}
              material={m}
              position={[0, l * 0.36, 0]}
              scale={[h * 0.5, l * 0.28, h * 0.5]}
              castShadow
            />
            <mesh
              geometry={G.cyl}
              material={m}
              position={[0, l * 0.02, 0]}
              scale={[h * 0.38, l * 0.42, h * 0.38]}
              castShadow
            />
            <mesh
              geometry={G.cyl}
              material={m}
              position={[0, -l * 0.37, 0]}
              scale={[h * 0.22, l * 0.26, h * 0.22]}
              castShadow
            />
          </group>
        ) : (
          <>
            <mesh
              geometry={G.box}
              material={m}
              position={[-l * 0.08, 0, 0]}
              scale={[l * 0.84, h * 0.92, w * 0.9]}
              castShadow
            />
            <mesh
              geometry={G.cyl}
              material={m}
              position={[l * 0.38, h * 0.05, 0]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[Math.min(h, w) * 0.5, l * 0.24, Math.min(h, w) * 0.5]}
              castShadow
            />
          </>
        )}
      </Part>
      <Part
        id={`${p.id}/gears`}
        system="gearbox"
        label="Gear pairs"
        explode={{ dir: [0, -1, 0], dist: 0.15, stage: 1 }}
      >
        <group visible={open}>
          {gears.map((g, i) => (
            <group key={i} position={[g.x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh
                geometry={G.cyl}
                material={sysMat('gearbox', 'metal')}
                position={[0, 0, h * 0.18]}
                scale={[g.r1, l * 0.07, g.r1]}
              />
              <mesh
                geometry={G.cyl}
                material={sysMat('shaft', 'metal')}
                position={[0, 0, -h * 0.18]}
                scale={[g.r2 * 0.55, l * 0.07, g.r2 * 0.55]}
              />
            </group>
          ))}
        </group>
      </Part>
    </Assembly>
  );
}

function Diff({ p, open }: CompProps) {
  const [l, , w] = mmVec(p.sizeMm);
  const inBox = p.kg === 0;
  const r = Math.min(l, w) * (inBox ? 0.3 : 0.42);
  // the pinion points at the prop shaft: aft for a front diff, forward for a rear one
  const nose = p.axle === 'front' ? -1 : 1;
  return (
    <Assembly stages={2} explode={open ? undefined : 0}>
      <Part
        id={`${p.id}/case`}
        system="diff"
        label="Diff housing"
        explode={{ dir: [0, 1, 0], dist: 0.25, stage: 0 }}
      >
        <mesh
          geometry={G.sphere}
          material={caseMat('diff', open)}
          scale={[r, r, r * 1.05]}
          castShadow
        />
        {!inBox && (
          <mesh
            geometry={G.cyl}
            material={caseMat('diff', open)}
            position={[nose * r * 1.05, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[r * 0.38, r * 0.9, r * 0.38]}
          />
        )}
      </Part>
      <Part
        id={`${p.id}/gears`}
        system="diff"
        label="Crown wheel & spider gears"
        explode={{ dir: [0, -1, 0], dist: 0.12, stage: 1 }}
      >
        <group visible={open}>
          <mesh
            geometry={G.torus}
            material={sysMat('diff', 'metal')}
            position={[0, 0, r * 0.4]}
            scale={[r * 0.8, r * 0.8, r * 2]}
          />
          <mesh
            geometry={G.cyl}
            material={sysMat('diff', 'metal')}
            position={[0, r * 0.35, 0]}
            scale={[r * 0.22, r * 0.2, r * 0.22]}
          />
          <mesh
            geometry={G.cyl}
            material={sysMat('diff', 'metal')}
            position={[0, -r * 0.35, 0]}
            scale={[r * 0.22, r * 0.2, r * 0.22]}
          />
          <mesh
            geometry={G.cyl}
            material={sysMat('shaft', 'metal')}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[r * 0.12, r * 2.1, r * 0.12]}
          />
        </group>
      </Part>
    </Assembly>
  );
}

function Coupling({ p, open }: CompProps) {
  const [l, h] = mmVec(p.sizeMm);
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh
        geometry={G.cyl}
        material={caseMat('coupling', open)}
        scale={[h * 0.48, l, h * 0.48]}
        castShadow
      />
      {open &&
        [-0.3, -0.15, 0, 0.15, 0.3].map((t) => (
          <mesh
            key={t}
            geometry={G.cyl}
            material={sysMat('coupling', 'metal')}
            position={[0, l * t, 0]}
            scale={[h * 0.4, l * 0.04, h * 0.4]}
          />
        ))}
    </group>
  );
}

function Battery({ p, open }: CompProps) {
  const [l, h, w] = mmVec(p.sizeMm);
  const modules = useMemo(() => {
    const nx = Math.max(2, Math.round(l / 0.42));
    const nz = 2;
    const out: Vec3[] = [];
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++)
        out.push([-l / 2 + ((i + 0.5) * l) / nx, h * 0.1, -w / 2 + ((k + 0.5) * w) / nz]);
    return { list: out, size: [(l / nx) * 0.9, h * 0.62, (w / nz) * 0.92] as Vec3 };
  }, [l, h, w]);
  return (
    <Assembly stages={2} explode={open ? undefined : 0}>
      <Part
        id={`${p.id}/lid`}
        system="battery"
        label="Pack lid"
        explode={{ dir: [0, 1, 0], dist: 0.35, stage: 0 }}
      >
        <mesh
          geometry={G.box}
          material={open ? ghostMat('battery', 0.45) : sysMat('battery', 'satin')}
          position={[0, h * 0.44, 0]}
          scale={[l, h * 0.12, w]}
          castShadow
        />
      </Part>
      <Part
        id={`${p.id}/modules`}
        system="battery"
        label="Cell modules"
        explode={{ dir: [0, 1, 0], dist: 0.18, stage: 1 }}
      >
        {modules.list.map((pos, i) => (
          <mesh
            key={i}
            geometry={G.box}
            material={sysMat('battery', i % 2 ? 'satin' : 'metal')}
            position={pos}
            scale={modules.size}
          />
        ))}
      </Part>
      <Part id={`${p.id}/tray`} system="chassis" label="Tray">
        <mesh
          geometry={G.box}
          material={sysMat('chassis', 'metal')}
          position={[0, -h * 0.4, 0]}
          scale={[l * 1.01, h * 0.2, w * 1.01]}
        />
      </Part>
    </Assembly>
  );
}

function FuelTank({ p }: CompProps) {
  // a saddle tank: two lobes joined by a bridge over the channel the prop shaft and pipes use
  const parts = useMemo(() => tankSaddle(p.sizeMm), [p.sizeMm]);
  const [, h, w] = mmVec(p.sizeMm);
  return (
    <>
      {parts.map((b, i) => (
        <mesh
          key={i}
          geometry={G.box}
          material={sysMat('fuel', 'satin')}
          position={mmVec(b.center)}
          scale={mmVec(b.size)}
          castShadow
        />
      ))}
      <mesh
        geometry={G.cylLo}
        material={sysMat('fuel', 'metal')}
        position={[0, h * 0.5, w * 0.42]}
        rotation={[0.9, 0, 0]}
        scale={[0.025, Math.min(h, 0.24) * 0.9, 0.025]}
      />
    </>
  );
}

export function Component({ p, open, gearbox }: CompProps & { gearbox?: string }) {
  switch (p.kind) {
    case 'gearbox':
      return <Gearbox p={p} open={open} kind={gearbox === 'inline' ? 'inline' : 'box'} />;
    case 'diff':
      return <Diff p={p} open={open} />;
    case 'coupling':
      return <Coupling p={p} open={open} />;
    case 'battery':
      return <Battery p={p} open={open} />;
    case 'fuel-tank':
      return <FuelTank p={p} open={open} />;
    default:
      return null;
  }
}

/** A shaft between two points: tube + joints; spins at prop or half-shaft speed. */
export function ShaftPart({ s, hit }: { s: Shaft; hit: boolean }) {
  const { position, quaternion, length } = useMemo(() => span(mmVec(s.fromMm), mmVec(s.toMm)), [s]);
  const spin = useRef<Group>(null);
  useSpin(spin, 'y', s.kind === 'prop' ? 'prop' : 'half');
  const r = s.kind === 'prop' ? 0.03 : 0.017;
  const joint = s.kind === 'prop' ? 0.045 : 0.04;
  return (
    <Part id={s.id} system="shaft" label={s.label} explode={{ dist: 0.3, stage: 2 }} morph={false}>
      <group position={position} quaternion={quaternion}>
        <group ref={spin}>
          <mesh
            geometry={G.cyl}
            material={sysMat('shaft', 'metal')}
            scale={[r, length, r]}
            castShadow
          />
          {s.kind === 'prop'
            ? [-0.5, 0.5].map((t) => (
                <group key={t} position={[0, t * length, 0]}>
                  <mesh
                    geometry={G.cylLo}
                    material={sysMat('chassis', 'metal')}
                    rotation={[0, 0, Math.PI / 2]}
                    scale={[0.014, joint * 2, 0.014]}
                  />
                  <mesh
                    geometry={G.cylLo}
                    material={sysMat('chassis', 'metal')}
                    rotation={[Math.PI / 2, 0, 0]}
                    scale={[0.014, joint * 2, 0.014]}
                  />
                </group>
              ))
            : [-1, 1].map((t) => (
                <mesh
                  key={t}
                  geometry={cvBoot}
                  material={sysMat('chassis', 'rubber')}
                  position={[0, t * (length / 2 - 0.045), 0]}
                  rotation={[t < 0 ? Math.PI : 0, 0, 0]}
                  scale={[joint, 0.09, joint]}
                />
              ))}
        </group>
        {s.kind === 'prop' && length > 1.1 && (
          <mesh geometry={G.box} material={sysMat('chassis', 'satin')} scale={[0.09, 0.05, 0.09]} />
        )}
        {hit && <mesh geometry={G.cylLo} material={hitMat()} scale={[0.07, length, 0.07]} />}
      </group>
    </Part>
  );
}

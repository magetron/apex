/**
 * <MotorModel>: an EV drive unit — stator with copper windings, rotor (magnets or a squirrel
 * cage), inverter, two-stage reduction and the differential — explodable and turning.
 * Frame: origin at the drive unit's box centre, +X along the output (half-shaft) axis, metres;
 * the size is the spec's lengthMm × diameterMm × diameterMm, as layoutPowertrain() places it.
 *
 * The rotor follows vehiclePose.wheelSpin × reduction in drive mode, otherwise `rpm` (default
 * 3000) slowed by engineRuntime.timeScale like the engine. Gears turn at their tooth ratios.
 * Explode: 0 housing, inverter, gear case · 1 gears, diff · 2 rotor slides out.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Object3D } from 'three';
import { Assembly } from '../scene/Assembly';
import { ghostMat, sysMat } from '../scene/materials';
import { Part } from './labelGate';
import { engineRuntime, vehiclePose } from '../scene/runtime';
import { relatedToFocus, useScene } from '../scene/store';
import type { MotorSpec, Vec3 } from '../spec/types';
import type { Lod } from './geometry';
import { buildMotorGeometry, disposeMotorGeometry } from './motorGeometry';
import { gearAngles } from './motorLayout';
import { MM } from './prims';

export interface MotorModelProps {
  spec: MotorSpec;
  /** id prefix for sub-parts, e.g. the layout id "motor-rear" */
  idPrefix?: string;
  /** fixed explode (e.g. 0 inside a car); default follows the global slider */
  explode?: number;
  lod?: Lod;
  /** rotor speed when not driving (rpm) */
  rpm?: number;
}

export const MOTOR_STAGES = 3;

const isShown = (o: Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

export function MotorModel({
  spec,
  idPrefix = 'motor',
  explode,
  lod = 'high',
  rpm = 3000,
}: MotorModelProps) {
  const geo = useMemo(() => buildMotorGeometry(spec, lod), [spec, lod]);
  useEffect(() => () => disposeMotorGeometry(geo), [geo]);
  const l = geo.layout;
  const xray = useScene((s) => s.xray);
  const top = idPrefix.split('/')[0];

  const root = useRef<Group>(null);
  const rotor = useRef<Group>(null);
  const inter = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const st = useRef({ angle: 0, out: [0, 0, 0] }).current;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const focus = useScene.getState().focus;
    if (focus !== null && !relatedToFocus(top, focus)) return;
    if (!isShown(root.current)) return;
    if (vehiclePose.active) st.angle = vehiclePose.wheelSpin * l.ratio;
    else st.angle += (rpm / 60) * 2 * Math.PI * dt * engineRuntime.timeScale;
    const g = gearAngles(l, st.angle, st.out);
    if (rotor.current) rotor.current.rotation.x = g[0];
    if (inter.current) inter.current.rotation.x = g[1];
    if (ring.current) ring.current.rotation.x = g[2];
  });

  const U = l.lengthMm * MM;
  const pre = idPrefix;
  const m: Vec3 = [0, l.motorAxis[0] * MM, l.motorAxis[1] * MM];
  const i: Vec3 = [0, l.interAxis[0] * MM, l.interAxis[1] * MM];
  const inverterDir: Vec3 = [0, 0.55, 0.85];

  return (
    <Assembly stages={MOTOR_STAGES} explode={explode}>
      <group ref={root} key={`${spec.id}:${lod}`}>
        <Part
          id={`${pre}/housing`}
          system="motor"
          label="Motor housing"
          explode={{ dir: [0, 1, 0], dist: 0.45 * U, stage: 0 }}
        >
          <mesh
            geometry={geo.housing}
            material={xray ? ghostMat('motor', 0.32) : sysMat('motor', 'satin')}
            renderOrder={2}
          />
        </Part>
        <Part id={`${pre}/stator`} system="motor" label="Stator & windings">
          <mesh geometry={geo.stator} material={sysMat('chassis', 'metal')} castShadow />
          <mesh geometry={geo.windings} material={sysMat('exhaust', 'metal')} castShadow />
        </Part>
        <Part
          id={`${pre}/rotor`}
          system="motor"
          label={
            spec.kind === 'induction'
              ? 'Rotor (squirrel cage)'
              : spec.kind === 'pmsm'
                ? 'Rotor (magnets)'
                : 'Rotor (reluctance)'
          }
          explode={{ dir: [-1, 0, 0], dist: 0.8 * U, stage: 2 }}
        >
          <group position={m}>
            <group ref={rotor}>
              <mesh geometry={geo.rotorCore} material={sysMat('chassis', 'satin')} castShadow />
              <mesh geometry={geo.rotorSteel} material={sysMat('suspension', 'metal')} castShadow />
              <mesh
                geometry={geo.magnetsA}
                material={
                  spec.kind === 'induction'
                    ? sysMat('suspension', 'metal')
                    : spec.kind === 'pmsm'
                      ? sysMat('brake', 'satin')
                      : sysMat('chassis', 'rubber')
                }
              />
              {geo.magnetsB && (
                <mesh geometry={geo.magnetsB} material={sysMat('cooling', 'satin')} />
              )}
            </group>
          </group>
        </Part>
        <Part
          id={`${pre}/inverter`}
          system="motor"
          label="Inverter"
          explode={{ dir: inverterDir, dist: 0.4 * U, stage: 0 }}
        >
          <mesh geometry={geo.inverter} material={sysMat('motor', 'satin')} castShadow />
          <mesh geometry={geo.cables} material={sysMat('fuel', 'rubber')} />
        </Part>
        <Part
          id={`${pre}/case`}
          system="gearbox"
          label="Gear case"
          explode={{ dir: [1, 0, 0], dist: 0.4 * U, stage: 0 }}
        >
          <mesh
            geometry={geo.gearCase}
            material={xray ? ghostMat('gearbox', 0.3) : sysMat('gearbox', 'satin')}
            renderOrder={2}
          />
        </Part>
        <Part
          id={`${pre}/gears`}
          system="gearbox"
          label={`Reduction ${l.ratio.toFixed(1)}:1`}
          explode={{ dir: [1, 0, 0], dist: 0.22 * U, stage: 1 }}
        >
          <group position={i}>
            <group ref={inter}>
              <mesh geometry={geo.inter} material={sysMat('gearbox', 'metal')} castShadow />
            </group>
          </group>
        </Part>
        <Part
          id={`${pre}/diff`}
          system="diff"
          label="Differential"
          explode={{ dir: [1, 0, 0], dist: 0.36 * U, stage: 1 }}
        >
          <group ref={ring}>
            <mesh geometry={geo.ring} material={sysMat('gearbox', 'metal')} castShadow />
            <mesh geometry={geo.diff} material={sysMat('diff', 'metal')} castShadow />
            <mesh geometry={geo.outputs} material={sysMat('shaft', 'metal')} castShadow />
          </group>
        </Part>
      </group>
    </Assembly>
  );
}

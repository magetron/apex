/**
 * <RotaryModel>: a Wankel for any rotary EngineSpec, a drop-in for <EngineModel> (EngineModel
 * hands rotaries here): same props, origin on the e-shaft centre, engine-local frame, metres.
 *
 * Motion from engineRuntime.crankDeg (= e-shaft angle): the shaft turns at crank speed; each
 * rotor's centre rides its eccentric lobe round a circle of radius e while the rotor turns a
 * third as fast (spec/derive/rotary rotorPose), so its three apexes trace the housing's
 * epitrochoid. The gas between each rotor flank and the housing is drawn in the colour of the
 * phase that face is in (STROKE_COLORS), flashing at combustion.
 *
 * Explode stages: 0 intake, exhaust, front cover, flywheel · 1 front and rear housings ·
 * 2 rotor housings slide off along the shaft, oil pan drops · 3 rotors slide off their lobes.
 * Sub-part ids: `${idPrefix}/block|crank|rotors|chambers|front-housing|rear-housing|front-cover|
 * flywheel|sump|intake|exhaust`.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  type Mesh,
  type Object3D,
} from 'three';
import { useView } from '../explorer/view';
import { Assembly } from '../scene/Assembly';
import { ghostMat, sysMat } from '../scene/materials';
import { Part } from './labelGate';
import { engineRuntime } from '../scene/runtime';
import { relatedToFocus, useScene } from '../scene/store';
import { useTheme, type Theme } from '../scene/theme';
import { envelope } from '../spec/derive/envelope';
import type { StrokeName } from '../spec/derive/kinematics';
import {
  faceCycleDeg,
  lobeDeg,
  ROTARY_CYCLE_DEG,
  rotaryDef,
  rotaryPhase,
} from '../spec/derive/rotary';
import type { EngineSpec, RotaryDef } from '../spec/types';
import { DEG, mod } from '../spec/units';
import { damp, ENGINE_STAGES, SHAKE_COUPLE, SHAKE_FORCE, stepStages } from './anim';
import { BalanceViz } from './BalanceViz';
import type { EngineModelProps } from './EngineModel';
import { chamberMat, STROKE_COLORS } from './materials';
import { balanceTable, glowCurve, sampleBalance } from './motion';
import { MM } from './prims';
import {
  buildRotaryGeometry,
  disposeRotaryGeometry,
  FLANK_SEGS,
  type RotaryGeometry,
} from './rotaryGeometry';

const PHASES: StrokeName[] = ['intake', 'compression', 'power', 'exhaust'];
/** samples per chamber wall: housing arc and flank, apex to apex */
const M = FLANK_SEGS + 1;
const VERTS = 4 * M;

/** Phase of a face at every whole e-shaft degree of its cycle: index into PHASES, progress. */
function phaseTable(r: RotaryDef) {
  const phase = new Uint8Array(ROTARY_CYCLE_DEG);
  const t = new Float32Array(ROTARY_CYCLE_DEG);
  for (let c = 0; c < ROTARY_CYCLE_DEG; c++) {
    const p = rotaryPhase(r, c + 0.5);
    phase[c] = PHASES.indexOf(p.stroke);
    t[c] = p.t;
  }
  return { phase, t };
}

/** Gas colours per phase for a theme; combustion is mixed toward its flash each frame. */
function gasColors(theme: Theme) {
  const ink = new Color('#1b2633');
  const base = PHASES.map((p) => {
    const c = new Color(STROKE_COLORS[p]);
    return theme === 'light' ? c.lerp(ink, 0.12) : c;
  });
  return { base, flash: new Color(theme === 'dark' ? '#fff1c1' : '#d62d00') };
}

/** One indexed, dynamic mesh for every chamber: front and back caps, housing and flank walls. */
function chamberGeometry(chambers: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(chambers * VERTS * 3), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(chambers * VERTS * 3), 3));
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, c, a, c, d);
  for (let ch = 0; ch < chambers; ch++) {
    const o = ch * VERTS;
    const hF = o;
    const fF = o + M;
    const hB = o + 2 * M;
    const fB = o + 3 * M;
    for (let j = 0; j < M - 1; j++) {
      quad(hF + j, hF + j + 1, fF + j + 1, fF + j);
      quad(hB + j, hB + j + 1, fB + j + 1, fB + j);
      quad(hF + j, hF + j + 1, hB + j + 1, hB + j);
      quad(fF + j, fF + j + 1, fB + j + 1, fB + j);
    }
  }
  g.setIndex(idx);
  return g;
}

/** Explode travel (metres), scaled to the engine, ordered so nothing passes through anything. */
function explodeDistances(spec: EngineSpec) {
  const env = envelope(spec);
  const U = Math.max(env.lengthMm, env.widthMm, env.heightMm) * MM;
  return {
    cover: 1.3 * U,
    plate: 0.95 * U,
    housing: 0.6 * U,
    rotor: 0.28 * U,
    sump: 0.6 * U,
    intake: 0.75 * U,
    exhaust: 0.5 * U,
  };
}

const put = (a: Float32Array, vertex: number, x: number, y: number, z: number) => {
  a[vertex * 3] = x;
  a[vertex * 3 + 1] = y;
  a[vertex * 3 + 2] = z;
};

const isShown = (o: Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

export function RotaryModel({
  spec,
  idPrefix = 'engine',
  explode,
  lod = 'high',
  showBalance,
}: EngineModelProps) {
  const r = rotaryDef(spec);
  const geo = useMemo<RotaryGeometry>(() => buildRotaryGeometry(spec, lod), [spec, lod]);
  useEffect(() => () => disposeRotaryGeometry(geo), [geo]);
  const n = spec.cylinders.length;
  const tables = useMemo(() => balanceTable(spec), [spec]);
  const phases = useMemo(() => phaseTable(r), [r]);
  const gas = useMemo(() => chamberGeometry(3 * n), [n]);
  useEffect(() => () => gas.dispose(), [gas]);
  const dist = useMemo(() => explodeDistances(spec), [spec]);
  const d = geo.dims;

  const xray = useScene((s) => s.xray);
  const theme = useTheme((s) => s.theme);
  const colors = useMemo(() => gasColors(theme), [theme]);
  const [view] = useView();
  const top = idPrefix.split('/')[0];
  const balanceOn =
    showBalance ?? (view.level === 'part' && view.part === top && view.detail === 'balance');

  const root = useRef<Group>(null);
  const shaft = useRef<Group>(null);
  const pulley = useRef<Mesh>(null);
  const fly = useRef<Group>(null);
  const chambers = useRef<Mesh>(null);
  const housings = useRef<(Group | null)[]>([]);
  const rotors = useRef<(Group | null)[]>([]);

  const st = useRef({
    prog: [0, 0, 0, 0],
    shake: 0,
    c: new Color(),
    bal: new Float32Array(8),
  }).current;

  const tick = (dt: number, force: boolean) => {
    const scene = useScene.getState();
    if (!force && scene.focus !== null && !relatedToFocus(top, scene.focus)) return;
    if (!force && !isShown(root.current)) return;

    const deg = engineRuntime.crankDeg;
    stepStages(st.prog, explode ?? scene.explode, dt);
    const p2 = st.prog[2];
    const p3 = st.prog[3];

    const turn = -deg * DEG;
    if (shaft.current) shaft.current.rotation.x = turn;
    if (pulley.current) pulley.current.rotation.x = turn;
    if (fly.current) fly.current.rotation.x = turn;

    const e = d.e;
    const R = d.R;
    const pos = gas.attributes.position.array as Float32Array;
    const col = gas.attributes.color.array as Float32Array;
    const halfW = (d.width / 2 - 0.6) * MM;
    for (let i = 0; i < n; i++) {
      const ax = geo.rotorX[i];
      const side = Math.sign(ax);
      const hg = housings.current[i];
      if (hg) hg.position.x = ax * MM + side * dist.housing * p2;
      const lobe = lobeDeg(spec, i, deg);
      const cy = e * Math.cos(lobe * DEG);
      const cz = e * Math.sin(lobe * DEG);
      const psi = lobe / 3;
      const rg = rotors.current[i];
      if (rg) {
        rg.position.set(ax * MM + side * dist.rotor * p3, cy * MM, cz * MM);
        rg.rotation.x = psi * DEG;
      }

      // chamber gas: housing arc and rotor flank between the face's two apexes
      const x0 = ax * MM - halfW;
      const x1 = ax * MM + halfW;
      for (let k = 0; k < 3; k++) {
        const o = (i * 3 + k) * VERTS;
        const a0 = psi + 120 * k;
        const ca = Math.cos(a0 * DEG);
        const sa = Math.sin(a0 * DEG);
        for (let j = 0; j < M; j++) {
          const al = (a0 + (120 * j) / (M - 1)) * DEG;
          const hy = (e * Math.cos(3 * al) + R * Math.cos(al)) * MM;
          const hz = (e * Math.sin(3 * al) + R * Math.sin(al)) * MM;
          const [fy0, fz0] = geo.flank[j];
          const fy = (cy + fy0 * ca - fz0 * sa) * MM;
          const fz = (cz + fy0 * sa + fz0 * ca) * MM;
          put(pos, o + j, x1, hy, hz);
          put(pos, o + M + j, x1, fy, fz);
          put(pos, o + 2 * M + j, x0, hy, hz);
          put(pos, o + 3 * M + j, x0, fy, fz);
        }
        const cyc = Math.floor(mod(faceCycleDeg(spec, i, k, deg), ROTARY_CYCLE_DEG));
        const ph = phases.phase[cyc];
        st.c.copy(colors.base[ph]);
        if (PHASES[ph] === 'power') st.c.lerp(colors.flash, 0.75 * glowCurve(phases.t[cyc]));
        for (let v = 0; v < VERTS; v++) put(col, o + v, st.c.r, st.c.g, st.c.b);
      }
    }
    gas.attributes.position.needsUpdate = true;
    gas.attributes.color.needsUpdate = true;
    // the chambers only mean something while the rotors sit in their housings
    if (chambers.current) chambers.current.visible = p2 < 0.02;

    st.shake = damp(st.shake, balanceOn ? 1 : 0, 5, dt);
    const g = root.current;
    if (g) {
      if (st.shake > 1e-3) {
        const b = st.bal;
        sampleBalance(tables, deg, b);
        const kf = SHAKE_FORCE * st.shake;
        const kc = SHAKE_COUPLE * st.shake;
        g.position.set(0, -(b[0] + b[2]) * kf, -(b[1] + b[3]) * kf);
        g.rotation.set(0, -(b[4] + b[6]) * kc, -(b[5] + b[7]) * kc);
      } else if (g.position.lengthSq() > 0 || g.rotation.y !== 0 || g.rotation.z !== 0) {
        g.position.set(0, 0, 0);
        g.rotation.set(0, 0, 0);
      }
    }
  };
  const latest = useRef(tick);
  latest.current = tick;
  useFrame((_, dt) => tick(Math.min(dt, 0.1), false));
  useLayoutEffect(() => latest.current(0, true), [geo, gas]);

  const ghost = (o: number) => ghostMat('engine', o);
  // lighter than a piston block: you look through five stacked castings to the rotors
  const casting = xray ? ghost(0.2) : sysMat('engine', 'satin');
  const plateMat = xray ? ghost(0.12) : sysMat('engine', 'satin');
  const steel = sysMat('suspension', 'metal');
  const dark = sysMat('chassis', 'metal');
  const inPort = sysMat('intake', 'satin');
  const exPort = sysMat('exhaust', 'satin');
  const pre = idPrefix;
  const plates = geo.plates;
  const ends = [plates[0], plates[plates.length - 1]];
  const middles = plates.slice(1, -1);
  const plateMeshes = (p: (typeof plates)[number]) => (
    <>
      <mesh geometry={p.casting} material={plateMat} renderOrder={2} />
      {p.intake && <mesh geometry={p.intake} material={inPort} />}
      {p.exhaust && <mesh geometry={p.exhaust} material={exPort} />}
      {p.gear && <mesh geometry={p.gear} material={dark} />}
    </>
  );

  return (
    <Assembly stages={ENGINE_STAGES} explode={explode}>
      <group ref={root} key={`${spec.id}:${lod}`}>
        <Part id={`${pre}/block`} system="engine" label="Rotor housings">
          {geo.rotorX.map((x, i) => (
            <group
              key={i}
              position={[x * MM, 0, 0]}
              ref={(o) => {
                housings.current[i] = o;
              }}
            >
              <mesh geometry={geo.rotorHousing} material={casting} renderOrder={2} />
              <mesh geometry={geo.plugs} material={steel} />
              {geo.housingIntake && <mesh geometry={geo.housingIntake} material={inPort} />}
              {geo.housingExhaust && <mesh geometry={geo.housingExhaust} material={exPort} />}
            </group>
          ))}
          {middles.map((p) => (
            <group key={p.index}>{plateMeshes(p)}</group>
          ))}
        </Part>

        {ends.map((p) => (
          <Part
            key={p.index}
            id={`${pre}/${p.dir > 0 ? 'front' : 'rear'}-housing`}
            system="engine"
            label={p.dir > 0 ? 'Front housing' : 'Rear housing'}
            explode={{ dir: [p.dir, 0, 0], dist: dist.plate, stage: 1 }}
          >
            {plateMeshes(p)}
          </Part>
        ))}

        <Part id={`${pre}/rotors`} system="engine" label="Rotors">
          {geo.rotorX.map((_, i) => (
            <group
              key={i}
              ref={(o) => {
                rotors.current[i] = o;
              }}
            >
              <mesh
                geometry={geo.gearSide[i] > 0 ? geo.rotor.front : geo.rotor.rear}
                material={steel}
                castShadow
              />
              <mesh geometry={geo.seals} material={dark} />
              <mesh
                geometry={geo.gearSide[i] > 0 ? geo.rotorGear.front : geo.rotorGear.rear}
                material={dark}
              />
            </group>
          ))}
        </Part>

        <Part id={`${pre}/chambers`} system="combustion" interactive={false}>
          <mesh
            ref={chambers}
            geometry={gas}
            material={chamberMat(theme)}
            frustumCulled={false}
            renderOrder={3}
            raycast={() => {}}
          />
        </Part>

        <Part id={`${pre}/crank`} system="engine" label="Eccentric shaft">
          <group ref={shaft}>
            <mesh geometry={geo.eshaft} material={steel} castShadow />
            <mesh geometry={geo.counterweights} material={dark} />
          </group>
        </Part>

        <Part
          id={`${pre}/front-cover`}
          system="engine"
          label="Front cover & pulley"
          explode={{ dir: [1, 0, 0], dist: dist.cover, stage: 0 }}
        >
          <mesh
            geometry={geo.frontCover}
            material={xray ? ghost(0.16) : sysMat('engine', 'satin')}
            renderOrder={2}
          />
          <mesh ref={pulley} geometry={geo.pulley} material={dark} />
        </Part>

        <Part
          id={`${pre}/flywheel`}
          system="engine"
          label="Flywheel & counterweight"
          explode={{ dir: [-1, 0, 0], dist: dist.cover, stage: 0 }}
        >
          <group ref={fly}>
            <mesh geometry={geo.flywheel} material={dark} castShadow />
          </group>
        </Part>

        <Part
          id={`${pre}/sump`}
          system="engine"
          label="Oil pan"
          explode={{ dir: [0, -1, 0], dist: dist.sump, stage: 2 }}
        >
          <mesh
            geometry={geo.sump}
            material={xray ? ghost(0.34) : sysMat('chassis', 'satin')}
            renderOrder={2}
          />
        </Part>

        <Part
          id={`${pre}/intake`}
          system="intake"
          label="Intake"
          explode={{ dir: [0, 1, 0], dist: dist.intake, stage: 0 }}
        >
          <mesh geometry={geo.intake} material={sysMat('intake', 'satin')} castShadow />
        </Part>

        <Part
          id={`${pre}/exhaust`}
          system="exhaust"
          label="Exhaust manifold"
          explode={{ dir: [0, -0.6, 0.8], dist: dist.exhaust, stage: 0 }}
        >
          <mesh geometry={geo.exhaust} material={sysMat('exhaust', 'metal')} castShadow />
        </Part>
      </group>
      <BalanceViz
        halfSpanM={((d.stackMaxMm - d.stackMinMm) / 2 + 40) * MM}
        tables={tables}
        active={balanceOn}
      />
    </Assembly>
  );
}

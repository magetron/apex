/**
 * <EngineModel>: the procedural engine for any EngineSpec (inline, V, flat, VR, W).
 * Drop-in for ProtoEngine: same props, origin on the crank-axis centre, engine-local frame,
 * metres. Geometry comes from engineLayout() (which shares engineDims() with envelope()), the
 * motion from engineRuntime.crankDeg through tables built from cylinderState()/strokeOf().
 *
 * Explode stages: 0 heads, intake, exhaust, turbos · 1 valvetrain, timing · 2 pistons & rods,
 * sump · 3 crank, flywheel. Sub-part ids: `${idPrefix}/block|crank|pistons|head-<n>|cams|
 * timing|intake|exhaust|turbo|sump|flywheel`.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  type Group,
  type InstancedMesh,
  type Mesh,
  type Object3D,
} from 'three';
import { useView } from '../explorer/view';
import { Assembly } from '../scene/Assembly';
import { ghostMat, sysMat } from '../scene/materials';
import { Part } from '../scene/Part';
import { engineRuntime } from '../scene/runtime';
import { relatedToFocus, useScene } from '../scene/store';
import { useTheme } from '../scene/theme';
import type { EngineSpec, Vec3 } from '../spec/types';
import { DEG } from '../spec/units';
import { damp, ENGINE_STAGES, SHAKE_COUPLE, SHAKE_FORCE, stepStages } from './anim';
import { BalanceViz } from './BalanceViz';
import { buildEngineGeometry, disposeEngineGeometry, type Lod } from './geometry';
import {
  ancillaryDir,
  engineLayout,
  liftFraction,
  pushrodAxis,
  valveInEngine,
  type EngineLayout,
} from './layout';
import { glowColor, glowMat } from './materials';
import { crankDelta, motionTables, sampleBalance, sampleGlow, sampleSlider } from './motion';
import { MM } from './prims';
import { RotaryModel } from './RotaryModel';

export interface EngineModelProps {
  spec: EngineSpec;
  /** id prefix so the same engine can live inside a car ("engine/…") */
  idPrefix?: string;
  /** fixed explode for this engine (e.g. 0 inside a car); default follows the global slider */
  explode?: number;
  /** 'low' drops valves, springs, chain links and small detail (cars seen from outside) */
  lod?: Lod;
  /** force the balance visualiser on/off; default: on at the explorer's #/<car>/engine/balance */
  showBalance?: boolean;
}

export { ENGINE_STAGES };

/** Explode travel (metres), scaled to the engine. */
export function explodeDistances(l: EngineLayout) {
  const U = Math.max(l.env.lengthMm, l.env.widthMm, l.env.heightMm) * MM;
  return {
    head: 0.55 * U,
    valvetrain: 0.3 * U,
    timing: 0.32 * U,
    piston: 0.42 * U,
    sump: 0.6 * U,
    crank: 0.34 * U,
    flywheel: 0.42 * U,
    intake: 0.75 * U,
    exhaust: 0.5 * U,
  };
}

/** Constant per-instance data for the animation, in metres. */
function animationData(l: EngineLayout, refs: { valve: number; spring: number; pushrod: number }) {
  const n = l.cylinders.length;
  const X = new Vector3(1, 0, 0);
  const Y = new Vector3(0, 1, 0);
  const cyl = l.cylinders.map((c) => ({
    x: c.axialMm * MM,
    uy: c.axis[0],
    uz: c.axis[1],
    q: new Quaternion().setFromAxisAngle(X, c.tiltDeg * DEG),
  }));
  const intakeDia = l.valves.find((v) => v.kind === 'intake')?.headDiaMm ?? 1;
  const valves = l.valves.map((v) => {
    const { seat, dir } = valveInEngine(l, v);
    const springBase = 0.45 * v.lengthMm;
    return {
      head: v.head,
      peak: v.peakDeg,
      lift: v.liftMm * MM,
      seat: new Vector3(seat[0], seat[1], seat[2]).multiplyScalar(MM),
      dir: new Vector3(dir[0], dir[1], dir[2]),
      q: new Quaternion().setFromUnitVectors(Y, new Vector3(dir[0], dir[1], dir[2])),
      sxz: v.headDiaMm / intakeDia,
      sy: v.lengthMm / refs.valve,
      springBase: springBase * MM,
      springLen: (v.lengthMm - springBase - 0.1 * l.spec.boreMm) * MM,
    };
  });
  const camLift = l.cams[0]?.liftMm ?? 0;
  const pushrods = l.pushrods.map((p) => {
    const { dir, lengthMm } = pushrodAxis(p);
    return {
      head: p.head,
      peak: l.valves[p.valve].peakDeg,
      lift: camLift * MM,
      from: new Vector3(p.from[0], p.from[1], p.from[2]).multiplyScalar(MM),
      dir: new Vector3(dir[0], dir[1], dir[2]),
      q: new Quaternion().setFromUnitVectors(Y, new Vector3(dir[0], dir[1], dir[2])),
      sy: lengthMm / refs.pushrod,
    };
  });
  const headAxis = l.heads.map(
    (h) => [Math.cos(h.tiltDeg * DEG), Math.sin(h.tiltDeg * DEG)] as const,
  );
  return {
    n,
    cyl,
    valves,
    pushrods,
    headAxis,
    springRef: refs.spring * MM,
    intakeDirs: l.plenums.map((p) => ancillaryDir(p.outDir)),
    exhaustDirs: l.exhaust.map((g) => ancillaryDir(g.outDir)),
    turboDirs: l.turbos.map((t) => ancillaryDir(t.outDir)),
  };
}

/** Where the balance view stands a couple's end arrows: just beyond the end bores (metres). */
function coupleArm(l: EngineLayout): number {
  const axials = l.cylinders.map((c) => c.axialMm);
  return ((Math.max(...axials) - Math.min(...axials)) / 2 + l.spec.boreMm / 2 + 40) * MM;
}

const isShown = (o: Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

/** The engine for any spec: pistons here, a Wankel in <RotaryModel> (same props and frame). */
export function EngineModel(props: EngineModelProps) {
  return props.spec.family === 'rotary' ? (
    <RotaryModel {...props} />
  ) : (
    <PistonEngineModel {...props} />
  );
}

function PistonEngineModel({
  spec,
  idPrefix = 'engine',
  explode,
  lod = 'high',
  showBalance,
}: EngineModelProps) {
  const layout = useMemo(() => engineLayout(spec), [spec]);
  const geo = useMemo(() => buildEngineGeometry(spec, lod, layout), [spec, lod, layout]);
  useEffect(() => () => disposeEngineGeometry(geo), [geo]);
  const tables = useMemo(() => motionTables(spec), [spec]);
  const anim = useMemo(
    () =>
      animationData(layout, {
        valve: geo.valveRefMm,
        spring: geo.springRefMm,
        pushrod: geo.pushrodRefMm,
      }),
    [layout, geo],
  );
  const dist = useMemo(() => explodeDistances(layout), [layout]);
  const linkCounts = useMemo(
    () => geo.chains.map((c) => Math.max(8, Math.round(c.lengthMm / 9.525))),
    [geo],
  );
  const totalLinks = linkCounts.reduce((a, b) => a + b, 0);

  const xray = useScene((s) => s.xray);
  const theme = useTheme((s) => s.theme);
  const [view] = useView();
  const top = idPrefix.split('/')[0];
  const balanceOn =
    showBalance ?? (view.level === 'part' && view.part === top && view.detail === 'balance');

  const root = useRef<Group>(null);
  const crank = useRef<Group>(null);
  const fly = useRef<Group>(null);
  const pistons = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const rods = useRef<InstancedMesh>(null);
  const glow = useRef<InstancedMesh>(null);
  const valves = useRef<InstancedMesh>(null);
  const springs = useRef<InstancedMesh>(null);
  const pushrods = useRef<InstancedMesh>(null);
  const chain = useRef<InstancedMesh>(null);
  const cams = useRef<(Mesh | null)[]>([]);
  const vtGroups = useRef<(Group | null)[]>([]);
  const blockCam = useRef<Group>(null);
  const intakeGroups = useRef<(Group | null)[]>([]);
  const exhaustGroups = useRef<(Group | null)[]>([]);
  const turboGroups = useRef<(Group | null)[]>([]);
  const turboWheels = useRef<(Mesh | null)[]>([]);

  const st = useRef({
    prog: [0, 0, 0, 0],
    last: engineRuntime.crankDeg,
    chainS: 0,
    spin: 0,
    shake: 0,
    frame: 0,
    m: new Matrix4(),
    p: new Vector3(),
    q: new Quaternion(),
    s: new Vector3(),
    one: new Vector3(1, 1, 1),
    x: new Vector3(1, 0, 0),
    c: new Color(),
    slide: new Float32Array(4),
    bal: new Float32Array(8),
    headOff: new Float32Array(8),
  }).current;

  // the glow mesh needs its instanceColor attribute before the first render
  useLayoutEffect(() => {
    const g = glow.current;
    if (!g) return;
    st.c.setRGB(0, 0, 0);
    st.m.makeScale(0, 0, 0);
    for (let i = 0; i < anim.n; i++) {
      g.setColorAt(i, st.c);
      g.setMatrixAt(i, st.m);
    }
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }, [anim, geo, st]);

  /** One animation step; `force` runs it even while hidden (first pose after mounting). */
  const tick = (dt: number, force: boolean) => {
    const scene = useScene.getState();
    if (!force && scene.focus !== null && !relatedToFocus(top, scene.focus)) return;
    if (!force && !isShown(root.current)) return;

    const deg = engineRuntime.crankDeg;
    const delta = crankDelta(deg, st.last);
    st.last = deg;

    // explode progress per stage, eased and damped exactly like <Part>
    stepStages(st.prog, explode ?? scene.explode, dt);
    const p0 = st.prog[0];
    const p1 = st.prog[1];
    const p2 = st.prog[2];

    if (crank.current) crank.current.rotation.x = -deg * DEG;
    if (fly.current) fly.current.rotation.x = -deg * DEG;

    const { m, p, q, s, one, slide } = st;
    const pistonOff = dist.piston * p2;
    const deck = layout.dims.deckMm;
    const ch = layout.piston.compressionMm;
    for (let i = 0; i < anim.n; i++) {
      const c = anim.cyl[i];
      sampleSlider(tables, i, deg, slide);
      const oy = c.uy * pistonOff;
      const oz = c.uz * pistonOff;
      p.set(c.x, slide[2] * MM + oy, slide[3] * MM + oz);
      m.compose(p, c.q, one);
      pistons.current?.setMatrixAt(i, m);
      rings.current?.setMatrixAt(i, m);
      q.setFromAxisAngle(st.x, Math.atan2(slide[3] - slide[1], slide[2] - slide[0]));
      p.set(c.x, slide[0] * MM + oy, slide[1] * MM + oz);
      m.compose(p, q, one);
      rods.current?.setMatrixAt(i, m);
      const g = glow.current;
      if (g) {
        const k = p2 < 0.02 ? sampleGlow(tables, i, deg) : 0;
        if (k > 0.003) {
          const crown = slide[2] * c.uy + slide[3] * c.uz + ch;
          p.set(c.x, c.uy * crown * MM, c.uz * crown * MM);
          s.set(1, Math.max(0.5, deck - crown) * MM, 1);
          glowColor(theme, k, st.c);
        } else {
          s.set(0, 0, 0);
          st.c.setRGB(0, 0, 0);
        }
        m.compose(p, c.q, s);
        g.setMatrixAt(i, m);
        g.setColorAt(i, st.c);
      }
    }
    if (pistons.current) pistons.current.instanceMatrix.needsUpdate = true;
    if (rings.current) rings.current.instanceMatrix.needsUpdate = true;
    if (rods.current) rods.current.instanceMatrix.needsUpdate = true;
    if (glow.current) {
      glow.current.instanceMatrix.needsUpdate = true;
      if (glow.current.instanceColor) glow.current.instanceColor.needsUpdate = true;
    }

    // valvetrain: cams at half crank speed; each head's valvetrain rides out with its head
    const camAngle = (-deg / 2) * DEG;
    for (let k = 0; k < geo.cams.length; k++) {
      const mesh = cams.current[k];
      if (mesh) mesh.rotation.x = camAngle;
    }
    for (let h = 0; h < anim.headAxis.length; h++) {
      const off = dist.head * p0 + dist.valvetrain * p1;
      st.headOff[h] = off;
      const g = vtGroups.current[h];
      if (g) g.position.set(0, anim.headAxis[h][0] * off, anim.headAxis[h][1] * off);
    }
    if (blockCam.current) blockCam.current.position.x = dist.valvetrain * p1 * 1.2;

    const vm = valves.current;
    const sm = springs.current;
    for (let j = 0; j < anim.valves.length; j++) {
      const v = anim.valves[j];
      const lift = v.lift * liftFraction(v.peak, deg);
      const off = st.headOff[v.head];
      const hy = anim.headAxis[v.head][0];
      const hz = anim.headAxis[v.head][1];
      if (vm) {
        p.copy(v.seat).addScaledVector(v.dir, -lift);
        p.y += hy * off;
        p.z += hz * off;
        s.set(v.sxz, v.sy, v.sxz);
        m.compose(p, v.q, s);
        vm.setMatrixAt(j, m);
      }
      if (sm) {
        p.copy(v.seat).addScaledVector(v.dir, v.springBase);
        p.y += hy * off;
        p.z += hz * off;
        s.set(1, Math.max(0.2, (v.springLen - lift) / anim.springRef), 1);
        m.compose(p, v.q, s);
        sm.setMatrixAt(j, m);
      }
    }
    if (vm) vm.instanceMatrix.needsUpdate = true;
    if (sm) sm.instanceMatrix.needsUpdate = true;
    const pm = pushrods.current;
    if (pm) {
      for (let j = 0; j < anim.pushrods.length; j++) {
        const r = anim.pushrods[j];
        const lift = r.lift * liftFraction(r.peak, deg);
        const off = st.headOff[r.head];
        const hy = anim.headAxis[r.head][0];
        const hz = anim.headAxis[r.head][1];
        p.copy(r.from).addScaledVector(r.dir, lift);
        p.y += hy * off;
        p.z += hz * off;
        s.set(1, r.sy, 1);
        m.compose(p, r.q, s);
        pm.setMatrixAt(j, m);
      }
      pm.instanceMatrix.needsUpdate = true;
    }

    // timing chain: links travel at the crank sprocket's surface speed
    const cm = chain.current;
    if (cm) {
      st.chainS += delta * DEG * (layout.timing.crankSprocketMm + 2);
      let idx = 0;
      for (let li = 0; li < geo.chains.length; li++) {
        const loop = geo.chains[li];
        const count = linkCounts[li];
        const pitch = loop.lengthMm / count;
        const pts = loop.pts;
        for (let k = 0; k < count; k++) {
          let arc = (k * pitch - loop.orient * st.chainS) % loop.lengthMm;
          if (arc < 0) arc += loop.lengthMm;
          const f = (arc / loop.lengthMm) * loop.samples;
          const i0 = Math.floor(f) % loop.samples;
          const i1 = (i0 + 1) % loop.samples;
          const w = f - Math.floor(f);
          const y = pts[i0 * 4] + (pts[i1 * 4] - pts[i0 * 4]) * w;
          const z = pts[i0 * 4 + 1] + (pts[i1 * 4 + 1] - pts[i0 * 4 + 1]) * w;
          p.set(loop.x * MM, y * MM, z * MM);
          q.setFromAxisAngle(st.x, Math.atan2(pts[i0 * 4 + 3], pts[i0 * 4 + 2]));
          m.compose(p, q, one);
          cm.setMatrixAt(idx++, m);
        }
      }
      cm.instanceMatrix.needsUpdate = true;
    }

    // ancillaries ride out on stage 0
    const ki = dist.intake * p0;
    const ke = dist.exhaust * p0;
    for (let k = 0; k < anim.intakeDirs.length; k++) {
      const d = anim.intakeDirs[k];
      intakeGroups.current[k]?.position.set(d[0] * ki, d[1] * ki, d[2] * ki);
    }
    for (let k = 0; k < anim.exhaustDirs.length; k++) {
      const d = anim.exhaustDirs[k];
      exhaustGroups.current[k]?.position.set(d[0] * ke, d[1] * ke, d[2] * ke);
    }
    st.spin += delta * DEG * 6;
    for (let k = 0; k < anim.turboDirs.length; k++) {
      const d = anim.turboDirs[k];
      turboGroups.current[k]?.position.set(d[0] * ke, d[1] * ke, d[2] * ke);
      const w = turboWheels.current[k];
      if (w) w.rotation.x = st.spin;
    }

    // exaggerated shake: the block moves against the free forces and rocks against the couples
    st.shake = damp(st.shake, balanceOn ? 1 : 0, 5, dt);
    const r = root.current;
    if (r) {
      if (st.shake > 1e-3) {
        const b = st.bal;
        sampleBalance(tables, deg, b);
        const kf = SHAKE_FORCE * st.shake;
        const kc = SHAKE_COUPLE * st.shake;
        r.position.set(0, -(b[0] + b[2]) * kf, -(b[1] + b[3]) * kf);
        r.rotation.set(0, -(b[4] + b[6]) * kc, -(b[5] + b[7]) * kc);
      } else if (r.position.lengthSq() > 0 || r.rotation.y !== 0 || r.rotation.z !== 0) {
        r.position.set(0, 0, 0);
        r.rotation.set(0, 0, 0);
      }
    }

    // keep instanced picking bounds roughly current (instances move and explode)
    if (st.frame++ % 15 === 0) {
      pistons.current?.computeBoundingSphere();
      rods.current?.computeBoundingSphere();
      valves.current?.computeBoundingSphere();
      chain.current?.computeBoundingSphere();
    }
  };
  const latest = useRef(tick);
  latest.current = tick;
  useFrame((_, dt) => tick(Math.min(dt, 0.1), false));
  // pose every instance before the first frame so nothing flashes at the origin
  useLayoutEffect(() => latest.current(0, true), [geo, anim]);

  const ghost = (o: number) => ghostMat('engine', o);
  const castShell = xray ? ghost(0.26) : sysMat('engine', 'satin');
  const steel = sysMat('suspension', 'metal');
  const dark = sysMat('chassis', 'metal');
  const n = anim.n;
  const pre = idPrefix;
  const turbos = layout.turbos.length;
  const vec = (y: number, z: number, x = 0): Vec3 => [x, y, z];
  const flyDir: Vec3 = [-0.9, -0.45, 0];

  return (
    <Assembly stages={ENGINE_STAGES} explode={explode}>
      <group ref={root} key={`${spec.id}:${lod}`}>
        <Part id={`${pre}/block`} system="engine" label="Block">
          <mesh geometry={geo.block} material={castShell} renderOrder={2} />
          <mesh geometry={geo.liners} material={ghost(0.55)} visible={xray} renderOrder={2} />
        </Part>

        <Part
          id={`${pre}/sump`}
          system="engine"
          label={spec.geometry.drySump ? 'Dry sump' : 'Oil sump'}
          explode={{ dir: [0, -1, 0], dist: dist.sump, stage: 2 }}
        >
          <mesh
            geometry={geo.sump}
            material={xray ? ghost(0.34) : sysMat('chassis', 'satin')}
            renderOrder={2}
          />
        </Part>

        <Part
          id={`${pre}/crank`}
          system="engine"
          label="Crankshaft"
          explode={{ dir: [0, -1, 0], dist: dist.crank, stage: 3 }}
        >
          <group ref={crank}>
            <mesh geometry={geo.crankSteel} material={steel} castShadow />
            <mesh geometry={geo.crankWebs} material={dark} castShadow />
          </group>
        </Part>

        <Part
          id={`${pre}/flywheel`}
          system="engine"
          label="Flywheel"
          explode={{ dir: flyDir, dist: dist.flywheel, stage: 3 }}
        >
          <group ref={fly}>
            <mesh geometry={geo.flywheel} material={dark} castShadow />
          </group>
        </Part>

        <Part id={`${pre}/pistons`} system="engine" label="Pistons & rods">
          <instancedMesh
            ref={pistons}
            args={[geo.piston, steel, n]}
            frustumCulled={false}
            castShadow
          />
          <instancedMesh ref={rings} args={[geo.pistonRings, dark, n]} frustumCulled={false} />
          <instancedMesh
            ref={rods}
            args={[geo.rod, sysMat('engine', 'metal'), n]}
            frustumCulled={false}
            castShadow
          />
          <instancedMesh
            ref={glow}
            args={[geo.glow, undefined, n]}
            material={glowMat(theme)}
            frustumCulled={false}
            renderOrder={3}
            raycast={() => {}}
          />
        </Part>

        {layout.heads.map((h, hi) => {
          const hg = geo.heads[hi];
          const [uy, uz] = anim.headAxis[hi];
          return (
            <Part
              key={hi}
              id={`${pre}/head-${hi}`}
              system="engine"
              label={h.label}
              explode={{ dir: vec(uy, uz), dist: dist.head, stage: 0 }}
            >
              <mesh
                geometry={hg.casting}
                material={xray ? ghost(0.4) : sysMat('engine', 'satin')}
                castShadow={!xray}
                renderOrder={2}
              />
              <mesh
                geometry={hg.cover}
                material={xray ? ghost(0.48) : sysMat('engine', 'paint')}
                castShadow={!xray}
                renderOrder={2}
              />
              {hg.coils && <mesh geometry={hg.coils} material={sysMat('chassis', 'satin')} />}
            </Part>
          );
        })}

        <Part
          id={`${pre}/cams`}
          system="engine"
          label={spec.valvetrain.type === 'ohv' ? 'Cam & pushrods' : 'Camshafts & valves'}
        >
          {layout.heads.map((h, hi) => (
            <group
              key={hi}
              ref={(o) => {
                vtGroups.current[hi] = o;
              }}
            >
              <group rotation-x={h.tiltDeg * DEG}>
                {geo.cams.map((c) =>
                  c.head === hi ? (
                    <mesh
                      key={c.cam}
                      ref={(o) => {
                        cams.current[c.cam] = o;
                      }}
                      geometry={c.geometry}
                      position={c.position}
                      material={steel}
                      castShadow
                    />
                  ) : null,
                )}
              </group>
              {geo.rockers[hi] && <mesh geometry={geo.rockers[hi]} material={dark} />}
            </group>
          ))}
          <group ref={blockCam}>
            {geo.cams.map((c) =>
              c.head < 0 ? (
                <mesh
                  key={c.cam}
                  ref={(o) => {
                    cams.current[c.cam] = o;
                  }}
                  geometry={c.geometry}
                  position={c.position}
                  material={steel}
                  castShadow
                />
              ) : null,
            )}
          </group>
          {lod === 'high' && (
            <>
              <instancedMesh
                ref={valves}
                args={[geo.valve, steel, layout.valves.length]}
                frustumCulled={false}
              />
              {geo.spring && (
                <instancedMesh
                  ref={springs}
                  args={[geo.spring, dark, layout.valves.length]}
                  frustumCulled={false}
                />
              )}
              {geo.pushrod && (
                <instancedMesh
                  ref={pushrods}
                  args={[geo.pushrod, steel, layout.pushrods.length]}
                  frustumCulled={false}
                />
              )}
            </>
          )}
        </Part>

        <Part
          id={`${pre}/timing`}
          system="engine"
          label="Timing chain"
          explode={{ dir: [1, 0, 0], dist: dist.timing, stage: 1 }}
        >
          <mesh
            geometry={geo.timingCover}
            material={xray ? ghost(0.3) : sysMat('engine', 'satin')}
            renderOrder={2}
          />
          {geo.chainLink && totalLinks > 0 && (
            <instancedMesh
              ref={chain}
              args={[geo.chainLink, dark, totalLinks]}
              frustumCulled={false}
            />
          )}
        </Part>

        <Part
          id={`${pre}/intake`}
          system="intake"
          label={layout.supercharged ? 'Intake & supercharger' : 'Intake'}
        >
          {geo.intake.map((g, k) => (
            <group
              key={k}
              ref={(o) => {
                intakeGroups.current[k] = o;
              }}
            >
              <mesh geometry={g} material={sysMat('intake', 'satin')} castShadow />
            </group>
          ))}
        </Part>

        <Part id={`${pre}/exhaust`} system="exhaust" label="Exhaust headers">
          {geo.exhaust.map((g, k) => (
            <group
              key={k}
              ref={(o) => {
                exhaustGroups.current[k] = o;
              }}
            >
              <mesh geometry={g} material={sysMat('exhaust', 'metal')} castShadow />
            </group>
          ))}
        </Part>

        {turbos > 0 && (
          <Part
            id={`${pre}/turbo`}
            system="exhaust"
            label={turbos > 1 ? `${turbos} turbos` : 'Turbo'}
          >
            {geo.turbos.map((t, k) => (
              <group
                key={k}
                ref={(o) => {
                  turboGroups.current[k] = o;
                }}
              >
                <mesh geometry={t.hot} material={sysMat('exhaust', 'metal')} castShadow />
                <mesh geometry={t.cold} material={sysMat('intake', 'metal')} castShadow />
                <mesh
                  ref={(o) => {
                    turboWheels.current[k] = o;
                  }}
                  geometry={geo.turboWheel}
                  position={t.wheelAt}
                  material={steel}
                />
              </group>
            ))}
          </Part>
        )}
      </group>
      <BalanceViz halfSpanM={coupleArm(layout)} tables={tables} active={balanceOn} />
    </Assembly>
  );
}

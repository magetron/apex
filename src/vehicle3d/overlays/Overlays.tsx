/**
 * Visual overlays for the internals view (OverlayKind in content/types): CG roundel, axle-load
 * bars, dimension lines, yaw-inertia dumbbell, floor plan and the bay-fit check. Numbers come
 * from massProps / layout / checkFit; text is limited to tags pinned to what they measure.
 */
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, type Material } from 'three';
import type { OverlayKind } from '../../content/types';
import { SYSTEM_COLORS } from '../../scene/palette';
import { Part } from '../../scene/Part';
import type { MassProps, PlacedPart, PowertrainLayout, Vec3, VehicleSpec } from '../../spec/types';
import { DEG, mm, mmVec } from '../../spec/units';
import { checkFit, type FitStatus } from '../fit';
import { G } from '../geom';
import { overlayFill, overlayLine } from '../materials';
import type { Seat } from '../packaging';
import type { Shell } from '../shell/build';
import { useVehicleOverrides } from '../store';
import { TorqueFlowOverlay } from '../TorqueFlow';
import { Tag } from './Tag';

/** LineSegments from flat [x,y,z, x,y,z, …] metres. */
function Lines({ pts, material }: { pts: number[]; material: Material }) {
  const g = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return geo;
  }, [pts]);
  useEffect(() => () => g.dispose(), [g]);
  return <lineSegments geometry={g} material={material} renderOrder={12} />;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ───────────────────────────── CG ─────────────────────────────

const cgDark = overlayFill('#0a0e13', 1, true);
const cgLight = overlayFill('#f4f6f8', 1, true);

function Cg({ mass }: { mass: MassProps }) {
  const at = mmVec(mass.cgMm);
  const r = 0.075;
  const pieces = [0, 1, 2, 3].flatMap((k) => [
    { k: `${k}t`, phi: (k * Math.PI) / 2, theta: 0, dark: k % 2 === 0 },
    { k: `${k}b`, phi: (k * Math.PI) / 2, theta: Math.PI / 2, dark: k % 2 === 1 },
  ]);
  const drop = useMemo(() => {
    const p: number[] = [];
    const n = 12;
    for (let i = 0; i < n; i += 2) {
      p.push(at[0], (at[1] * i) / n, at[2], at[0], (at[1] * (i + 1)) / n, at[2]);
    }
    const c = 0.12;
    p.push(
      at[0] - c,
      0.005,
      at[2],
      at[0] + c,
      0.005,
      at[2],
      at[0],
      0.005,
      at[2] - c,
      at[0],
      0.005,
      at[2] + c,
    );
    return p;
  }, [at]);
  return (
    <>
      <Part id="cg" label="Centre of gravity" system="occupant" position={at}>
        {pieces.map((p) => (
          <mesh key={p.k} renderOrder={14} material={p.dark ? cgDark : cgLight}>
            <sphereGeometry args={[r, 12, 6, p.phi, Math.PI / 2, p.theta, Math.PI / 2]} />
          </mesh>
        ))}
      </Part>
      <Lines pts={drop} material={overlayLine('ink', 0.8)} />
      <Tag at={[at[0], at[1] + 0.16, at[2]]}>
        CG {fmt(mass.cgMm[1])}
        <small>mm</small>
      </Tag>
    </>
  );
}

// ───────────────────────────── axle loads ─────────────────────────────

function AxleLoads({ v, mass }: { v: VehicleSpec; mass: MassProps }) {
  const z = mm(v.dims.widthMm / 2) + 0.35;
  const front = mass.frontPct / 100;
  const bars = [
    { x: 0, share: front, label: 'F' },
    { x: -mm(v.dims.wheelbaseMm), share: 1 - front, label: 'R' },
  ];
  const fill = overlayFill(SYSTEM_COLORS.motor, 0.8);
  return (
    <>
      {bars.map((b) => {
        const kg = mass.totalKg * b.share;
        const h = kg / 1000;
        return (
          <group key={b.label} position={[b.x, 0, z]}>
            <mesh
              geometry={G.box}
              material={fill}
              position={[0, h / 2, 0]}
              scale={[0.16, h, 0.16]}
            />
            <Tag at={[0, h + 0.1, 0]}>
              {b.label} {(b.share * 100).toFixed(1)}%<small>{fmt(kg)} kg</small>
            </Tag>
          </group>
        );
      })}
    </>
  );
}

// ───────────────────────────── dimensions ─────────────────────────────

function Dimensions({ v }: { v: VehicleSpec }) {
  const d = v.dims;
  const xF = mm(d.overhangFMm);
  const xR = mm(d.overhangFMm - d.lengthMm);
  const WB = mm(d.wheelbaseMm);
  const z1 = mm(d.widthMm / 2) + 0.3;
  const z2 = z1 + 0.28;
  const y = 0.012;
  const pts = useMemo(() => {
    const p: number[] = [];
    const tickZ = (x: number, z: number) => p.push(x, y, z - 0.06, x, y, z + 0.06);
    const segX = (a: number, b: number, z: number) => {
      p.push(a, y, z, b, y, z);
      tickZ(a, z);
      tickZ(b, z);
    };
    segX(xF, 0, z1);
    segX(0, -WB, z1);
    segX(-WB, xR, z1);
    segX(xF, xR, z2);
    // track across the front, width across the tail
    const xt = xF + 0.35;
    p.push(xt, y, -mm(d.trackFMm / 2), xt, y, mm(d.trackFMm / 2));
    for (const s of [-1, 1])
      p.push(xt - 0.06, y, (s * mm(d.trackFMm)) / 2, xt + 0.06, y, (s * mm(d.trackFMm)) / 2);
    const xw = xR - 0.35;
    p.push(xw, y, -mm(d.widthMm / 2), xw, y, mm(d.widthMm / 2));
    for (const s of [-1, 1])
      p.push(xw - 0.06, y, (s * mm(d.widthMm)) / 2, xw + 0.06, y, (s * mm(d.widthMm)) / 2);
    // height at the tail corner
    const zh = mm(d.widthMm / 2);
    p.push(
      xw,
      0,
      zh,
      xw,
      mm(d.heightMm),
      zh,
      xw - 0.06,
      mm(d.heightMm),
      zh,
      xw + 0.06,
      mm(d.heightMm),
      zh,
    );
    return p;
  }, [d, xF, xR, WB, z1, z2]);
  const rearOH = d.lengthMm - d.overhangFMm - d.wheelbaseMm;
  return (
    <>
      <Lines pts={pts} material={overlayLine('ink', 0.85)} />
      <Tag at={[xF / 2, y + 0.06, z1]}>{fmt(d.overhangFMm)}</Tag>
      <Tag at={[-WB / 2, y + 0.06, z1]}>
        {fmt(d.wheelbaseMm)}
        <small>wheelbase</small>
      </Tag>
      <Tag at={[(-WB + xR) / 2, y + 0.06, z1]}>{fmt(rearOH)}</Tag>
      <Tag at={[(xF + xR) / 2, y + 0.06, z2]}>
        {fmt(d.lengthMm)}
        <small>length</small>
      </Tag>
      <Tag at={[xF + 0.35, y + 0.06, 0]}>
        {fmt(d.trackFMm)}
        <small>track</small>
      </Tag>
      <Tag at={[xR - 0.35, y + 0.06, 0]}>
        {fmt(d.widthMm)}
        <small>width</small>
      </Tag>
      <Tag at={[xR - 0.35, mm(d.heightMm) / 2, mm(d.widthMm / 2)]}>
        {fmt(d.heightMm)}
        <small>height</small>
      </Tag>
    </>
  );
}

// ───────────────────────────── yaw inertia ─────────────────────────────

function Inertia({ mass }: { mass: MassProps }) {
  const k = Math.sqrt(mass.izzKgM2 / mass.totalKg);
  const [cx, cy, cz] = mmVec(mass.cgMm);
  const r = 0.11 * Math.cbrt(mass.totalKg / 1500);
  const fill = overlayFill(SYSTEM_COLORS.engine, 0.85, true);
  const arc = useMemo(() => {
    const p: number[] = [];
    const R = k * 0.55;
    const n = 48;
    const a0 = 0.2;
    const a1 = Math.PI * 1.6;
    let prev: Vec3 | null = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const q: Vec3 = [cx + R * Math.cos(a), cy + 0.32, cz + R * Math.sin(a)];
      if (prev) p.push(...prev, ...q);
      prev = q;
    }
    // arrowhead at the end
    const a = a1;
    const tip: Vec3 = [cx + R * Math.cos(a), cy + 0.32, cz + R * Math.sin(a)];
    const t: Vec3 = [-Math.sin(a), 0, Math.cos(a)];
    const nrm: Vec3 = [Math.cos(a), 0, Math.sin(a)];
    for (const s of [-1, 1]) {
      p.push(
        ...tip,
        tip[0] - t[0] * 0.09 + s * nrm[0] * 0.05,
        tip[1],
        tip[2] - t[2] * 0.09 + s * nrm[2] * 0.05,
      );
    }
    return p;
  }, [k, cx, cy, cz]);
  return (
    <>
      <mesh
        geometry={G.cylLo}
        material={fill}
        position={[cx, cy, cz]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.012, 2 * k, 0.012]}
        renderOrder={13}
      />
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={G.sphere}
          material={fill}
          position={[cx + s * k, cy, cz]}
          scale={r}
          renderOrder={13}
        />
      ))}
      <Lines pts={arc} material={overlayLine('engine', 0.9)} />
      <Tag at={[cx, cy + 0.45, cz]} tone="flow">
        {fmt(mass.izzKgM2)}
        <small>kg·m² · k {k.toFixed(2)} m</small>
      </Tag>
    </>
  );
}

// ───────────────────────────── floor plan ─────────────────────────────

const PLAN_KINDS: PlacedPart['kind'][] = ['engine', 'gearbox', 'motor', 'battery', 'fuel-tank'];
const PLAN_SYS = {
  engine: 'engine',
  gearbox: 'gearbox',
  motor: 'motor',
  battery: 'battery',
  'fuel-tank': 'fuel',
} as const;

function Floorplan({
  v,
  layout,
  shell,
  seats,
}: {
  v: VehicleSpec;
  layout: PowertrainLayout;
  shell: Shell;
  seats: Seat[];
}) {
  const s = shell.shape;
  const y = 0.006;
  const outline = useMemo(() => {
    const p: number[] = [];
    const n = 90;
    const xs = Array.from({ length: n + 1 }, (_, i) => s.c.xR + ((s.c.xF - s.c.xR) * i) / n);
    for (const sg of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const za = (s.halfW(xs[i]) + s.flare(xs[i])) * sg;
        const zb = (s.halfW(xs[i + 1]) + s.flare(xs[i + 1])) * sg;
        p.push(mm(xs[i]), y, mm(za), mm(xs[i + 1]), y, mm(zb));
      }
    }
    return p;
  }, [s]);
  const cabin = useMemo(() => {
    const front = Math.max(...seats.map((q) => q.x)) + 650;
    const rear = Math.min(...seats.map((q) => q.x)) - 280;
    const w = 0.82 * v.dims.widthMm;
    return { x: (front + rear) / 2, len: front - rear, w };
  }, [seats, v]);
  const parts = layout.parts.filter((p) => PLAN_KINDS.includes(p.kind));
  const drivetrainLen = useMemo(() => {
    // union of the powertrain footprints along X
    const iv = parts
      .map((p) => {
        const c = Math.abs(Math.cos(p.yawDeg * DEG));
        const half = (c * p.sizeMm[0] + (1 - c) * p.sizeMm[2]) / 2;
        const cx = p.posMm[0] + Math.cos(p.yawDeg * DEG) * (p.boxOffsetMm?.[0] ?? 0);
        return [cx - half, cx + half] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let cur: [number, number] | null = null;
    for (const r of iv) {
      if (!cur || r[0] > cur[1]) {
        if (cur) total += cur[1] - cur[0];
        cur = [r[0], r[1]];
      } else cur[1] = Math.max(cur[1], r[1]);
    }
    if (cur) total += cur[1] - cur[0];
    return total;
  }, [parts]);
  const L = v.dims.lengthMm;
  return (
    <>
      <Lines pts={outline} material={overlayLine('ink', 0.7)} />
      <mesh
        geometry={G.box}
        material={overlayFill(SYSTEM_COLORS.occupant, 0.35)}
        position={[mm(cabin.x), y, 0]}
        scale={[mm(cabin.len), 0.002, mm(cabin.w)]}
      />
      {parts.map((p) => {
        const off = p.boxOffsetMm ?? [0, 0, 0];
        const yaw = p.yawDeg * DEG;
        const cx = p.posMm[0] + Math.cos(yaw) * off[0] + Math.sin(yaw) * off[2];
        const cz = p.posMm[2] - Math.sin(yaw) * off[0] + Math.cos(yaw) * off[2];
        return (
          <mesh
            key={p.id}
            geometry={G.box}
            material={overlayFill(SYSTEM_COLORS[PLAN_SYS[p.kind as keyof typeof PLAN_SYS]], 0.75)}
            position={[mm(cx), y + 0.002, mm(cz)]}
            rotation={[0, yaw, 0]}
            scale={[mm(p.sizeMm[0]), 0.002, mm(p.sizeMm[2])]}
          />
        );
      })}
      <Tag at={[mm(cabin.x), 0.05, -mm(cabin.w / 2) - 0.15]}>
        cabin {Math.round((100 * cabin.len) / L)}%<small>of length</small>
      </Tag>
      <Tag at={[mm(cabin.x), 0.05, mm(cabin.w / 2) + 0.15]} tone="flow">
        drivetrain {Math.round((100 * drivetrainLen) / L)}%
      </Tag>
    </>
  );
}

// ───────────────────────────── bay fit ─────────────────────────────

const TONE: Record<FitStatus, 'ok' | 'warn' | 'bad'> = { ok: 'ok', tight: 'warn', clash: 'bad' };
const COLOR: Record<FitStatus, string> = { ok: '#06d6a0', tight: '#ffb703', clash: '#ef476f' };

function boxLines(c: Vec3, s: Vec3): number[] {
  const [x, y, z] = c;
  const [a, b, d] = [s[0] / 2, s[1] / 2, s[2] / 2];
  const v = [
    [x - a, y - b, z - d],
    [x + a, y - b, z - d],
    [x + a, y + b, z - d],
    [x - a, y + b, z - d],
    [x - a, y - b, z + d],
    [x + a, y - b, z + d],
    [x + a, y + b, z + d],
    [x - a, y + b, z + d],
  ];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  return e.flatMap((i) => v[i]);
}

function BayFit({ base, engineId }: { base: VehicleSpec; engineId?: string }) {
  const fit = useMemo(() => checkFit(base, engineId), [base, engineId]);
  if (!fit) return null;
  const bay = { c: mmVec(fit.bay.centerMm), s: mmVec(fit.bay.sizeMm) };
  const need = { c: mmVec(fit.need.centerMm), s: mmVec(fit.need.sizeMm) };
  const clashFill = overlayFill(COLOR.clash, 0.45);
  const slabs: { c: Vec3; s: Vec3 }[] = [];
  // the slices of the engine package that stick out of the bay
  if (fit.along.margin < 0) {
    const over = -mm(fit.along.margin) / 2;
    for (const sg of [-1, 1])
      slabs.push({
        c: [bay.c[0] + sg * (bay.s[0] / 2 + over / 2), need.c[1], need.c[2]],
        s: [over, need.s[1], need.s[2]],
      });
  }
  if (fit.across.margin < 0) {
    const over = -mm(fit.across.margin) / 2;
    for (const sg of [-1, 1])
      slabs.push({
        c: [need.c[0], need.c[1], sg * (bay.s[2] / 2 + over / 2)],
        s: [need.s[0], need.s[1], over],
      });
  }
  const room = (m: number, dir: string) => (
    <>
      {fmt(Math.abs(m))}
      <small>
        mm {m >= 0 ? 'spare' : 'over'} {dir}
      </small>
    </>
  );
  return (
    <>
      <Lines pts={boxLines(bay.c, bay.s)} material={overlayLine('ink', 0.9)} />
      <Lines
        pts={boxLines(need.c, need.s)}
        material={overlayLine(
          fit.status === 'clash' ? 'brake' : fit.status === 'tight' ? 'shaft' : 'wheel-driven',
          0.95,
        )}
      />
      <mesh
        geometry={G.box}
        material={overlayFill(COLOR[fit.status], 0.12)}
        position={need.c}
        scale={need.s}
      />
      {slabs.map((sl, i) => (
        <mesh key={i} geometry={G.box} material={clashFill} position={sl.c} scale={sl.s} />
      ))}
      <Tag
        at={[need.c[0], need.c[1] + need.s[1] / 2 + 0.08, bay.c[2] + bay.s[2] / 2]}
        tone={TONE[fit.across.status]}
      >
        {room(fit.across.margin, 'across')}
      </Tag>
      <Tag
        at={[bay.c[0] + bay.s[0] / 2, need.c[1] + need.s[1] / 2 + 0.08, 0]}
        tone={TONE[fit.along.status]}
      >
        {room(fit.along.margin, 'along')}
      </Tag>
    </>
  );
}

// ───────────────────────────── all ─────────────────────────────

export interface OverlaysProps {
  kinds: OverlayKind[];
  /** the vehicle as shown (engine swap applied) */
  vehicle: VehicleSpec;
  /** the catalog vehicle (fit check swaps into it) */
  base: VehicleSpec;
  layout: PowertrainLayout;
  mass: MassProps | null;
  shell: Shell;
  seats: Seat[];
}

export function Overlays({ kinds, vehicle, base, layout, mass, shell, seats }: OverlaysProps) {
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const on = (k: OverlayKind) => kinds.includes(k);
  return (
    <>
      {on('cg') && mass && <Cg mass={mass} />}
      {on('axle-loads') && mass && <AxleLoads v={vehicle} mass={mass} />}
      {on('dimensions') && <Dimensions v={vehicle} />}
      {on('inertia') && mass && <Inertia mass={mass} />}
      {on('floorplan') && <Floorplan v={vehicle} layout={layout} shell={shell} seats={seats} />}
      {on('bay-fit') && <BayFit base={base} engineId={swap} />}
      {on('torque-flow') && <TorqueFlowOverlay vehicle={vehicle} layout={layout} />}
    </>
  );
}

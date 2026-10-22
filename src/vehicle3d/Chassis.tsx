/**
 * Chassis around the drivetrain: floor/frame per chassis kind, simplified suspension per
 * corner, steering rack and column, radiators with their (sometimes very long) coolant pipes,
 * and the exhaust run. All placed from the spec + body shell; nothing here carries mass.
 */
import { useEffect, useMemo } from 'react';
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { ghostMat, sysMat } from '../scene/materials';
import type { System } from '../scene/palette';
import { Part } from './partIds';
import type { PowertrainLayout, SuspensionKind, Vec3, VehicleSpec } from '../spec/types';
import { mmVec } from '../spec/units';
import { G, span } from './geom';
import { coolingPlan, exhaustPlan, type Seat } from './packaging';
import { mergeGeos } from './shell/merge';
import type { Shell } from './shell/build';

const M = 0.001;

interface Seg {
  a: Vec3;
  b: Vec3;
  /** radius, mm */
  r: number;
}

/** Thin rods between points (mm in, metres out). */
function Rods({ segs, system }: { segs: Seg[]; system: System }) {
  return (
    <>
      {segs.map((s, i) => {
        const st = span(mmVec(s.a), mmVec(s.b));
        return (
          <mesh
            key={i}
            geometry={G.cylLo}
            material={sysMat(system, 'metal')}
            position={st.position}
            quaternion={st.quaternion}
            scale={[s.r * M, st.length, s.r * M]}
            castShadow
          />
        );
      })}
    </>
  );
}

function tubes(runs: Vec3[][], r: number): BufferGeometry | null {
  // drop repeated waypoints: a zero-length span gives the tube NaN frames
  const clean = runs.map((run) =>
    run.filter(
      (p, i) =>
        i === 0 || Math.hypot(p[0] - run[i - 1][0], p[1] - run[i - 1][1], p[2] - run[i - 1][2]) > 5,
    ),
  );
  const list = clean
    .filter((run) => run.length >= 2)
    .map((run) => {
      const curve = new CatmullRomCurve3(
        run.map((p) => new Vector3(p[0] * M, p[1] * M, p[2] * M)),
        false,
        'catmullrom',
        0.15,
      );
      return new TubeGeometry(curve, Math.max(12, run.length * 14), r * M, 8, false);
    });
  const g = mergeGeos(list);
  list.forEach((t) => t.dispose());
  return g;
}

function useTubes(runs: Vec3[][], r: number) {
  const g = useMemo(() => tubes(runs, r), [runs, r]);
  useEffect(() => () => g?.dispose(), [g]);
  return g;
}

const helices = new Map<number, BufferGeometry>();
/** Unit coil spring (radius 1, height 1, along +Y); scale per use. */
function springGeo(turns = 6): BufferGeometry {
  let g = helices.get(turns);
  if (!g) {
    const pts: Vector3[] = [];
    const n = turns * 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      pts.push(new Vector3(Math.cos(a), t - 0.5, Math.sin(a)));
    }
    g = new TubeGeometry(new CatmullRomCurve3(pts), n, 0.09, 6, false);
    helices.set(turns, g);
  }
  return g;
}

function Spring({ a, b, r }: { a: Vec3; b: Vec3; r: number }) {
  const st = span(mmVec(a), mmVec(b));
  return (
    <mesh
      geometry={springGeo()}
      material={sysMat('suspension', 'metal')}
      position={st.position}
      quaternion={st.quaternion}
      scale={[r * M, st.length, r * M]}
    />
  );
}

const KIND_LABEL: Record<SuspensionKind, string> = {
  macpherson: 'MacPherson strut',
  'double-wishbone': 'double wishbone',
  multilink: 'multi-link',
  'twist-beam': 'twist beam',
  'solid-axle': 'solid axle',
  'trailing-arm': 'trailing arm',
  pushrod: 'pushrod',
};

export function suspensionKinds(v: VehicleSpec): { front: SuspensionKind; rear: SuspensionKind } {
  if (v.suspension) return v.suspension;
  const st = v.body.style;
  if (st === 'offroader') return { front: 'solid-axle', rear: 'solid-axle' };
  if (st === 'supercar') return { front: 'double-wishbone', rear: 'double-wishbone' };
  return { front: 'macpherson', rear: st === 'city' ? 'twist-beam' : 'multilink' };
}

/** One corner's links, springs and dampers (mm). */
function corner(
  kind: SuspensionKind,
  xa: number,
  R: number,
  t: number,
  tw: number,
  s: number,
  front: boolean,
) {
  const hub = s * (t / 2 - tw / 2 - 45);
  const inb = (d: number) => s * (t / 2 - d);
  const rods: Seg[] = [];
  const springs: { a: Vec3; b: Vec3; r: number }[] = [];
  const dampers: Seg[] = [];
  const lowerA = () => {
    rods.push({ a: [xa, R - 130, hub], b: [xa + 170, R - 150, inb(430)], r: 14 });
    rods.push({ a: [xa, R - 130, hub], b: [xa - 220, R - 150, inb(410)], r: 14 });
  };
  switch (kind) {
    case 'macpherson': {
      lowerA();
      const top: Vec3 = [xa - 40, R + 560, s * (t / 2 - tw / 2 - 150)];
      const bot: Vec3 = [xa, R + 40, hub - s * 10];
      dampers.push({ a: bot, b: top, r: 26 });
      springs.push({
        a: [xa - 22, R + 300, (bot[2] + top[2]) / 2 + s * 5],
        b: [xa - 38, R + 540, top[2]],
        r: 72,
      });
      break;
    }
    case 'double-wishbone':
    case 'pushrod': {
      lowerA();
      rods.push({ a: [xa, R + 150, hub], b: [xa + 140, R + 190, inb(380)], r: 12 });
      rods.push({ a: [xa, R + 150, hub], b: [xa - 160, R + 190, inb(380)], r: 12 });
      const a: Vec3 = [xa, R - 110, s * (t / 2 - tw / 2 - 150)];
      const b: Vec3 = [xa, R + 360, inb(330)];
      dampers.push({ a, b, r: 22 });
      springs.push({ a: [xa, R + 40, (a[2] + b[2]) / 2], b: [xa, R + 320, b[2]], r: 60 });
      break;
    }
    case 'multilink': {
      rods.push({ a: [xa, R - 120, hub], b: [xa + 50, R - 110, inb(430)], r: 13 });
      rods.push({ a: [xa + 20, R + 140, hub], b: [xa + 80, R + 170, inb(380)], r: 11 });
      rods.push({ a: [xa - 120, R - 40, hub], b: [xa - 140, R - 40, inb(420)], r: 10 });
      rods.push({ a: [xa, R - 60, hub], b: [xa + (front ? -420 : 420), R - 20, inb(330)], r: 12 });
      springs.push({
        a: [xa - 70, R - 100, inb(tw / 2 + 210)],
        b: [xa - 70, R + 190, inb(tw / 2 + 210)],
        r: 60,
      });
      dampers.push({
        a: [xa + 80, R - 120, inb(tw / 2 + 90)],
        b: [xa + 80, R + 360, inb(tw / 2 + 110)],
        r: 20,
      });
      break;
    }
    case 'twist-beam': {
      rods.push({ a: [xa, R, hub], b: [xa + 460, R + 20, inb(260)], r: 22 });
      rods.push({ a: [xa + 190, R - 30, hub], b: [xa + 190, R - 30, 0], r: 30 });
      springs.push({
        a: [xa - 60, R - 60, inb(tw / 2 + 200)],
        b: [xa - 60, R + 180, inb(tw / 2 + 200)],
        r: 62,
      });
      dampers.push({
        a: [xa - 130, R - 80, inb(tw / 2 + 100)],
        b: [xa - 160, R + 330, inb(tw / 2 + 120)],
        r: 20,
      });
      break;
    }
    case 'solid-axle': {
      rods.push({ a: [xa, R, 0], b: [xa, R, hub], r: 46 });
      rods.push({
        a: [xa, R - 90, inb(300)],
        b: [xa + (front ? -650 : 650), R - 60, inb(340)],
        r: 16,
      });
      rods.push({
        a: [xa, R + 110, inb(430)],
        b: [xa + (front ? -550 : 550), R + 150, inb(470)],
        r: 14,
      });
      springs.push({ a: [xa, R + 60, inb(330)], b: [xa, R + 480, inb(330)], r: 88 });
      dampers.push({ a: [xa + 120, R - 40, inb(240)], b: [xa + 120, R + 460, inb(240)], r: 22 });
      break;
    }
    case 'trailing-arm': {
      rods.push({ a: [xa, R, hub], b: [xa + 500, R, inb(300)], r: 22 });
      springs.push({
        a: [xa + 80, R - 60, inb(tw / 2 + 180)],
        b: [xa + 80, R + 200, inb(tw / 2 + 180)],
        r: 62,
      });
      dampers.push({
        a: [xa - 80, R - 80, inb(tw / 2 + 100)],
        b: [xa - 100, R + 330, inb(tw / 2 + 120)],
        r: 20,
      });
      break;
    }
  }
  return { rods, springs, dampers, knuckle: [xa, R, hub] as Vec3 };
}

export interface ChassisProps {
  vehicle: VehicleSpec;
  layout: PowertrainLayout;
  shell: Shell;
  seats: Seat[];
}

export function Chassis({ vehicle: v, layout, shell, seats }: ChassisProps) {
  const s = shell.shape;
  const { xF, xR, W, WB, R, clear } = s.c;
  const kinds = suspensionKinds(v);
  const chassis = v.chassis ?? 'monocoque';

  const corners = useMemo(() => {
    const out: { id: string; label: string; side: number; c: ReturnType<typeof corner> }[] = [];
    for (const axle of ['front', 'rear'] as const) {
      const xa = axle === 'front' ? 0 : -WB;
      const t = axle === 'front' ? v.dims.trackFMm : v.dims.trackRMm;
      const tw = axle === 'front' ? v.tires.widthFMm : v.tires.widthRMm;
      for (const side of [-1, 1]) {
        out.push({
          id: `suspension-${axle}-${side < 0 ? 'left' : 'right'}`,
          label: `${axle === 'front' ? 'Front' : 'Rear'} suspension (${KIND_LABEL[kinds[axle]]})`,
          side,
          c: corner(kinds[axle], xa, R, t, tw, side, axle === 'front'),
        });
      }
    }
    return out;
  }, [v, WB, R, kinds]);

  // steering: rack behind the axle for front engines, ahead of it otherwise; column to the driver
  const steer = useMemo(() => {
    const pt = v.powertrain;
    const frontEngine = pt.kind === 'ice' && pt.position.startsWith('front');
    const xr = frontEngine ? -150 : 120;
    const half = v.dims.trackFMm / 2 - 330;
    const rods: Seg[] = [
      { a: [xr, R + 30, -half], b: [xr, R + 30, half], r: 26 },
      {
        a: [xr, R + 30, -half],
        b: [xr / 2, R + 20, -(v.dims.trackFMm / 2 - v.tires.widthFMm / 2 - 55)],
        r: 11,
      },
      {
        a: [xr, R + 30, half],
        b: [xr / 2, R + 20, v.dims.trackFMm / 2 - v.tires.widthFMm / 2 - 55],
        r: 11,
      },
    ];
    const d = seats.find((q) => q.driver);
    let wheel: { at: Vec3; tilt: number } | null = null;
    if (d) {
      const at: Vec3 = [d.x + 430 * d.scale + 80, d.y + 330, d.z];
      rods.push({ a: [xr, R + 30, d.z * 0.55], b: [at[0] + 220, at[1] - 140, d.z], r: 14 });
      rods.push({ a: [at[0] + 220, at[1] - 140, d.z], b: at, r: 16 });
      wheel = { at, tilt: 0.42 };
    }
    return { rods, wheel };
  }, [v, R, seats]);

  const cooling = useMemo(() => coolingPlan(v, s, layout), [v, s, layout]);
  const coolPipes = useTubes(cooling.pipes, 16);
  const exhaust = useMemo(
    () =>
      exhaustPlan(
        v,
        s,
        layout,
        shell.tips.map((t) => [t.pos[0] / M, t.pos[1] / M, t.pos[2] / M] as Vec3),
      ),
    [v, s, layout, shell],
  );
  const exhaustTubes = useTubes(exhaust?.runs ?? [], 27);

  const frame = useMemo(() => {
    const rods: Seg[] = [];
    const boxes: { c: Vec3; size: Vec3; ghost?: boolean }[] = [];
    const archF = s.c.wheels[0].archR;
    const archR = s.c.wheels[1].archR;
    if (chassis === 'ladder-frame') {
      const y = clear + 130;
      for (const sgn of [-1, 1])
        rods.push({
          a: [xF - 160, y + 40, sgn * 0.28 * W],
          b: [xR + 160, y, sgn * 0.28 * W],
          r: 45,
        });
      for (const x of [xF - 260, -260, -0.38 * WB, -0.72 * WB, -WB + 260, xR + 260])
        rods.push({ a: [x, y + 20, -0.28 * W], b: [x, y + 20, 0.28 * W], r: 30 });
    } else {
      const sillLen = WB - archF - archR - 60;
      const sillX = -archF - 30 - sillLen / 2;
      for (const sgn of [-1, 1])
        boxes.push({ c: [sillX, s.bottom(sillX) + 95, sgn * 0.445 * W], size: [sillLen, 150, 95] });
      boxes.push({
        c: [-WB / 2, s.bottom(-WB / 2) + 30, 0],
        size: [WB - 2 * archF, 26, 0.84 * W],
        ghost: true,
      });
      // subframes under each axle
      for (const xa of [0, -WB]) {
        const y = R - 150;
        for (const sgn of [-1, 1])
          rods.push({ a: [xa + 260, y, sgn * 0.21 * W], b: [xa - 260, y, sgn * 0.21 * W], r: 20 });
        for (const dx of [-240, 240])
          rods.push({ a: [xa + dx, y, -0.21 * W], b: [xa + dx, y, 0.21 * W], r: 18 });
      }
      if (chassis === 'spaceframe') {
        const [cr, cf] = s.p.cabin;
        const pts = (x: number, sgn: number, h: 'belt' | 'roof'): Vec3 =>
          h === 'belt'
            ? [x, s.belt(x) - 30, sgn * Math.max(0, s.outerZ(x, s.belt(x) - 30) - 60)]
            : [x, s.roofEdge(x) - 35, sgn * Math.max(0, s.ghHalfW(x) - 60)];
        for (const sgn of [-1, 1]) {
          const xs = [cf, (cf + cr) / 2, cr];
          for (let i = 0; i < xs.length - 1; i++)
            rods.push({ a: pts(xs[i], sgn, 'belt'), b: pts(xs[i + 1], sgn, 'belt'), r: 20 });
          const roofXs = [cf - 0.35 * (cf - cr), (cf + cr) / 2, cr + 0.1 * (cf - cr)];
          rods.push({ a: pts(cf, sgn, 'belt'), b: pts(roofXs[0], sgn, 'roof'), r: 20 });
          rods.push({ a: pts(roofXs[0], sgn, 'roof'), b: pts(roofXs[2], sgn, 'roof'), r: 20 });
          rods.push({ a: pts(roofXs[2], sgn, 'roof'), b: pts(cr, sgn, 'belt'), r: 20 });
          rods.push({
            a: [cf, s.bottom(cf) + 120, sgn * 0.44 * W],
            b: pts(cf, sgn, 'belt'),
            r: 20,
          });
          rods.push({
            a: [cr, s.bottom(cr) + 120, sgn * 0.44 * W],
            b: pts(cr, sgn, 'belt'),
            r: 20,
          });
        }
      }
      if (chassis === 'carbon-tub') {
        const [cr, cf] = s.p.cabin;
        const x0 = cf + 150;
        const x1 = Math.max(cr, seats.length ? Math.min(...seats.map((q) => q.x)) - 250 : cr);
        boxes.push({
          c: [(x0 + x1) / 2, s.bottom((x0 + x1) / 2) + 220, 0],
          size: [x0 - x1, 420, 0.86 * W],
        });
      }
    }
    return { rods, boxes };
  }, [chassis, s, xF, xR, W, WB, R, clear, seats]);

  const chassisLabel =
    chassis === 'ladder-frame'
      ? 'Ladder frame'
      : chassis === 'spaceframe'
        ? 'Aluminium space frame'
        : chassis === 'carbon-tub'
          ? 'Carbon tub'
          : 'Floor pan & subframes';

  return (
    <>
      <Part id="chassis" system="chassis" label={chassisLabel}>
        <Rods segs={frame.rods} system="chassis" />
        {frame.boxes.map((b, i) => (
          <mesh
            key={i}
            geometry={G.box}
            material={b.ghost ? ghostMat('chassis', 0.35) : sysMat('chassis', 'satin')}
            position={mmVec(b.c)}
            scale={mmVec(b.size)}
          />
        ))}
      </Part>

      {corners.map(({ id, label, side, c }) => (
        <Part
          key={id}
          id={id}
          system="suspension"
          label={label}
          explode={{ dir: [0, 0, side], dist: 0.32, stage: 3 }}
        >
          <mesh
            geometry={G.box}
            material={sysMat('suspension', 'satin')}
            position={mmVec(c.knuckle)}
            scale={[0.09, 0.22, 0.06]}
          />
          <Rods segs={c.rods} system="suspension" />
          {c.dampers.map((d, i) => {
            const st = span(mmVec(d.a), mmVec(d.b));
            return (
              <mesh
                key={i}
                geometry={G.cylLo}
                material={sysMat('chassis', 'metal')}
                position={st.position}
                quaternion={st.quaternion}
                scale={[d.r * M, st.length, d.r * M]}
              />
            );
          })}
          {c.springs.map((sp, i) => (
            <Spring key={i} a={sp.a} b={sp.b} r={sp.r} />
          ))}
        </Part>
      ))}

      <Part
        id="steering"
        system="chassis"
        label="Steering rack & column"
        explode={{ dir: [0, 1, 0], dist: 0.25, stage: 1 }}
      >
        <Rods segs={steer.rods} system="chassis" />
        {steer.wheel && (
          <mesh
            geometry={G.torus}
            material={sysMat('chassis', 'rubber')}
            position={mmVec(steer.wheel.at)}
            rotation={[0, Math.PI / 2, steer.wheel.tilt]}
            rotation-order="ZYX"
            scale={[0.185, 0.185, 0.185]}
          />
        )}
      </Part>

      {/* radiators and exhaust in glass: supporting cast, never louder than the engine */}
      <Part
        id="cooling"
        system="cooling"
        label={
          cooling.radiators.length > 1 ? 'Radiators & coolant pipes' : 'Radiator & coolant pipes'
        }
        explode={{ dist: 0.3, stage: 2 }}
      >
        {cooling.radiators.map((r, i) => (
          <mesh
            key={i}
            geometry={G.box}
            material={ghostMat('cooling', 0.4)}
            position={mmVec(r.center)}
            rotation={[0, r.yaw, 0]}
            scale={mmVec(r.size)}
            castShadow
          />
        ))}
        {coolPipes && <mesh geometry={coolPipes} material={ghostMat('cooling', 0.4)} />}
      </Part>

      {exhaust && (
        <Part
          id="exhaust"
          system="exhaust"
          label="Exhaust"
          explode={{ dir: [0, -1, 0], dist: 0.3, stage: 2 }}
        >
          {exhaustTubes && <mesh geometry={exhaustTubes} material={ghostMat('exhaust', 0.4)} />}
          {exhaust.boxes.map((b, i) => (
            <mesh
              key={i}
              geometry={G.cyl}
              material={ghostMat('exhaust', 0.4)}
              position={mmVec(b.center)}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[b.size[0] * 0.5 * M, b.size[2] * M, b.size[1] * 0.5 * M]}
            />
          ))}
        </Part>
      )}
    </>
  );
}

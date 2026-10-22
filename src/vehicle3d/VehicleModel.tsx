/**
 * <VehicleModel vehicle level part />: the look-alike car with its real drivetrain inside.
 * Same props/behaviour contract as the Phase 0 ProtoCar:
 *  - 'car' / 'drive': opaque painted shell (internals not drawn), wheels spin from vehiclePose
 *  - 'internals': x-ray shell, every component a clickable <Part> with its layout id, overlays
 *  - 'part': the zoomed component's own assembly follows the explode slider
 * Explode stages: body lifts & fades → cabin rises → powertrain separates → wheels/suspension out.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { Vector3, type Group } from 'three';
import type { OverlayKind } from '../content/types';
import type { Level } from '../explorer/view';
import { Assembly } from '../scene/Assembly';
import { CarSpan, Part, PartPrefix, Unseen, useCameraEnd } from './partIds';
import { engineRuntime, vehiclePose } from '../scene/runtime';
import { getEngine, getMotor } from '../spec/catalog';
import { awdPartId } from '../spec/derive/awd';
import { layoutPowertrain } from '../spec/derive/layout';
import { massProps } from '../spec/derive/mass';
import type { MassProps, PlacedPart, PowertrainLayout, Vec3, VehicleSpec } from '../spec/types';
import { DEG, mm, mmVec } from '../spec/units';
import { AwdFlow } from './awd/AwdFlow';
import { BodyFade, BodyShell, useVehicleTheme } from './Body';
import { Detailed } from './gltf/Fallback';
import { GltfBody, GltfWheel } from './gltf/GltfBody';
import { useModelLoad } from './gltf/load';
import { gltfUrl } from './gltf/manifest';
import { Cabin } from './Cabin';
import { Chassis } from './Chassis';
import { Component, HitBox, ShaftPart, SYSTEM_OF } from './Drivetrain';
import { EngineSlot, MotorSlot } from './EngineSlot';
import { withEngine } from './fit';
import { Overlays } from './overlays/Overlays';
import { seatPlan } from './packaging';
import { FadeGate, useSeeFade, WhileSeeThrough } from './seeFade';
import { getShell } from './shell/build';
import { FINAL_DRIVE, RoadSpin, SpinContext, SpinRegistry } from './spin';
import { useVehicleOverrides } from './store';
import { Wheel } from './Wheel';

export interface VehicleModelProps {
  vehicle: VehicleSpec;
  /** explorer zoom level (default 'internals') */
  level?: Level;
  /** zoomed-into part at level 'part' */
  part?: string;
  /** overlays to draw; default: the visitor's choice from useVehicleOverrides (internals only) */
  overlays?: OverlayKind[];
  /**
   * Prefix for every part id ("vs1:"): a second car in the same scene (a comparison) must not
   * share the explorer car's ids. Default none.
   */
  idPrefix?: string;
}

export const STAGES = 4;

function safeMass(v: VehicleSpec, layout: PowertrainLayout): MassProps | null {
  try {
    return massProps(v, layout);
  } catch {
    return null;
  }
}

/**
 * Body roll/pitch from the drive sim, applied to the sprung mass only, about a pivot at axle
 * height under the wheelbase midpoint, so the wheels stay planted on the road.
 */
/** Front wheels turn to the sim's road-wheel angle while driving, about their hub's vertical. */
function Steered({ on, children }: { on: boolean; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (g) g.rotation.y = on && vehiclePose.active ? vehiclePose.steer : 0;
  });
  return <group ref={ref}>{children}</group>;
}

function Sprung({ pivot, children }: { pivot: Vec3; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (vehiclePose.active) g.rotation.set(vehiclePose.roll, 0, vehiclePose.pitch, 'YXZ');
    else if (g.rotation.x !== 0 || g.rotation.z !== 0) g.rotation.set(0, 0, 0);
  });
  return (
    <group position={pivot}>
      <group ref={ref}>
        <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
      </group>
    </group>
  );
}

/**
 * One clock for every spinning shaft/wheel, advanced from the engine's crank angle; the road
 * wheels from the car's travel while it drives (RoadSpin).
 */
function useDriveClock(reg: SpinRegistry, radius: number) {
  const clock = useMemo(
    () => ({ last: engineRuntime.crankDeg, crank: 0, road: new RoadSpin() }),
    [],
  );
  useFrame(() => {
    let d = engineRuntime.crankDeg - clock.last;
    if (d < -360) d += 720;
    else if (d > 360) d -= 720;
    clock.last = engineRuntime.crankDeg;
    clock.crank = (clock.crank + d * DEG) % (Math.PI * 2 * 3 * FINAL_DRIVE * 10);
    const prop = clock.crank;
    const half = prop / FINAL_DRIVE;
    const p = vehiclePose;
    if (p.active) clock.road.update(p.x, p.z, p.yaw, radius);
    else clock.road.reset();
    const road = clock.road.shown;
    for (const s of reg.list) {
      const o = s.ref.current;
      if (!o) continue;
      const a =
        s.src === 'crank' ? clock.crank : s.src === 'prop' ? prop : s.src === 'half' ? half : road;
      o.rotation[s.axis] = a * s.dir;
    }
  });
}

/**
 * Which end of the car the camera looks from, kept in useCameraEnd for the labels ("All" leaves
 * out parts at the far end). `probe` sits at the vehicle frame's origin; `mid` is the car's
 * middle in that frame.
 */
function useCameraEndProbe(probe: { current: Group | null }, mid: number, on: boolean) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const g = probe.current;
    if (!on || !g) return;
    g.worldToLocal(v.copy(camera.position));
    const dx = v.x - mid;
    const end = Math.abs(dx) > 0.8 * Math.hypot(dx, v.z) ? (dx > 0 ? 'front' : 'rear') : null;
    if (useCameraEnd.getState().end !== end) useCameraEnd.setState({ end });
  });
}

export function VehicleModel({
  vehicle: base,
  level = 'internals',
  part,
  overlays,
  idPrefix = '',
}: VehicleModelProps) {
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const chosen = useVehicleOverrides((s) => s.overlays);
  const vehicle = useMemo(() => withEngine(base, swap), [base, swap]);
  const layout = useMemo(() => layoutPowertrain(vehicle), [vehicle]);
  const mass = useMemo(() => safeMass(vehicle, layout), [vehicle, layout]);
  const shell = useMemo(() => getShell(base), [base]);
  const seats = useMemo(() => seatPlan(vehicle, shell.shape), [vehicle, shell]);
  /** the centre diff / coupling: zoomed in, it shows the AWD explainer */
  const awdPart = useMemo(() => awdPartId(vehicle), [vehicle]);
  const reg = useMemo(() => new SpinRegistry(), []);
  useDriveClock(reg, mm(base.tires.diameterMm / 2));
  // which end the camera is at, for the labels (the explorer's own car only)
  const probe = useRef<Group>(null);
  const L0 = mm(base.dims.wheelbaseMm);
  useCameraEndProbe(probe, -L0 / 2, !idPrefix);
  const span = useMemo(() => ({ mid: -L0 / 2, end: L0 * 0.2 }), [L0]);

  const L = mm(vehicle.dims.wheelbaseMm);
  const pt = vehicle.powertrain;
  const engine = pt.kind === 'ice' ? getEngine(pt.engine) : null;
  const exterior = level === 'car' || level === 'drive';
  // zoomed into a part, another car's parts jump to their places rather than glide there: the
  // zoomed one alone is on show, and the camera can frame it at once instead of chasing it
  const zoomed = level === 'part';
  const inside = !exterior;
  // see-through on/off crossfades rather than switching: the painted body fades over the x-ray
  const fade = useSeeFade(inside);
  // at the car level the overlays only stay while the x-ray fades back out
  const shown = overlays ?? (level === 'internals' || level === 'car' ? chosen : []);
  const sporty = ['coupe', 'supercar', 'roadster'].includes(vehicle.body.style);
  /** the detailed glTF body, if this car has one (else the procedural look-alike) */
  const detailed = gltfUrl(base.id);
  // the drivetrain waits for the detailed body: alone for a second it read as floating blobs
  const bodyIn = useModelLoad((st) => !detailed || st[detailed]?.state === 'ready');
  useVehicleTheme();
  const motorOf = (p: PlacedPart) => {
    const m = pt.kind === 'ev' ? pt.motors.find((x) => x.axle === p.axle) : undefined;
    return m ? getMotor(m.motor) : null;
  };

  const wheel = (p: PlacedPart) => {
    const side = Math.sign(p.posMm[2]) || 1;
    const R = mm(p.sizeMm[0] / 2);
    const rimFrac = vehicle.body.style === 'offroader' ? 0.62 : sporty ? 0.76 : 0.7;
    return (
      <Part
        key={p.id}
        id={p.id}
        system={p.driven ? 'wheel-driven' : 'wheel'}
        label={`${p.label}${p.driven ? ' (driven)' : ''}`}
        position={mmVec(p.posMm)}
        morph={!zoomed}
        explode={{ dir: [0, 0, side], dist: 0.5, stage: 3 }}
      >
        <Steered on={p.axle === 'front'}>
          {/* the wheels change look halfway through the see-through crossfade */}
          <FadeGate fade={fade}>
            {(xray) =>
              detailed ? (
                <Detailed url={detailed}>
                  <GltfWheel
                    id={base.id}
                    corner={p.id.replace(/^wheel-/, '')}
                    at={mmVec(p.posMm)}
                    driven={!!p.driven}
                    xray={xray}
                    spin={xray && !!p.driven}
                  />
                </Detailed>
              ) : (
                <Wheel
                  R={R}
                  w={mm(p.sizeMm[2])}
                  rimR={R * rimFrac}
                  side={side}
                  driven={!!p.driven}
                  xray={xray}
                  caliperAft={p.axle === 'front'}
                  spin={xray && !!p.driven}
                  dark={vehicle.body.style === 'offroader'}
                />
              )
            }
          </FadeGate>
        </Steered>
        {level === 'internals' && <HitBox p={p} pad={1} />}
      </Part>
    );
  };

  return (
    <PartPrefix.Provider value={idPrefix}>
      <SpinContext.Provider value={reg}>
        {/* centre the wheelbase on the origin so cameras can stay put while cars change */}
        <Assembly
          stages={STAGES}
          position={[L / 2, 0, 0]}
          center={[-L / 2, 0.45, 0]}
          explode={level === 'internals' ? undefined : 0}
        >
          <group ref={probe} />
          <CarSpan.Provider value={span}>
            <Sprung pivot={[-L / 2, mm(vehicle.tires.diameterMm / 2), 0]}>
              <Part
                id="body"
                system="body"
                label={vehicle.name}
                // clickable only as the entry point: a moving car under a resting pointer would
                // flash its hover outline in drive mode
                interactive={level === 'car'}
                explode={{ dir: [0, 1, 0], dist: 1.25, stage: 0 }}
              >
                {detailed ? (
                  <Detailed url={detailed}>
                    {/* both bodies stay mounted: switching see-through only crossfades them */}
                    <GltfBody
                      id={base.id}
                      paint={vehicle.body.paint ?? '#9aa5b1'}
                      exterior
                      fade={fade}
                    />
                    <GltfBody
                      id={base.id}
                      paint={vehicle.body.paint ?? '#9aa5b1'}
                      exterior={false}
                      fade={fade}
                    />
                    <BodyFade stages={STAGES} fade={fade} />
                  </Detailed>
                ) : (
                  <FadeGate fade={fade}>
                    {(xray) => (
                      <BodyShell
                        vehicle={base}
                        shell={shell}
                        exterior={!xray}
                        stages={STAGES}
                        fade={fade}
                      />
                    )}
                  </FadeGate>
                )}
              </Part>

              <WhileSeeThrough fade={fade} hold={!bodyIn && level !== 'part'}>
                {/* inside the painted body: no labels while it hides them */}
                <Unseen.Provider value={!inside}>
                  {layout.parts
                    .filter((p) => p.kind !== 'wheel')
                    .map((p) => {
                      const rot: Vec3 = [p.rollDeg * DEG, p.yawDeg * DEG, 0];
                      const isEngine = p.kind === 'engine';
                      return (
                        <Part
                          key={p.id}
                          id={p.id}
                          system={SYSTEM_OF[p.kind]}
                          label={p.label}
                          position={mmVec(p.posMm)}
                          rotation={rot}
                          morph={!zoomed}
                          explode={{
                            dir: isEngine ? [0, 1, 0] : undefined,
                            dist: isEngine ? 0.75 : 0.45,
                            stage: 2,
                          }}
                        >
                          {isEngine && engine ? (
                            <EngineSlot
                              spec={engine}
                              explode={level === 'part' && part === 'engine' ? undefined : 0}
                            />
                          ) : p.kind === 'motor' && motorOf(p) ? (
                            <MotorSlot
                              spec={motorOf(p)!}
                              id={p.id}
                              explode={level === 'part' && part === p.id ? undefined : 0}
                            />
                          ) : (
                            <Component
                              p={p}
                              open={level === 'part' && part === p.id}
                              gearbox={pt.kind === 'ice' ? pt.gearbox : undefined}
                            />
                          )}
                          {level === 'internals' && <HitBox p={p} />}
                          {level === 'part' && part === p.id && p.id === awdPart && (
                            <AwdFlow vehicle={vehicle} part={p} />
                          )}
                        </Part>
                      );
                    })}
                  {layout.shafts.map((s) => (
                    <ShaftPart key={s.id} s={s} hit={level === 'internals'} />
                  ))}
                  <Chassis vehicle={vehicle} layout={layout} shell={shell} seats={seats} />
                  <Cabin vehicle={vehicle} layout={layout} shell={shell} seats={seats} />
                </Unseen.Provider>
              </WhileSeeThrough>
            </Sprung>

            {layout.parts.filter((p) => p.kind === 'wheel').map(wheel)}

            {/* with the drivetrain, not floating over an empty road before the body loads */}
            {shown.length > 0 && bodyIn && (
              <FadeGate fade={fade}>
                {(on) =>
                  on && (
                    <Overlays
                      kinds={shown}
                      vehicle={vehicle}
                      base={base}
                      layout={layout}
                      mass={mass}
                      shell={shell}
                      seats={seats}
                    />
                  )
                }
              </FadeGate>
            )}
          </CarSpan.Provider>
        </Assembly>
      </SpinContext.Provider>
    </PartPrefix.Provider>
  );
}

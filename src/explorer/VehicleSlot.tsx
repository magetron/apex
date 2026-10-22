/**
 * Seam: which vehicle model the explorer renders (the look-alike VehicleModel), plus the cars
 * it is compared with: coloured outlines over it, or parked beside it, front axles level.
 */
import { Html } from '@react-three/drei';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Group } from 'three';
import type { OverlayKind } from '../content/types';
import { registerPart } from '../scene/registry';
import { useTheme } from '../scene/theme';
import type { VehicleSpec } from '../spec/types';
import { mm } from '../spec/units';
import { VehicleModel } from '../vehicle3d';
import { GhostCar } from '../vehicle3d/GhostCar';
import { axleShift, compareColors, mainColor, sideOffsets, useCompare } from './compare';
import { shortName } from './drive/lineup';
import type { Level } from './view';
import './explorer.css';

export interface VehicleSlotProps {
  vehicle: VehicleSpec;
  level: Level;
  part?: string;
  /** cars to compare with (not in drive, which runs them on the road) */
  vs?: VehicleSpec[];
}

const NO_OVERLAYS: OverlayKind[] = [];

/** Name tags over the cars of a comparison, each in its colour. */
function CarTag({
  cars,
  colors,
  z,
  tail,
}: {
  cars: VehicleSpec[];
  colors: string[];
  z: number;
  /** from above: past the rear bumper at this x (over the roof, the tag covered the CG and
   *  torque labels; past the nose, the info card on the right covered it) */
  tail?: number;
}) {
  const top = Math.max(...cars.map((v) => mm(v.dims.heightMm)));
  return (
    <Html
      position={tail === undefined ? [0, top + 0.3, z] : [tail - 0.3, 0.3, z]}
      center={tail === undefined}
      zIndexRange={[14, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <span className={tail === undefined ? 'apx-cmp-tags' : 'apx-cmp-tags is-tail'}>
        {cars.map((v, i) => (
          <span key={v.id} className="apx-cmp-tag" style={{ '--sys': colors[i] } as CSSProperties}>
            <i />
            {shortName(v)}
          </span>
        ))}
      </span>
    </Html>
  );
}

/**
 * The compared cars. They stay mounted while a part is zoomed (hidden), so backing out is
 * instant; the camera frames them through the part registry like the main car's parts.
 */
function Compared({
  main,
  others,
  level,
}: {
  main: VehicleSpec;
  others: VehicleSpec[];
  level: Level;
}) {
  const mode = useCompare((s) => s.mode);
  const fromAbove = useCompare((s) => s.view === 'top');
  // where a car's tail is, front axles level with the main car's (drawn centred on its wheelbase)
  const tail = (v: VehicleSpec) =>
    fromAbove
      ? mm(main.dims.wheelbaseMm) / 2 + mm(v.dims.overhangFMm) - mm(v.dims.lengthMm)
      : undefined;
  const theme = useTheme((s) => s.theme);
  const colors = compareColors(others, theme, mode);
  const zs = sideOffsets(main, others);
  const L = mm(main.dims.wheelbaseMm);
  const shown = level !== 'part';
  const ghosts = useRef<Group>(null);
  // the outlines are not <Part>s: register them so the camera keeps them in frame
  useEffect(() => {
    const g = ghosts.current;
    return g && mode === 'overlay' ? registerPart('vs:ghosts', g) : undefined;
  }, [mode]);
  return (
    <group visible={shown}>
      {mode === 'overlay' ? (
        <group ref={ghosts} position={[L / 2, 0, 0]}>
          {others.map((o, i) => (
            <GhostCar key={o.id} vehicle={o} color={colors[i]} slot={i} />
          ))}
        </group>
      ) : (
        others.map((o, i) => (
          <group key={o.id} position={[axleShift(main, o), 0, zs[i]]}>
            <VehicleModel
              vehicle={o}
              level={level === 'part' ? 'internals' : level}
              idPrefix={`vs${i + 1}:`}
              // hidden behind a zoomed part: its overlay tags are DOM and would still show
              overlays={level === 'part' ? NO_OVERLAYS : undefined}
            />
          </group>
        ))
      )}
      {shown &&
        (mode === 'side' ? (
          <>
            <CarTag cars={[main]} colors={[mainColor(theme)]} z={0} tail={tail(main)} />
            {others.map((o, i) => (
              <CarTag key={o.id} cars={[o]} colors={[colors[i]]} z={zs[i]} tail={tail(o)} />
            ))}
          </>
        ) : (
          // one place, so one legend: which outline is which car
          <CarTag
            cars={[main, ...others]}
            colors={[mainColor(theme), ...colors]}
            z={0}
            tail={tail(main)}
          />
        ))}
    </group>
  );
}

export function VehicleSlot({ vs, ...props }: VehicleSlotProps) {
  return (
    <>
      <VehicleModel {...props} />
      {props.level !== 'drive' && !!vs?.length && (
        <Compared main={props.vehicle} others={vs} level={props.level} />
      )}
    </>
  );
}

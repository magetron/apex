/**
 * People: seats with seated mannequins (the occupant volume), translucent, so the "space left
 * for people" reads at a glance next to the drivetrain.
 */
import { ghostMat } from '../scene/materials';
import { Part } from '../scene/Part';
import type { PowertrainLayout, VehicleSpec } from '../spec/types';
import { mmVec } from '../spec/units';
import { G } from './geom';
import type { Seat } from './packaging';
import type { Shell } from './shell/build';

function Mannequin({ seat }: { seat: Seat }) {
  const k = seat.scale;
  const a = seat.recline;
  const body = ghostMat('occupant', 0.45);
  const seatM = ghostMat('chassis', 0.55);
  const hipDrop = seat.y - seat.floorY;
  // knee forward of the hip, foot on the floor
  const knee: [number, number] = [0.42 * k, 0.06 * k];
  const foot: [number, number] = [0.58 * k, -hipDrop / 1000 + 0.05];
  const shin = Math.hypot(foot[0] - knee[0], foot[1] - knee[1]);
  const shinAng = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
  return (
    <group position={mmVec([seat.x, seat.y, seat.z])}>
      {/* seat: cushion + reclined back */}
      <mesh
        geometry={G.box}
        material={seatM}
        position={[0.13 * k, -0.075 * k, 0]}
        scale={[0.46 * k, 0.08 * k, 0.44 * k]}
      />
      <group rotation={[0, 0, a]}>
        <mesh
          geometry={G.box}
          material={seatM}
          position={[-0.12 * k, 0.3 * k, 0]}
          scale={[0.08 * k, 0.6 * k, 0.44 * k]}
        />
      </group>
      {/* torso + head lean back with the seat */}
      <group rotation={[0, 0, a]}>
        <mesh
          geometry={G.capsule}
          material={body}
          position={[0, 0.3 * k, 0]}
          scale={[0.13 * k, 0.12 * k, 0.17 * k]}
        />
        <mesh geometry={G.sphere} material={body} position={[0, 0.66 * k, 0]} scale={0.1 * k} />
        {/* arms forward to the wheel / lap */}
        {[-1, 1].map((sg) => (
          <mesh
            key={sg}
            geometry={G.capsule}
            material={body}
            position={[0.14 * k, 0.33 * k, sg * 0.2 * k]}
            rotation={[0, 0, -1.25 - a]}
            scale={[0.045 * k, 0.1 * k, 0.045 * k]}
          />
        ))}
      </group>
      {[-1, 1].map((sg) => (
        <group key={sg} position={[0, 0, sg * 0.095 * k]}>
          <mesh
            geometry={G.capsule}
            material={body}
            position={[knee[0] / 2, knee[1] / 2, 0]}
            rotation={[0, 0, -Math.PI / 2 + 0.14]}
            scale={[0.07 * k, 0.12 * k, 0.07 * k]}
          />
          <mesh
            geometry={G.capsule}
            material={body}
            position={[(knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2, 0]}
            rotation={[0, 0, shinAng - Math.PI / 2]}
            scale={[0.055 * k, Math.max(0.02, shin / 3), 0.055 * k]}
          />
        </group>
      ))}
    </group>
  );
}

export interface CabinProps {
  vehicle: VehicleSpec;
  layout: PowertrainLayout;
  shell: Shell;
  seats: Seat[];
}

export function Cabin({ seats }: CabinProps) {
  return (
    <>
      <Part
        id="occupants"
        system="occupant"
        label={`Occupants · ${seats.length} seats`}
        explode={{ dir: [0, 1, 0], dist: 0.55, stage: 1 }}
      >
        {seats.map((s, i) => (
          <Mannequin key={i} seat={s} />
        ))}
      </Part>
    </>
  );
}

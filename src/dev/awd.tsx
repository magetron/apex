/**
 * #/dev/awd — the AWD explainer for several cars side by side: one grip control, each car's
 * device responding to the same conditions (the readout the explorer shows in the part view
 * of the centre diff / coupling). Each title links to that part view.
 */
import { href } from '../app/routes';
import { Panel } from '../app/ui';
import { AwdControls, AwdReadout } from '../explorer/panels/AwdPanel';
import { viewPath } from '../explorer/view';
import { getVehicle } from '../spec/catalog';
import { awdPartId } from '../spec/derive/awd';

const CARS = [
  'audi-sport-quattro-1984',
  'audi-rs6-avant-c8',
  'subaru-wrx-sti',
  'lancia-delta-integrale-evo2',
  'vw-golf-r-mk8',
  'toyota-gr-yaris-gxpa16',
  'audi-r8-v10-gen2',
  'jeep-wrangler-rubicon-392-jl',
];

export function Overlay() {
  const cars = CARS.map(getVehicle);
  return (
    <div className="awd-dev">
      <Panel title="Conditions">
        <AwdControls vehicle={cars[0]} />
      </Panel>
      {cars.map((v) => (
        <Panel
          key={v.id}
          title={
            <a href={href(viewPath({ vehicleId: v.id, level: 'part', part: awdPartId(v)! }))}>
              {v.name}
            </a>
          }
        >
          <AwdReadout vehicle={v} />
        </Panel>
      ))}
    </div>
  );
}

/**
 * #/dev/carpicker — the explorer's car picker on its own, with a local view instead of the URL:
 * the collapsed bar at the bottom (‹ › step through the filtered list, the middle opens the
 * sheet), and the car it lands on linked to the explorer.
 */
import { useState } from 'react';
import { href } from '../app/routes';
import { BottomBar, Chips, Dock, Panel } from '../app/ui';
import { CarPicker } from '../explorer/panels/CarPicker';
import { carFacts } from '../explorer/panels/carFacts';
import { DEFAULT_VEHICLE, viewPath, type View } from '../explorer/view';
import { getVehicle } from '../spec/catalog';

export function Overlay() {
  const [view, setView] = useState<View>({ vehicleId: DEFAULT_VEHICLE, level: 'car' });
  const vehicle = getVehicle(view.vehicleId);
  const f = carFacts(vehicle);
  return (
    <>
      <Dock side="top-left">
        <Panel title={<a href={href(viewPath(view))}>{vehicle.name}</a>}>
          <Chips
            items={[
              { label: f.code },
              { label: f.places.join(' + '), system: f.source === 'EV' ? 'motor' : 'engine' },
              { label: f.drive, system: 'wheel-driven' },
              { label: f.unit },
            ]}
          />
        </Panel>
      </Dock>
      <BottomBar center={<CarPicker view={view} go={setView} vehicle={vehicle} />} />
    </>
  );
}

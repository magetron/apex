/**
 * #/dev/compare — the car view's see-through switch and comparison on their own, with a local view
 * instead of the URL: a main car and up to three to compare with (outlines over it or parked
 * beside it, front axles level), see-through crossfading on X, the info card's comparison table,
 * and the picker ([ ] to swap, the compare button and each card's corner to add). The same view
 * opens in the explorer from the link.
 */
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { href } from '../app/routes';
import { BottomBar, Dock, Panel, Segmented, Toggle } from '../app/ui';
import { useScene } from '../scene/store';
import { getVehicle } from '../spec/catalog';
import { useCompare, vsCars, type CompareMode } from '../explorer/compare';
import { FocusCamera } from '../explorer/FocusCamera';
import { CarInfo } from '../explorer/panels/CarInfo';
import { CarPicker } from '../explorer/panels/CarPicker';
import { VehicleSlot } from '../explorer/VehicleSlot';
import {
  isSeeThrough,
  parseView,
  viewPath,
  withSeeThrough,
  type Go,
  type View,
} from '../explorer/view';

const useSandbox = create<{ view: View }>(() => ({
  view: parseView('/porsche-911-992?vs=porsche-718-boxster-t-982'),
}));

const go: Go = (v) => useSandbox.setState({ view: parseView(viewPath(v)) });

export function Scene() {
  const view = useSandbox((s) => s.view);
  const mode = useCompare((s) => s.mode);
  const vehicle = getVehicle(view.vehicleId);
  const vsKey = view.vs?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vs = useMemo(() => vsCars(view.vs), [vsKey]);
  const see = isSeeThrough(view);
  useEffect(() => useScene.setState({ xray: see, focus: null }), [see]);
  return (
    <>
      <VehicleSlot vehicle={vehicle} level={view.level} vs={vs} />
      <FocusCamera view={view} compare={vsKey && `${vsKey}|${mode}`} />
    </>
  );
}

export function Overlay() {
  const view = useSandbox((s) => s.view);
  const mode = useCompare((s) => s.mode);
  const vehicle = getVehicle(view.vehicleId);
  const vsKey = view.vs?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const others = useMemo(() => vsCars(view.vs), [vsKey]);
  const see = isSeeThrough(view);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'x' && !e.repeat) go(withSeeThrough(view, !see));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, see]);
  return (
    <>
      <Dock side="top-left">
        <Panel title={<a href={href(viewPath(view))}>Open in the explorer</a>}>
          <Toggle
            label="See-through (X)"
            checked={see}
            onChange={(on) => go(withSeeThrough(view, on))}
          />
          <Segmented<CompareMode>
            label="Compared cars"
            value={mode}
            onChange={(m) => useCompare.setState({ mode: m })}
            options={[
              { value: 'overlay', label: 'Overlay' },
              { value: 'side', label: 'Side by side' },
            ]}
          />
        </Panel>
      </Dock>
      <Dock side="top-right">
        <CarInfo vehicle={vehicle} detailed={see} view={view} go={go} others={others} />
      </Dock>
      <BottomBar center={<CarPicker view={view} go={go} vehicle={vehicle} />} />
    </>
  );
}

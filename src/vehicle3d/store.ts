/**
 * Visitor-chosen overrides for the vehicle view: an engine swap per car (fit-check stories)
 * and which overlays are on at the internals level. Tours can set the same state.
 */
import { create } from 'zustand';
import type { OverlayKind } from '../content/types';

// the axle loads too: one look at the bars says which end carries the weight
export const DEFAULT_OVERLAYS: OverlayKind[] = ['cg', 'torque-flow', 'axle-loads'];

export interface VehicleOverrides {
  /** vehicle id → swapped-in engine id */
  engineSwap: Record<string, string>;
  overlays: OverlayKind[];
  setEngine: (vehicleId: string, engineId: string | null) => void;
  toggleOverlay: (kind: OverlayKind) => void;
  setOverlays: (kinds: OverlayKind[]) => void;
}

export const useVehicleOverrides = create<VehicleOverrides>()((set, get) => ({
  engineSwap: {},
  overlays: DEFAULT_OVERLAYS,
  setEngine: (vehicleId, engineId) => {
    const next = { ...get().engineSwap };
    if (engineId) next[vehicleId] = engineId;
    else delete next[vehicleId];
    set({ engineSwap: next });
  },
  toggleOverlay: (kind) => {
    const cur = get().overlays;
    set({ overlays: cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind] });
  },
  setOverlays: (overlays) => set({ overlays }),
}));

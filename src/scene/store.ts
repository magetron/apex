import type { CameraControls } from '@react-three/drei';
import { create } from 'zustand';
import type { Vec3 } from '../spec/types';

export type Controls = React.ComponentRef<typeof CameraControls>;

export interface CameraShot {
  /** metres, world frame */
  position: Vec3;
  target: Vec3;
  /** false = jump instead of tweening */
  animate?: boolean;
}

export type LabelMode = 'none' | 'hover' | 'all';

/** Is `id` the focus, inside it ("engine/crank" in "engine"), or one of its ancestors? */
export const relatedToFocus = (id: string, focus: string) =>
  id === focus || id.startsWith(`${focus}/`) || focus.startsWith(`${id}/`);

export interface SceneState {
  /** 0 = assembled, 1 = fully exploded; drives every *active* <Assembly> */
  explode: number;
  /** Ghost the body/blocks so internals show through. */
  xray: boolean;
  labels: LabelMode;
  /** Part ids to outline and label (tours use this). */
  highlight: string[];
  hovered: string | null;
  selected: string | null;
  /** When set, only this part (and its sub-parts) stays visible — "zoomed into" it. */
  focus: string | null;
  shot: CameraShot | null;
  /** The live camera-controls instance (set by <CameraRig>), for fitToBox() framing. */
  controls: Controls | null;
  /** Click handler for parts; the explorer installs one that zooms. Default: toggle select. */
  onPick: ((id: string) => void) | null;
  /** Click on empty space; the explorer zooms out. Default: clear selection. */
  onMiss: (() => void) | null;

  setExplode: (v: number) => void;
  setXray: (v: boolean) => void;
  setLabels: (m: LabelMode) => void;
  setHighlight: (ids: string[]) => void;
  setHovered: (id: string | null) => void;
  select: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  shoot: (shot: CameraShot) => void;
  pick: (id: string) => void;
  miss: () => void;
  /** Back to an assembled, unhighlighted view. */
  resetView: () => void;
}

export const useScene = create<SceneState>()((set, get) => ({
  explode: 0,
  xray: true,
  labels: 'hover',
  highlight: [],
  hovered: null,
  selected: null,
  focus: null,
  shot: null,
  controls: null,
  onPick: null,
  onMiss: null,

  setExplode: (explode) => set({ explode: Math.min(1, Math.max(0, explode)) }),
  setXray: (xray) => set({ xray }),
  setLabels: (labels) => set({ labels }),
  setHighlight: (highlight) => set({ highlight }),
  setHovered: (hovered) => set({ hovered }),
  select: (selected) => set({ selected }),
  setFocus: (focus) => set({ focus }),
  shoot: (shot) => set({ shot }),
  pick: (id) => {
    const handler = get().onPick;
    if (handler) handler(id);
    else set({ selected: get().selected === id ? null : id });
  },
  miss: () => {
    const handler = get().onMiss;
    if (handler) handler();
    else set({ selected: null });
  },
  resetView: () => set({ explode: 0, highlight: [], hovered: null, selected: null }),
}));

/**
 * The AWD explainer's conditions (grip under each axle, tight turn, driver's lock), shared by the
 * hub control, the info readout and the 3D torque arrows. Every change restarts the step
 * response from dry tarmac, played back slowed down so the clutches' delay is visible.
 */
import { create } from 'zustand';

/** Ice as a fraction of dry-tarmac grip (μ ~0.1 vs ~1.0). */
export const ICE_GRIP = 0.1;
/** Model seconds shown per playback: the first second after the grip changes. */
export const AWD_WINDOW_S = 1;
/** Playback is this many times slower than real time. */
export const AWD_SLOWMO = 3;

export interface AwdExplainer {
  /** -1 = front axle on ice … 0 = both dry … 1 = rear axle on ice */
  ice: number;
  turn: boolean;
  locked: boolean;
  /** model time the visitor is hovering on the response plot (s), or null to play */
  scrub: number | null;
  /** performance.now() when the conditions last changed */
  since: number;
  set: (p: Partial<Pick<AwdExplainer, 'ice' | 'turn' | 'locked'>>) => void;
  replay: () => void;
  setScrub: (t: number | null) => void;
}

export const useAwdExplainer = create<AwdExplainer>()((set) => ({
  ice: -1,
  turn: false,
  locked: false,
  scrub: null,
  since: typeof performance === 'undefined' ? 0 : performance.now(),
  set: (p) => set({ ...p, since: performance.now() }),
  replay: () => set({ since: performance.now() }),
  setScrub: (scrub) => set({ scrub }),
}));

/** Grip under each axle (multiples of dry μ) for the slider position. */
export const gripFront = (ice: number) => (ice < 0 ? 1 + (1 - ICE_GRIP) * ice : 1);
export const gripRear = (ice: number) => (ice > 0 ? 1 - (1 - ICE_GRIP) * ice : 1);

/** Model time (s) since the conditions changed, at playback speed. */
export const awdElapsed = (since: number, now = performance.now()) =>
  Math.max(0, (now - since) / 1000 / AWD_SLOWMO);

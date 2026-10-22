/**
 * Drive-mode scene colours per theme. Proposed for scene/theme.ts (SCENE_THEMES) at
 * integration; kept here for now.
 *
 * One colour language: the visitor's car is neutral (`you`), the one car it is compared with
 * wears one accent (`rival`); under each tyre, its grip in use runs green (`ok`) → amber
 * (`limit`) → red (`slide`), and red means only that: an end at its limit, sliding. Everything
 * else on the road is quiet grey.
 */
import type { Theme } from '../../scene/theme';
import type { Family } from './state';

export interface DriveColors {
  road: string;
  roadEdge: string;
  line: string;
  /** a tyre or axle gripping (wedges, tyre marks): quiet */
  grip: string;
  /** a tyre with grip to spare (the ring under it) */
  ok: string;
  /** a tyre near its limit (the ring under it) */
  limit: string;
  /** an axle that let go: wedges, tyre marks, rings, pins */
  slide: string;
  /** friction circles (tyre forces) */
  ring: string;
  cone: string;
  /** the visitor's own car: its line, its label, its row */
  you: string;
  /** the one car it is compared with (another car, or the same one without the technique) */
  rival: string;
  /** road markings for the manoeuvre's steps */
  mark: string;
  /** the stretch where the driver holds the wheel still (the event zone) */
  zone: string;
  /** where the front wheels are steered (the arrow on the car while catching a slide) */
  steer: string;
  shadow: string;
  shadowOpacity: number;
}

export const DRIVE_COLORS: Record<Theme, DriveColors> = {
  dark: {
    road: '#111a24',
    roadEdge: '#2c3e52',
    line: '#3d556d',
    grip: '#6b7c8f',
    ok: '#3ccf8e',
    limit: '#ffb703',
    slide: '#ff5a52',
    ring: '#8496aa',
    cone: '#c9d2dc',
    you: '#e6edf3',
    rival: '#b4a5ff',
    mark: '#7d8fa3',
    zone: '#9fb3c8',
    steer: '#7fdbff',
    shadow: '#000000',
    shadowOpacity: 0.55,
  },
  light: {
    road: '#d4dce5',
    roadEdge: '#a7b6c6',
    line: '#8ea2b6',
    grip: '#8a99aa',
    ok: '#169c5f',
    limit: '#d98a00',
    slide: '#d33a32',
    ring: '#6e8196',
    cone: '#5f6f80',
    you: '#0f1720',
    rival: '#6347d1',
    mark: '#71859a',
    zone: '#5f748a',
    steer: '#0b7fb3',
    shadow: '#0f1720',
    shadowOpacity: 0.28,
  },
};

/** One fixed colour per layout family (validated categorical palette), for the car view's
 *  side-by-side comparison (explorer/compare.ts). Drive mode no longer colours by family. */
export const GHOST_COLORS: Record<Theme, Record<Family, string>> = {
  dark: {
    FF: '#3987e5',
    FR: '#d95926',
    MR: '#199e70',
    RR: '#c98500',
    AWD: '#d55181',
    EV: '#9085e9',
  },
  light: {
    FF: '#2a78d6',
    FR: '#eb6834',
    MR: '#1baf7a',
    RR: '#eda100',
    AWD: '#e87ba4',
    EV: '#6250d6',
  },
};

/** For a second car of a family already shown (two mid-engined cars compared, say). */
export const EXTRA_COLORS: Record<Theme, string[]> = {
  dark: ['#9aa6ba', '#b5835a', '#9cbf3a', '#2bb3c0'],
  light: ['#5f6f84', '#91603a', '#6d9419', '#13919c'],
};

/**
 * Which colour each compared car wears in the car view, in order: 0 = its layout family's
 * colour, k > 0 = the k-th extra colour, for a car whose family an earlier car already wears.
 * Theme-free, so a car keeps its colour when the theme flips.
 */
export function colorSlots(families: Family[]): number[] {
  const used = new Set<Family>();
  let extra = 0;
  return families.map((f) => {
    if (!used.has(f)) {
      used.add(f);
      return 0;
    }
    return ++extra;
  });
}

export function slotColor(f: Family, slot: number, theme: Theme): string {
  if (!slot) return GHOST_COLORS[theme][f];
  const list = EXTRA_COLORS[theme];
  return list[(slot - 1) % list.length];
}

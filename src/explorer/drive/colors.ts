/**
 * Drive-mode scene colours per theme. Proposed for scene/theme.ts (SCENE_THEMES) at
 * integration; kept here for now.
 */
import type { Theme } from '../../scene/theme';
import type { Family } from './state';

export interface DriveColors {
  road: string;
  roadEdge: string;
  line: string;
  /** tyre marks while gripping, at the limit and sliding */
  grip: string;
  limit: string;
  slide: string;
  ring: string;
  cone: string;
  /** the visitor's own car: its line, its label, its row */
  you: string;
  /** the same car without the technique */
  twin: string;
  /** road markings for the manoeuvre's steps */
  mark: string;
  shadow: string;
  shadowOpacity: number;
}

export const DRIVE_COLORS: Record<Theme, DriveColors> = {
  dark: {
    road: '#111a24',
    roadEdge: '#2c3e52',
    line: '#4b6a88',
    grip: '#3c5268',
    limit: '#ffb703',
    slide: '#ef476f',
    ring: '#7fdbff',
    cone: '#ff7b00',
    you: '#e6edf3',
    twin: '#8a9bb0',
    mark: '#7fdbff',
    shadow: '#000000',
    shadowOpacity: 0.55,
  },
  light: {
    road: '#d4dce5',
    roadEdge: '#a7b6c6',
    line: '#7d93aa',
    grip: '#9fb0c2',
    limit: '#d98a00',
    slide: '#d03b3b',
    ring: '#0b7fb3',
    cone: '#f26b00',
    you: '#0f1720',
    twin: '#6b7d92',
    mark: '#0b7fb3',
    shadow: '#0f1720',
    shadowOpacity: 0.28,
  },
};

/** One fixed colour per layout family (validated categorical palette; every ghost is also
 *  labelled with its layout code, so colour never carries identity alone). */
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
 * Which colour each comparison car wears, in order: 0 = its layout family's colour, k > 0 = the
 * k-th extra colour, for a car whose family an earlier car already wears. Theme-free, so a car
 * keeps its colour when the theme flips; the same list gives the same colours in the car view
 * and on the road.
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

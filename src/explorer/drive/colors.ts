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

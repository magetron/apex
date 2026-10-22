/**
 * Hot-lap scene colours per theme: a quiet asphalt ribbon on the blueprint ground, white edge
 * lines, red-and-white kerbs through the corners, and the racing line as a faint accent.
 */
import type { Theme } from '../../scene/theme';

export interface TrackColors {
  asphalt: string;
  edge: string;
  kerbRed: string;
  kerbWhite: string;
  line: string;
  start: string;
  /** a sector's end, across the track */
  sector: string;
}

export const TRACK_COLORS: Record<Theme, TrackColors> = {
  dark: {
    asphalt: '#1a232e',
    edge: '#c9d2dc',
    kerbRed: '#c4383c',
    kerbWhite: '#dfe5eb',
    line: '#7fdbff',
    start: '#f2f5f8',
    sector: '#5d6b7c',
  },
  light: {
    asphalt: '#aeb9c5',
    edge: '#ffffff',
    kerbRed: '#d0393e',
    kerbWhite: '#ffffff',
    line: '#0b7fb3',
    start: '#0f1720',
    sector: '#768597',
  },
};

/**
 * Real circuits as the lap simulator sees them: a closed centreline measured off the real
 * track (TUMFTM's racetrack database, OpenStreetMap), the track's edges either side of it, and
 * the named corners and timing sectors placed along it.
 *
 * Frame: the sim's ground frame, x forward at the start line, y to the LEFT, heading ψ
 * counter-clockwise from +x (as src/sim/model). A left turn has positive curvature.
 */

/**
 * A circuit's centreline as data (data/tumftm, data/osm; written by scripts/tracks/convert.mjs):
 * points an even `ds` apart round the lap in driving order, the start/finish line first, the
 * start straight along +x. Coordinates and per-point widths are strings of centimetres, the
 * first absolute and each after it the step from the one before; a width given as a number is
 * metres for the whole lap.
 */
export interface Centreline {
  /** where the points come from */
  source: string;
  n: number;
  /** spacing (m) */
  ds: number;
  /** which way the start straight points on the map the data came from (deg, anticlockwise
   *  from east) */
  headingDeg: number;
  x: string;
  y: string;
  /** the track's width to the left and to the right of the centreline (m) */
  wl: string | number;
  wr: string | number;
}

/**
 * A named corner, placed by its apexes' distances from the line (m, along the centreline): one
 * for a simple corner, several for a chicane or a double apex. Each snaps to the tightest point
 * of the data near it.
 */
export interface CornerMark {
  name: string;
  at: number[];
}

/** A lap time someone published for a car in the catalog, to compare the simulator with. */
export interface PublishedLap {
  vehicleId: string;
  /** seconds */
  time: number;
  /** who drove it, where it was published, and anything that makes it not like for like */
  note: string;
}

export interface TrackSpec {
  id: string;
  /** short name, e.g. "Monza" */
  name: string;
  /** e.g. "Autodromo Nazionale Monza" */
  fullName: string;
  country: string;
  /** the official lap length (m) */
  lengthM: number;
  /** the official number of turns */
  turns: number;
  /**
   * Which way the start straight points on the usual track map (deg, anticlockwise from the
   * map's right): outlines are drawn turned this way, the way people know the circuit.
   */
  mapHeadingDeg: number;
  centreline: Centreline;
  /** in driving order from the line */
  corners: CornerMark[];
  /** where sectors 2 and 3 begin (m from the line) */
  sectors: [number, number];
  laps?: PublishedLap[];
  /** where every number comes from; "~" marks an estimate */
  source: string;
}

export interface Corner {
  name: string;
  /** centreline distance where it starts, its apex (tightest point) and where it ends (m) */
  s0: number;
  apex: number;
  s1: number;
  /** +1 left, −1 right: which way it turns at its tightest */
  dir: 1 | -1;
  /** tightest radius of the centreline (m) */
  radius: number;
}

/** The centreline sampled at an even spacing, closed (sample n would be sample 0). */
export interface TrackPath {
  id: string;
  n: number;
  /** spacing between samples (m) */
  ds: number;
  length: number;
  x: Float64Array;
  y: Float64Array;
  /** heading (rad, unwrapped) */
  psi: Float64Array;
  /** curvature (1/m, + left) */
  k: Float64Array;
  /** distance from the centreline to the track's edge on the left and on the right (m) */
  wl: Float64Array;
  wr: Float64Array;
  /** the typical (median) full width (m), for drawing at a glance */
  width: number;
  corners: Corner[];
  /** where each timing sector starts (m); the first is 0 */
  sectors: number[];
}

/** The racing line: the same samples as the centreline, moved across the track. */
export interface RaceLine {
  n: number;
  x: Float64Array;
  y: Float64Array;
  psi: Float64Array;
  /** curvature (1/m, + left) */
  k: Float64Array;
  /** lateral offset from the centreline (m, + left) */
  offset: Float64Array;
  /** distance from sample i to sample i + 1 along the line (m) */
  seg: Float64Array;
  length: number;
}

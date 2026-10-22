import centreline from '../data/tumftm/monza';
import type { TrackSpec } from '../types';

/**
 * The power circuit: four long straights joined by two slow chicanes, two medium rights and the
 * Parabolica. Clockwise.
 */
const track: TrackSpec = {
  id: 'monza',
  name: 'Monza',
  fullName: 'Autodromo Nazionale Monza',
  country: 'Italy',
  lengthM: 5793,
  turns: 11,
  mapHeadingDeg: 180,
  centreline,
  corners: [
    { name: 'Rettifilo', at: [930, 975] },
    { name: 'Curva Grande', at: [1390] },
    { name: 'Roggia', at: [2145, 2190] },
    { name: 'Lesmo 1', at: [2600] },
    { name: 'Lesmo 2', at: [2875] },
    { name: 'Ascari', at: [3955, 4095, 4140] },
    { name: 'Parabolica', at: [5140] },
  ],
  sectors: [2210, 4165],
  source:
    'Length 5,793 m, 11 turns, corner names and order — Wikipedia "Monza Circuit" (2000–present layout). Centreline and the widths either side — TUMFTM racetrack-database, tracks/Monza.csv (LGPL-3.0; the centreline from OpenStreetMap, smoothed; the widths from satellite images): 5,790 m, 0.06% short of the official length, not rescaled; its first point is the start/finish line. ~ Corners placed at the tightest points of the data, sector ends after the Roggia and after Ascari.',
};

export default track;

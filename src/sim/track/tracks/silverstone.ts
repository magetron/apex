import centreline from '../data/tumftm/silverstone';
import type { TrackSpec } from '../types';

/**
 * Fast and flowing on an old airfield: Copse, the Maggotts–Becketts–Chapel esses and the Hangar
 * straight, with the slower infield loop of the Arena layout. Clockwise.
 */
const track: TrackSpec = {
  id: 'silverstone',
  name: 'Silverstone',
  fullName: 'Silverstone Circuit',
  country: 'UK',
  lengthM: 5891,
  turns: 18,
  mapHeadingDeg: 133,
  centreline,
  corners: [
    { name: 'Abbey', at: [395] },
    { name: 'Farm', at: [640] },
    { name: 'Village', at: [890] },
    { name: 'The Loop', at: [1040] },
    { name: 'Aintree', at: [1250] },
    { name: 'Brooklands', at: [2000] },
    { name: 'Luffield', at: [2180] },
    { name: 'Woodcote', at: [2450, 2545] },
    { name: 'Copse', at: [3136] },
    { name: 'Maggotts', at: [3606, 3721] },
    { name: 'Becketts', at: [3886, 4021] },
    { name: 'Chapel', at: [4191] },
    { name: 'Stowe', at: [5081] },
    { name: 'Vale', at: [5511] },
    { name: 'Club', at: [5596] },
  ],
  sectors: [1280, 4220],
  source:
    'Length 5,891 m, 18 turns, corner names and order (the Arena layout, 2011–) — Wikipedia "Silverstone Circuit". Centreline and the widths either side — TUMFTM racetrack-database, tracks/Silverstone.csv (LGPL-3.0; the centreline from OpenStreetMap, smoothed; the widths from satellite images): 5,887 m, 0.07% short of the official length, not rescaled; its first point is the start/finish line on the Hamilton straight. ~ Corners placed at the tightest points of the data, sector ends after Aintree and after Chapel.',
};

export default track;

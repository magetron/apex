import centreline from '../data/tumftm/spa';
import type { TrackSpec } from '../types';

/**
 * The flowing high-speed one: La Source hairpin, flat through Eau Rouge and up the Kemmel
 * straight, then a long run of fast sweepers through the forest back to the Bus Stop. Clockwise.
 */
const track: TrackSpec = {
  id: 'spa',
  name: 'Spa',
  fullName: 'Circuit de Spa-Francorchamps',
  country: 'Belgium',
  lengthM: 7004,
  turns: 19,
  mapHeadingDeg: 211,
  centreline,
  corners: [
    { name: 'La Source', at: [405] },
    { name: 'Eau Rouge', at: [1065] },
    { name: 'Raidillon', at: [1130, 1285] },
    { name: 'Les Combes', at: [2430, 2525] },
    { name: 'Malmedy', at: [2680] },
    { name: 'Bruxelles', at: [3005] },
    { name: 'Pouhon', at: [3889, 4019] },
    { name: 'Fagnes', at: [4549] },
    { name: 'Campus', at: [4664] },
    { name: 'Stavelot', at: [4959, 5219] },
    { name: 'Paul Frère', at: [5450] },
    { name: 'Blanchimont', at: [5959, 6209] },
    { name: 'Bus Stop', at: [6749, 6794] },
  ],
  sectors: [2380, 5245],
  source:
    'Length 7,004 m, 19 turns, corner names and order — Wikipedia "Circuit de Spa-Francorchamps". Centreline and the widths either side — TUMFTM racetrack-database, tracks/Spa.csv (LGPL-3.0; the centreline from OpenStreetMap, smoothed; the widths from satellite images): 7,000 m, 0.06% short of the official length, not rescaled; its first point is the start/finish line. ~ Corners placed at the tightest points of the data, sector ends at Les Combes and after Stavelot. Flat here: the ~100 m of climb and fall are not modelled.',
};

export default track;

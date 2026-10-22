import centreline from '../data/osm/laguna-seca';
import type { TrackSpec } from '../types';

/**
 * California's roller coaster: the Andretti hairpin, the climb along the Rahal straight and the
 * Corkscrew plunging down the other side. Anticlockwise.
 */
const track: TrackSpec = {
  id: 'laguna-seca',
  name: 'Laguna Seca',
  fullName: 'WeatherTech Raceway Laguna Seca',
  country: 'USA',
  lengthM: 3602,
  turns: 11,
  mapHeadingDeg: -9,
  centreline,
  corners: [
    { name: 'T1', at: [220] },
    { name: 'Andretti Hairpin', at: [535] },
    { name: 'T3', at: [760] },
    { name: 'T4', at: [1051] },
    { name: 'T5', at: [1541] },
    { name: 'T6', at: [1936] },
    { name: 'Corkscrew', at: [2452, 2497] },
    { name: 'Rainey', at: [2752] },
    { name: 'T10', at: [2967] },
    { name: 'T11', at: [3267] },
  ],
  sectors: [1085, 2530],
  source:
    'Length 3,602 m (2.238 mi), 11 turns, the Andretti Hairpin (T2), Rahal Straight (T6–T7), Corkscrew (T8–8A, an 18 m drop) and Rainey Curve (T9) — Wikipedia "WeatherTech Raceway Laguna Seca". Centreline — OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0): the circuit relation 21195763, its raceway ways in driving order, smoothed (σ 2 m): 3,597 m, 0.13% short of the official length, not rescaled. ~ The start/finish line where the old map-measured layout had it on the front straight (OSM marks none). ~ Width 12 m all round (OSM gives none; the FIA minimum for a circuit). ~ Corners placed at the tightest points of the data, sector ends after T4 and after the Corkscrew. Flat here: the 55 m of climb and fall are not modelled.',
};

export default track;

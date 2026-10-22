import centreline from '../data/osm/monaco';
import type { TrackSpec } from '../types';

/**
 * The technical, slow one: a street circuit of hairpins between barriers, where no straight is
 * long enough to use the power. Clockwise.
 */
const track: TrackSpec = {
  id: 'monaco',
  name: 'Monaco',
  fullName: 'Circuit de Monaco',
  country: 'Monaco',
  lengthM: 3337,
  turns: 19,
  mapHeadingDeg: 62,
  centreline,
  corners: [
    { name: 'Sainte Dévote', at: [220] },
    { name: 'Massenet', at: [835] },
    { name: 'Casino', at: [900] },
    { name: 'Mirabeau', at: [1126] },
    { name: 'Fairmont Hairpin', at: [1256] },
    { name: 'Mirabeau Bas', at: [1346] },
    { name: 'Portier', at: [1436] },
    { name: 'Tunnel', at: [1936] },
    { name: 'Nouvelle Chicane', at: [2091, 2111, 2146] },
    { name: 'Tabac', at: [2371] },
    { name: 'Piscine', at: [2536, 2571] },
    { name: 'Piscine 2', at: [2696, 2721] },
    { name: 'Rascasse', at: [2922] },
    { name: 'Noghès', at: [3012] },
  ],
  sectors: [1455, 2585],
  source:
    'Length 3,337 m, 19 turns, corner names and order — Wikipedia "Circuit de Monaco". Centreline — OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0): the circuit relation 148194, its ways chained in driving order and smoothed (σ 2 m), started at its start-finish node: 3,317 m, 0.6% short of the official length, not rescaled (the chain itself measures 3,322 m; the smoothing rounds the hairpins). ~ Width 9 m all round (OSM gives none; the streets run ~8–12 m between the barriers). ~ Corners placed at the tightest points of the data, sector ends after Portier and after the first Piscine. Flat here: the 44 m climb to Casino Square is not modelled.',
};

export default track;

import centreline from '../data/osm/top-gear';
import type { TrackSpec } from '../types';

/**
 * The fun one: The Stig's figure of eight on Dunsfold aerodrome's runway and taxiways, the track
 * of the Power Laps board. It crosses itself between Chicago and Bentley.
 */
const track: TrackSpec = {
  id: 'top-gear',
  name: 'Top Gear',
  fullName: 'Top Gear Test Track, Dunsfold Aerodrome',
  country: 'UK',
  lengthM: 2820,
  turns: 12,
  mapHeadingDeg: 194,
  centreline,
  corners: [
    { name: 'Crooner Curves', at: [185, 420] },
    { name: 'Willson', at: [490] },
    { name: 'Chicago', at: [786] },
    { name: 'Hammerhead', at: [1346, 1386] },
    { name: 'Follow-Through', at: [1851, 1956] },
    { name: 'Bentley', at: [2167] },
    { name: 'Bacharach', at: [2602] },
    { name: 'Gambon', at: [2742] },
  ],
  sectors: [870, 1970],
  laps: [
    { vehicleId: 'audi-r8-v10-gen2', time: 75.7, note: 'R8 V10 Plus (610 PS), Series 23' },
    { vehicleId: 'lamborghini-huracan-lp610-4', time: 75.8, note: 'Series 22' },
    { vehicleId: 'mercedes-amg-gt-r-c190', time: 76.0, note: 'partly damp, Series 24' },
    { vehicleId: 'nissan-gtr-r35', time: 77.8, note: '2012 GT-R, Series 17' },
    { vehicleId: 'alfa-romeo-giulia-qv-952', time: 81.4, note: 'Series 24' },
    { vehicleId: 'bmw-m3-f80', time: 81.6, note: 'Series 24' },
    { vehicleId: 'mercedes-amg-c63-s-coupe-c205', time: 82.6, note: 'C 63 S, Series 27' },
    { vehicleId: 'lexus-lfa', time: 82.8, note: 'wet, Series 14' },
    { vehicleId: 'alfa-romeo-4c-960', time: 84.8, note: 'Series 21' },
    { vehicleId: 'nissan-370z-z34', time: 87.5, note: '370Z GT, Series 13' },
    {
      vehicleId: 'renault-megane-rs-x95',
      time: 87.7,
      note: 'Mégane RS Cup 265 (the 250’s facelift), Series 19',
    },
    {
      vehicleId: 'mitsubishi-lancer-evolution-x-cz4a',
      time: 88.2,
      note: 'Evo X FQ-300, Series 11',
    },
    { vehicleId: 'ford-focus-rs-mk2', time: 89.3, note: 'Series 13' },
    { vehicleId: 'mazda-rx8-se3p', time: 91.8, note: 'Series 3' },
    { vehicleId: 'mazda-mx5-nd', time: 92.0, note: 'Series 22' },
  ],
  source:
    'Length 2.82 km (1.75 mi), 12 turns, corner names and order (Crooner Curves, Willson, Chicago, Hammerhead, Follow-Through, Bentley, Bacharach, Gambon) — Wikipedia "Top Gear test track". Centreline — OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0): the test track’s raceway ways on Dunsfold aerodrome (traced from the Surrey air survey), chained in driving order from Crooner Curves and smoothed (σ 2 m): 2,852 m, 1.1% longer than the official 1.75 mi, which is a rounded figure (1.745–1.755 mi is 2,808–2,824 m); not rescaled. ~ The start/finish line where the old map-measured layout had it after Gambon (OSM marks none). ~ Width 14 m all round (OSM gives none; the course is coned out on runways and taxiways much wider than that). Power Lap times (The Stig, real cars on road tyres, in the weather of the day) — Wikipedia "List of Top Gear test track Power Lap times".',
};

export default track;

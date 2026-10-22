import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-30-csl-e9',
  name: 'BMW 3.0 CSL (E9)',
  archetype: 'gt',
  examples: ['BMW 2800 CS / 3.0 CS (E9)', 'BMW 635CSi (E24)', 'Mercedes-Benz 280 CE (C114)'],
  years: '1971–1975',
  dims: {
    wheelbaseMm: 2625,
    trackFMm: 1470,
    trackRMm: 1426,
    lengthMm: 4660,
    widthMm: 1730,
    heightMm: 1370,
    overhangFMm: 955,
  },
  // 195/70 VR14 on 7 × 14 Alpina alloys
  // ~ μ (lateral peak) 0.83, set so the sim's 100–0 km/h stop matches: ~44 m from 100 km/h (~0.9 g:
  // 1972 radials, no ABS); no test found
  // ~ kind: period 195/70 VR14
  tires: { widthFMm: 195, widthRMm: 195, diameterMm: 629, mu: 0.83, kind: 'road' },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 880,
    beltHMm: 920,
    cowlXMm: -480,
    roofFrontXMm: -1200,
    roofRearXMm: -2300,
    tailHMm: 880,
    paint: '#eeece4',
  },
  bay: { widthMm: 1150, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'i6-m30',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -260,
    crankYMm: 400,
    // The M30 leans 30° to the right so the bonnet can sit low.
    engineTiltDeg: 30,
    gearbox: 'inline',
    // Getrag four-speed; limited-slip differential standard
    gearboxKg: 45,
    driven: 'rear',
    fuelTank: { litres: 70, xMm: -2900 },
  },
  chassis: 'monocoque',
  // Rear: semi-trailing arms.
  suspension: { front: 'macpherson', rear: 'trailing-arm' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 410 },
  bodyCgFrac: 0.5,
  blurb:
    'A long straight-six behind the front axle, leaning over to keep the bonnet low, in a coupé lightened for touring-car racing.',
  published: {
    curbKg: 1300,
    frontPct: 53,
    source:
      'Lightweight CSL 1165 kg; the UK City Pack (kept by most of the 500 RHD cars) adds ~135 kg of steel panels, bumpers, glass and sound deadening, hence ~ 1300 kg; 7 × 14 Alpina wheels, Getrag 4-speed, LSD — supercarnostalgia.com; wheelbase 2625 mm, tracks 1470/1426 mm, 1270 kg (1973 CSL) — supercars.net; width 1730 mm — encycarpedia; length 4660 mm (E9 with steel bumpers, as the City Pack kept; 4630 mm for the lightweight CSL), height 1370 mm — Wikipedia "BMW E9"; ~ overhang, 70 L tank; ~ 53/47 split estimated (no published axle loads found)',
  },
};

export default v;

import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'ford-mustang-gt350-1965',
  name: 'Shelby Mustang GT350 (1965)',
  archetype: 'sports',
  examples: [
    'Ford Mustang (1964½–1973)',
    'Chevrolet Camaro (1967–1969)',
    'Dodge Challenger (1970)',
  ],
  years: '1965',
  dims: {
    wheelbaseMm: 2743,
    trackFMm: 1435,
    trackRMm: 1448,
    lengthMm: 4613,
    widthMm: 1732,
    heightMm: 1300,
    overhangFMm: 865,
  },
  // 7.75-15 Goodyear Blue Dot bias-ply on 15 × 6 wheels
  tires: { widthFMm: 197, widthRMm: 197, diameterMm: 690, mu: 0.8 },
  body: {
    style: 'fastback',
    tail: 'fastback',
    bonnetHMm: 900,
    beltHMm: 900,
    cowlXMm: -750,
    roofFrontXMm: -1300,
    roofRearXMm: -2250,
    tailHMm: 920,
    paint: '#ecebe6',
  },
  bay: { widthMm: 1150, lengthMm: 900 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ford-289',
    // The V8 sits just behind the front axle line, the long bonnet ahead of the windscreen.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -280,
    crankYMm: 430,
    gearbox: 'inline',
    // Borg-Warner T-10 four-speed
    gearboxKg: 50,
    driven: 'rear',
    fuelTank: { litres: 61, xMm: -3250 },
  },
  chassis: 'monocoque',
  // Rear: a live Ford 9-inch axle on leaf springs, with a Detroit Locker.
  suspension: { front: 'double-wishbone', rear: 'solid-axle' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 250 },
  bodyCgFrac: 0.475,
  extraMasses: [
    {
      id: 'axle-rear',
      label: 'Live rear axle (Ford 9-inch)',
      kg: 45,
      posMm: [-2743, 345, 0],
      sizeMm: [250, 200, 1400],
    },
    // The 1965 GT350 carried its spare where the rear seat would be.
    {
      id: 'spare-wheel',
      label: 'Spare wheel (in place of the rear seat)',
      kg: 25,
      posMm: [-2250, 550, 0],
    },
  ],
  blurb:
    'The pony-car recipe sharpened for racing: a small-block V8 behind the front axle, a prop shaft and a live rear axle.',
  published: {
    curbKg: 1270,
    frontPct: 53,
    source:
      'Wheelbase 108 in (2743 mm), length 181.6 in (4613 mm), 306 bhp 289 Hi-Po, Borg-Warner T-10, 9-inch live axle — Wikipedia "Shelby Mustang"; ~ kerb 2800 lb (1270 kg) — Hagerty; 61 L tank, width 1732 mm, tracks 1435/1448 mm — auto-data.net (GT350R); ~ 53/47 split: Car and Driver 1965 road test as quoted in "Car and Driver on Mustang" (via StangNet), not seen first-hand; ~ overhang, height and luggage',
  },
};

export default v;

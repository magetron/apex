import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-r8-lms-ultra',
  name: 'Audi R8 LMS ultra',
  archetype: 'supercar',
  examples: ['Audi R8 V10 (Gen 1, road car)', 'Lamborghini Gallardo GT3', 'Audi R8 LMS (Gen 2)'],
  years: '2012–2015',
  dims: {
    wheelbaseMm: 2650,
    // ~ tracks and overhang measured on the scaled model (front ~1060 incl. the splitter)
    trackFMm: 1700,
    trackRMm: 1660,
    lengthMm: 4470,
    widthMm: 1984,
    heightMm: 1195,
    overhangFMm: 1030,
  },
  // Michelin slicks: 27/65-18 front, 31/71-18 rear (mu kept under the sim’s 1.3 g cap)
  tires: { widthFMm: 270, widthRMm: 310, diameterMm: 680, mu: 1.2 },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 720,
    beltHMm: 830,
    cowlXMm: -300,
    roofFrontXMm: -950,
    roofRearXMm: -1650,
    tailHMm: 1000,
    paint: '#e8e8e4',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v10',
    // The road R8's V10 ahead of the rear axle, but rear drive only: the front differential and
    // prop shaft are gone, and a sequential 6-speed transaxle sits behind the engine.
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -2050,
    crankYMm: 320,
    gearbox: 'mid-transaxle',
    gearboxKg: 100,
    driven: 'rear',
    fuelTank: { litres: 120, xMm: -1450 },
  },
  // Audi Space Frame with a bolted steel roll cage.
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: {},
  bodyCgFrac: 0.5,
  blurb:
    'The road R8’s V10 and space frame turned GT3 racer: rear drive only, the front axle just steers.',
  published: {
    curbKg: 1250,
    frontPct: 42,
    source:
      'Rear drive, 6-speed sequential, 5.2 V10 up to 419 kW (570 hp) depending on restrictor, ~1250 kg — Audi via CarWale / ConceptCarz (2011); 4470 × 1984 × 1195 mm, 120 L tank, 27/65-18 + 31/71-18 — Wikipedia "Audi R8 LMS Cup" (LMS/LMS ultra); ~ wheelbase as the Gen-1 road car; ~ tracks, split, overhang and engine position estimated',
  },
};

export default v;

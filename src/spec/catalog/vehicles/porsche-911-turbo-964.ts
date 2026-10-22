import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-911-turbo-964',
  name: 'Porsche 911 Turbo 3.6 (964)',
  archetype: 'sports',
  examples: ['Porsche 930 Turbo', 'Porsche 911 Carrera 2 (964)', 'Porsche 993 Carrera'],
  years: '1993–1994',
  dims: {
    wheelbaseMm: 2272,
    trackFMm: 1442,
    trackRMm: 1488,
    lengthMm: 4250,
    widthMm: 1775,
    heightMm: 1290,
    overhangFMm: 910,
  },
  // 225/40 ZR18 front, 265/35 ZR18 rear
  // μ (lateral peak) 0.93, set so the sim's 100–0 km/h stop matches: 100–0 km/h 38.6 m cold / 35.7
  // m warm — turbosition.com (magazine not named)
  // ~ kind: period 17-inch summer
  tires: { widthFMm: 225, widthRMm: 265, diameterMm: 640, mu: 0.93, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 800,
    beltHMm: 880,
    cowlXMm: -560,
    roofFrontXMm: -1100,
    roofRearXMm: -1950,
    tailHMm: 930,
    paint: '#b01e23',
  },
  bay: { widthMm: 1300, lengthMm: 750 },
  powertrain: {
    kind: 'ice',
    engine: 'flat6-m64-50',
    // The whole air-cooled flat-six hangs behind the rear axle, the gearbox ahead of it.
    position: 'rear-overhang',
    orientation: 'longitudinal',
    engineXMm: -2600,
    crankYMm: 400,
    gearbox: 'mid-transaxle',
    // G50/52 five-speed manual with its differential
    gearboxKg: 70,
    driven: 'rear',
    fuelTank: { litres: 77, xMm: 180 },
  },
  chassis: 'monocoque',
  // Rear: semi-trailing arms.
  suspension: { front: 'macpherson', rear: 'trailing-arm' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { front: 100 },
  bodyCgFrac: 0.52,
  blurb:
    'The rear-engined layout at its most extreme: a big air-cooled turbo six behind the rear axle, and late, hard boost.',
  published: {
    curbKg: 1470,
    frontPct: 38,
    source:
      'Kerb 1470 kg, 225/40 ZR18 + 265/35 ZR18 — total911.com, encycarpedia; wheelbase 2272 mm, 4250 × 1775 mm, 77 L tank — carsales.com.au (964 Turbo); tracks 1442/1488 mm — encycarpedia; 38/62 split — Excellence, Dec 1993; ~ height and overhang',
  },
};

export default v;

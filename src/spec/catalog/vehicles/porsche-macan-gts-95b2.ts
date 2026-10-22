import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-macan-gts-95b2',
  name: 'Porsche Macan GTS (95B)',
  archetype: 'suv',
  examples: [
    'Audi Q5 / SQ5 (same MLB platform)',
    'Audi RS 4 (same 2.9 V6)',
    'Porsche Cayenne (E3)',
  ],
  years: '2021–2024',
  dims: {
    wheelbaseMm: 2807,
    trackFMm: 1650,
    trackRMm: 1658,
    lengthMm: 4726,
    widthMm: 1927,
    heightMm: 1609,
    overhangFMm: 950,
  },
  // 265/45 R20 front, 295/40 R20 rear
  tires: { widthFMm: 265, widthRMm: 295, diameterMm: 746, mu: 1.0 },
  body: {
    style: 'suv',
    tail: 'hatch',
    bonnetHMm: 1010,
    beltHMm: 1080,
    cowlXMm: -330,
    roofFrontXMm: -1150,
    roofRearXMm: -2850,
    tailHMm: 1250,
    paint: '#5b8c2a',
  },
  bay: { widthMm: 1250, lengthMm: 950 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-90',
    // Audi MLB packaging: the engine hangs ahead of the front axle, the front diff sits in the
    // gearbox's nose behind it.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 150,
    crankYMm: 470,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Porsche Traction Management: rear-driven, a map-controlled multi-plate clutch sends
    // torque forward as grip demands.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.2,
    fuelTank: { litres: 65, xMm: -2300 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 488 },
  bodyCgFrac: 0.5,
  blurb:
    'An Audi Q5 platform with a Porsche clutch: the V6 hangs over the nose, but the rear wheels do most of the driving.',
  published: {
    curbKg: 1910,
    frontPct: 56,
    source:
      'Kerb 1910 kg DIN (1985 kg EC) — Porsche Finder listings (Macan GTS MY21–22); 324 kW (440 PS) / 550 Nm, 7-speed PDK, active AWD with map-controlled multi-plate clutch — Porsche GTS technical data (2021); 4726 × 1927 × 1609 mm, wheelbase 2807, track 1650/1658, 265/45 R20 + 295/40 R20, 65 L — cars-data.com (GTS MY21); ~ overhang 950 from the model (to scale: 4731 mm long); ~ 56/44 split and engine position estimated',
  },
};

export default v;

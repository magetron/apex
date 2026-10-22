import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-s4-b8',
  name: 'Audi S4 (B8.5)',
  archetype: 'saloon',
  examples: ['Audi A4 / A5 / Q5 (B8, MLB)', 'Audi S5 (B8)', 'Audi A6 3.0 TFSI quattro (C7)'],
  years: '2012–2016',
  dims: {
    wheelbaseMm: 2811,
    trackFMm: 1552,
    trackRMm: 1539,
    lengthMm: 4717,
    widthMm: 1826,
    heightMm: 1406,
    overhangFMm: 890,
  },
  // 245/40 R18
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 653, mu: 1.0 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 920,
    beltHMm: 990,
    cowlXMm: -480,
    roofFrontXMm: -1280,
    roofRearXMm: -2850,
    tailHMm: 1080,
    paint: '#20252b',
  },
  bay: { widthMm: 1250, lengthMm: 950 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-ea837',
    // B8 (MLB): the front diff moved ahead of the clutch, so the front axle came 154 mm
    // forward relative to the engine. The engine still sits ahead of the axle, but less of it.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 120,
    crankYMm: 460,
    gearbox: 'inline',
    gearboxKg: 120,
    driven: 'all',
    // Self-locking centre diff, 40:60 nominal.
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 61, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 480 },
  bodyCgFrac: 0.53,
  extraMasses: [{ id: 'battery', label: '12 V battery (boot)', kg: 20, posMm: [-3300, 350, 450] }],
  blurb:
    'Audi’s nose-heavy layout, partly fixed: moving the front diff ahead of the clutch let the axle move forward under the engine.',
  published: {
    curbKg: 1705,
    frontPct: 55,
    source:
      'Facelift saloon 4716–4717 × 1826 × 1406 mm, wb 2811 — cararac / vehiclesizes; unladen 1650 kg (6MT) / 1705 kg (7 S tronic) — fastcarcheck.uk; ~ 55/45 split from a 2010 S4 test (Edmunds Inside Line, via German Car Forum); tracks 1552/1539 — Audi S4 (B8) technical data, 2009; front axle 154 mm forward vs B7 — Audi; ~ engine position and 61 L tank estimated',
  },
};

export default v;

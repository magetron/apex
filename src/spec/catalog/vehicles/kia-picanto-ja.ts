import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'kia-picanto-ja',
  name: 'Kia Picanto 1.2 GT-Line (JA)',
  archetype: 'city',
  examples: ['Hyundai i10 (same platform)', 'Toyota Aygo X', 'Fiat Panda'],
  dims: {
    wheelbaseMm: 2400,
    trackFMm: 1394,
    trackRMm: 1402,
    lengthMm: 3605,
    widthMm: 1595,
    heightMm: 1485,
    overhangFMm: 695,
  },
  // 195/45 R16
  // μ (lateral peak) 0.94, set so the sim's 100–0 km/h stop matches: 100–0 km/h 38.0 m cold / 39.5
  // m warm — Auto Bild (Picanto 1.2 facelift)
  // ~ kind: OE touring
  tires: { widthFMm: 195, widthRMm: 195, diameterMm: 582, mu: 0.94, kind: 'road' },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 1040,
    cowlXMm: -260,
    roofFrontXMm: -1050,
    roofRearXMm: -2500,
    tailHMm: 1140,
    paint: '#2f4a26',
  },
  bay: { widthMm: 960, lengthMm: 540 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-g4lf',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 380,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 38,
    driven: 'front',
    fuelTank: { litres: 35, xMm: -1850 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 255 },
  bodyCgFrac: 0.43,
  blurb:
    'A city car at its most compact: wheels pushed to the corners, the whole drivetrain in the short nose.',
  published: {
    curbKg: 976,
    frontPct: 62,
    source:
      'Wb 2400, 3605 × 1595 × 1485 mm, 35 L tank, 195/45 R16 — auto-data.net (Picanto III facelift 2023, 1.2 DPi); tracks 1394/1402, kerb (tare) 976 kg — carexpert.com.au (2024 GT-Line 1.2 manual, Australia); ~ 62/38 split estimated (small FF; no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;

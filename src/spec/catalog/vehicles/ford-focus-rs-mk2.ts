import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'ford-focus-rs-mk2',
  name: 'Ford Focus RS (Mk2)',
  archetype: 'hot-hatch',
  examples: [
    'Renault Mégane RS 250 (X95)',
    'Volvo C30 T5 (same five-cylinder and platform)',
    'Opel Astra OPC (H)',
  ],
  years: '2009–2010',
  dims: {
    wheelbaseMm: 2640,
    trackFMm: 1586,
    trackRMm: 1587,
    lengthMm: 4402,
    widthMm: 1842,
    heightMm: 1484,
    overhangFMm: 885,
  },
  // 235/35 R19
  // μ (lateral peak) 1.13, set so the sim's 100–0 km/h stop matches: 100–0 km/h 33 m — fastestlaps
  // (magazine not shown)
  // ~ kind: OE 19-inch summer
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 647, mu: 1.13, kind: 'performance' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 1030,
    cowlXMm: -250,
    roofFrontXMm: -1050,
    roofRearXMm: -2450,
    tailHMm: 1140,
    paint: '#6cbf2c',
  },
  bay: { widthMm: 1140, lengthMm: 660 },
  powertrain: {
    kind: 'ice',
    engine: 'i5-duratec-rs',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 200,
    crankYMm: 420,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    // 6-speed M66 manual with a Quaife helical limited-slip differential
    gearboxKg: 65,
    driven: 'front',
    fuelTank: { litres: 55, xMm: -2050 },
  },
  chassis: 'monocoque',
  // front: RevoKnuckle, a MacPherson strut with a separate steering knuckle to cut torque steer
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 385 },
  bodyCgFrac: 0.44,
  blurb:
    'Five cylinders across the nose and 305 PS through the front wheels: the torque-steer problem, answered with a steering knuckle that keeps the kingpin offset short.',
  published: {
    curbKg: 1467,
    frontPct: 63,
    source:
      'Wb 2640, 4402 × 1842 × 1484 mm, kerb 1467 kg (UK; AU 1492 kg), 235/35 R19 — Ford via Top Gear and australiancar.reviews; tracks 1586/1587 — auto-data.net (RS is ~40 mm wider than a Focus Mk2); ~ 55 L tank (Focus Mk2), ~ 63/37 split estimated (no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;

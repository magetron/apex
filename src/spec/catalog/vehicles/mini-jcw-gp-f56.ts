import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mini-jcw-gp-f56',
  name: 'Mini John Cooper Works GP (F56)',
  archetype: 'hot-hatch',
  examples: ['VW Polo GTI', 'Hyundai i20 N', 'Mini Cooper S (F56)'],
  dims: {
    wheelbaseMm: 2495,
    trackFMm: 1525,
    trackRMm: 1525,
    lengthMm: 3879,
    widthMm: 1762,
    heightMm: 1420,
    overhangFMm: 790,
  },
  // 225/35 R18
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 615, mu: 1.05 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 905,
    beltHMm: 990,
    cowlXMm: -420,
    roofFrontXMm: -950,
    roofRearXMm: -2400,
    tailHMm: 1100,
    paint: '#2a2b2e',
  },
  bay: { widthMm: 1080, lengthMm: 600 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-b48',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 180,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    // 8-speed Aisin automatic with a mechanical limited-slip differential
    gearboxKg: 85,
    driven: 'front',
    fuelTank: { litres: 44, xMm: -1950 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  // the GP has no rear seats: a strut brace crosses where they were
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 160 },
  bodyCgFrac: 0.45,
  blurb:
    'Over 300 PS through the front wheels of a short car: a mechanical limited-slip differential and wide tyres fight wheelspin and torque steer.',
  published: {
    curbKg: 1255,
    frontPct: 63,
    source:
      'Wb 2495, 3879 × 1762 × 1420 mm, kerb 1255 kg, 44 L tank, 225/35 R18 — MINI via carexpert.com.au; tracks: F56 JCW 1485 mm (BMW Group press kit) + ~40 mm on the GP (Top Gear) ≈ 1525; ~ 63/37 split estimated (no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;

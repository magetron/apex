import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'smart-fortwo-brabus-451',
  name: 'Smart ForTwo Brabus (451)',
  archetype: 'city',
  examples: [
    'Smart ForTwo (C453, Renault-engined successor)',
    'Fiat 500 (1957, original)',
    'Renault Twingo III',
  ],
  years: '2007–2014',
  dims: {
    wheelbaseMm: 1867,
    trackFMm: 1270,
    trackRMm: 1363,
    lengthMm: 2695,
    widthMm: 1559,
    heightMm: 1542,
    overhangFMm: 420,
  },
  // 175/50 R16 front, 225/35 R17 rear (Brabus Monoblock VI)
  tires: { widthFMm: 175, widthRMm: 225, diameterMm: 581, mu: 0.9 },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 900,
    beltHMm: 1000,
    cowlXMm: 100,
    roofFrontXMm: -500,
    roofRearXMm: -1900,
    tailHMm: 1400,
    paint: '#f0c419',
  },
  bay: { widthMm: 900, lengthMm: 500 },
  powertrain: {
    kind: 'ice',
    engine: 'i3-3b21',
    position: 'rear-underfloor',
    orientation: 'transverse',
    engineXMm: -1780,
    crankYMm: 330,
    // The 3B21 is built to lie 45° over, top towards the tail, so it fits under the boot floor.
    engineTiltDeg: 45,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 50,
    driven: 'rear',
    fuelTank: { litres: 33, xMm: -900 },
  },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 220 },
  chassis: 'monocoque',
  // MacPherson struts in front, a De Dion tube at the back (the closest kind here: solid axle).
  suspension: { front: 'macpherson', rear: 'solid-axle' },
  bodyCgFrac: 0.51,
  blurb:
    'The shortest practical car: the engine goes under the boot floor, so the cabin fills almost the whole length.',
  published: {
    curbKg: 780,
    frontPct: 42,
    source:
      'ForTwo Brabus (451): 72 kW / 140 Nm, kerb 780 kg, wheelbase 1867 mm, track 1270/1363 mm, 175/50 R16 front + 225/35 R17 rear, 5-speed automated manual, body 10 mm lower — Mercedes-Benz press release (2007); 2695 × 1559 × 1542 mm, 33 L, 220 L boot — auto-data.net (Brabus 98 PS); evo quotes 790 kg; ~ 420 mm front overhang (the model measures 432); ~ 42/58 split estimated (no published figure found)',
  },
};

export default v;

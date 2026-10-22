import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'aston-martin-one-77',
  name: 'Aston Martin One-77',
  archetype: 'gt',
  years: '2009–2012',
  examples: [
    'Aston Martin DB9 / DBS / DB11 (front-mid V12 + rear transaxle)',
    'Ferrari 599 / F12 / 812',
    'Mercedes-AMG GT (C190)',
  ],
  dims: {
    wheelbaseMm: 2791,
    trackFMm: 1706,
    trackRMm: 1627,
    lengthMm: 4601,
    widthMm: 2000,
    heightMm: 1222,
    overhangFMm: 920,
  },
  // 255/35 ZR20 front, 335/30 ZR20 rear
  // ~ μ (lateral peak) 1.1, set so the sim's 100–0 km/h stop matches: ~33 m from 100 km/h, as 2010
  // supercars on P Zero Corsa (sport auto: 32.2 m warm); no test found
  // ~ kind: OE Pirelli P Zero Corsa
  tires: { widthFMm: 255, widthRMm: 335, diameterMm: 698, mu: 1.1, kind: 'cup' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 850,
    beltHMm: 880,
    cowlXMm: -560,
    roofFrontXMm: -1380,
    roofRearXMm: -2750,
    tailHMm: 965,
    paint: '#4a5359',
  },
  bay: { widthMm: 1300, lengthMm: 1250 },
  powertrain: {
    kind: 'ice',
    engine: 'v12-am77',
    // The whole V12 sits behind the front axle (its front ~26 cm behind the wheel centre line),
    // and the dry sump drops it 100 mm lower than in a DB9.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -640,
    crankYMm: 330,
    // Six-speed automated manual at the rear axle, fed by a carbon prop shaft in a magnesium
    // torque tube.
    gearbox: 'rear-transaxle',
    gearboxKg: 120,
    driven: 'rear',
    fuelTank: { litres: 88, xMm: -2150 },
  },
  chassis: 'carbon-tub',
  suspension: { front: 'pushrod', rear: 'pushrod' },
  seats: { layout: '2', rows: 1 },
  luggageL: {},
  bodyCgFrac: 0.52,
  extraMasses: [
    {
      id: 'torque-tube',
      label: 'Torque tube + carbon prop shaft',
      kg: 22,
      posMm: [-1650, 330, 0],
      sizeMm: [1900, 120, 120],
    },
  ],
  blurb:
    'A big V12 pushed behind the front axle and the gearbox moved to the rear: a front-engined car balanced like a mid-engined one.',
  published: {
    curbKg: 1630,
    frontPct: 49,
    source:
      'Kerb 1630 kg, 49:51 split, 4601 × 2000 × 1222 mm, wheelbase 2791, whole engine behind the front axle, rear transaxle, 180 kg carbon tub — AutoZine; 1627 kg, front track 1706, 88 L, 255/35 + 335/30 ZR20, double-wishbone pushrod suspension, magnesium torque tube — Aston Martin (astonmartins.com); engine ~26 cm behind the front wheel centre line — astonmartins.com; ~ rear track 1627 (guideautoweb); ~ overhang from the 3D model',
  },
};

export default v;

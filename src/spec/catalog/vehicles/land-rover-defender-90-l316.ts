import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'land-rover-defender-90-l316',
  name: 'Land Rover Defender 90 V8 (1997)',
  archetype: 'offroader',
  examples: [
    'Land Rover Series I–III',
    'Mercedes-Benz G-Class (W460/W463)',
    'Toyota Land Cruiser 70',
  ],
  years: '1983–2016',
  dims: {
    wheelbaseMm: 2360,
    trackFMm: 1486,
    trackRMm: 1486,
    lengthMm: 3990,
    widthMm: 1790,
    heightMm: 2037,
    overhangFMm: 660,
  },
  // LT265/75 R16
  // ~ μ (lateral peak) 0.68, set so the sim's 100–0 km/h stop matches: ~51 m from 100 km/h (1997
  // all-terrain tyres, high CG); no test found
  // ~ kind: period all-terrain
  tires: { widthFMm: 265, widthRMm: 265, diameterMm: 804, mu: 0.68, kind: 'offroad' },
  body: {
    style: 'offroader',
    tail: 'hatch',
    bonnetHMm: 1250,
    beltHMm: 1350,
    cowlXMm: -650,
    roofFrontXMm: -950,
    roofRearXMm: -2950,
    tailHMm: 1550,
    paint: '#4d5a3b',
  },
  bay: { widthMm: 1150, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-rover-40',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -250,
    // High above the beam axle and the chassis rails, for ground clearance.
    crankYMm: 620,
    gearbox: 'inline',
    // ZF 4HP22 four-speed automatic
    gearboxKg: 75,
    driven: 'all',
    // LT230 transfer box: permanent four-wheel drive, lockable centre diff and low range.
    awd: 'transfer-case',
    frontTorqueShare: 0.5,
    awdDevice: { type: 'open', name: 'LT230', lockable: true },
    fuelTank: { litres: 59, xMm: -2300 },
  },
  chassis: 'ladder-frame',
  suspension: { front: 'solid-axle', rear: 'solid-axle' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 500 },
  bodyCgFrac: 0.48,
  extraMasses: [
    {
      id: 'ladder-frame',
      label: 'Ladder frame',
      kg: 190,
      posMm: [-1200, 480, 0],
      sizeMm: [3600, 180, 850],
    },
    {
      id: 'axle-front',
      label: 'Front axle beam',
      kg: 70,
      posMm: [0, 402, 0],
      sizeMm: [300, 200, 1400],
    },
    {
      id: 'axle-rear',
      label: 'Rear axle beam (Salisbury)',
      kg: 85,
      posMm: [-2360, 402, 0],
      sizeMm: [300, 200, 1400],
    },
    { id: 'spare-wheel', label: 'Spare wheel (on the rear door)', kg: 40, posMm: [-3420, 1000, 0] },
  ],
  blurb:
    'Aluminium panels on a steel ladder frame, two beam axles and permanent four-wheel drive with a lockable centre diff and low range.',
  published: {
    curbKg: 1775,
    frontPct: 52,
    source:
      'NAS Defender 90 (1997): 4.0 V8, ZF 4-speed auto, wheelbase 92.9 in (2360 mm), 3990 × 1790 × 2037 mm — Land Rover D90 spec sheet (landroverusa.com); hard top 3913 lb (1775 kg), soft top 3560 lb — kbb.com; LT265/75R16 — dealer listing; 15.6 US gal (59 L) tank — kbb.com; ~ 1486 mm tracks, overhang; ~ 52/48 split and ~ frame/axle masses estimated',
  },
};

export default v;

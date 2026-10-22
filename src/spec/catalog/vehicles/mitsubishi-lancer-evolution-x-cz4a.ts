import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mitsubishi-lancer-evolution-x-cz4a',
  name: 'Mitsubishi Lancer Evolution X (CZ4A)',
  archetype: 'saloon',
  examples: [
    'Mitsubishi Lancer Evolution I–IX',
    'Lancia Delta HF Integrale (transverse, centre diff)',
    'Toyota Celica GT-Four',
  ],
  years: '2007–2016',
  dims: {
    wheelbaseMm: 2650,
    trackFMm: 1545,
    trackRMm: 1545,
    lengthMm: 4505,
    widthMm: 1810,
    heightMm: 1480,
    overhangFMm: 920,
  },
  // 245/40 R18
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 653, mu: 1.0 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 930,
    beltHMm: 985,
    cowlXMm: -290,
    roofFrontXMm: -1100,
    roofRearXMm: -2450,
    tailHMm: 1120,
    paint: '#a8161d',
  },
  bay: { widthMm: 1200, lengthMm: 750 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-4b11t',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 200,
    crankYMm: 430,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 85,
    driven: 'all',
    // S-AWC: ACD (a 50:50 centre diff locked by a hydraulic multi-plate clutch), AYC
    // (a torque-vectoring rear diff) and a helical front LSD.
    awd: 'center-diff',
    frontTorqueShare: 0.5,
    awdDevice: { type: 'locking-clutch', name: 'ACD' },
    fuelTank: { litres: 55, xMm: -2000 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 195 },
  bodyCgFrac: 0.49,
  extraMasses: [
    { id: 'transfer', label: 'Transfer (power take-off)', kg: 18, posMm: [-60, 320, -100] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 13,
      posMm: [-1300, 300, 0],
      sizeMm: [2200, 80, 80],
    },
    { id: 'ayc', label: 'Active yaw control unit', kg: 12, posMm: [-2650, 330, 0] },
    // Battery and washer tank live in the boot.
    { id: 'battery', label: '12 V battery (boot)', kg: 18, posMm: [-3200, 380, 400] },
  ],
  blurb:
    'The rally saloon’s answer to a transverse engine: a locking centre diff and an active rear diff to steer the car with torque.',
  published: {
    curbKg: 1595,
    frontPct: 57,
    source:
      'Kerb 3517 lb (1595 kg) GSR, 56.7/43.3 weight split — Mitsubishi USA media ("Lancer performance models compared"); wb 2650, tracks 1545/1545, 4505 mm long (US) — carsales.com.au and J.D. Power; 1810 × 1480 mm, 245/40 R18, 55 L — Mitsubishi; 2015 Final Edition is the GSR with 303 hp; ~ front overhang 920 mm measured on the 3D model; ~ engine position estimated',
  },
};

export default v;

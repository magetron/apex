import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-m4-competition-g82',
  name: 'BMW M4 Competition Coupé (G82)',
  archetype: 'sports',
  examples: [
    'BMW M3 (G80, the saloon twin)',
    'Mercedes-AMG C 63 S Coupé (C205)',
    'Audi RS 5 Coupé (B9)',
  ],
  years: '2021–',
  dims: {
    wheelbaseMm: 2857,
    trackFMm: 1617,
    trackRMm: 1605,
    lengthMm: 4794,
    widthMm: 1887,
    heightMm: 1393,
    overhangFMm: 861,
  },
  // 275/35 R19 front, 285/30 R20 rear
  tires: { widthFMm: 275, widthRMm: 285, diameterMm: 675, mu: 1.05 },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 940,
    beltHMm: 980,
    cowlXMm: -580,
    roofFrontXMm: -1380,
    roofRearXMm: -2550,
    tailHMm: 1040,
    paint: '#e3c13a',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6-s58-competition',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -300,
    crankYMm: 440,
    gearbox: 'inline',
    gearboxKg: 70,
    driven: 'rear',
    fuelTank: { litres: 59, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 440 },
  bodyCgFrac: 0.53,
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 20, posMm: [-3350, 400, 300] },
  ],
  blurb:
    'A big six behind the front axle driving the rear wheels, with wider rear tyres and an active rear differential.',
  published: {
    curbKg: 1725,
    frontPct: 52,
    source:
      'M4 Competition Coupé with rear-wheel drive (the model’s title names no M xDrive; for 2025 the rear-drive Competition stays in the US, Europe and Canada get M xDrive only — carbuyer.co.uk, BMW Canada): 375 kW (510 PS) / 650 Nm, 4794 × 1887 × 1393 mm, wheelbase 2857, track 1617/1605, 440 L — auto-motor-und-sport.de technical data; 275/35 ZR19 + 285/30 ZR20 — BMW Canada 2025 press kit (Competition); kerb 1725 kg DIN = 1800 kg EU less the 75 kg driver — autotijd.be / BMW technical data; 59 L as the M3; ~ 861 mm front overhang as the M3 (same nose; the model measures 868); ~ 52/48 split estimated (BMW M quotes 53.9/46.1 for the heavier M xDrive car)',
  },
};

export default v;

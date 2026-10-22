import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'honda-integra-china-2022',
  name: 'Honda Integra 1.5T (China, 2022)',
  archetype: 'saloon',
  examples: [
    'Honda Civic (11th gen, same platform)',
    'Acura Integra (DE, US liftback)',
    'Toyota Corolla saloon',
  ],
  dims: {
    wheelbaseMm: 2735,
    trackFMm: 1547,
    trackRMm: 1575,
    lengthMm: 4689,
    widthMm: 1802,
    heightMm: 1415,
    overhangFMm: 945,
  },
  // 225/45 R18 (top trims; 215/55 R16 and 215/50 R17 also offered)
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 660, mu: 0.95 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 925,
    beltHMm: 1000,
    cowlXMm: -420,
    roofFrontXMm: -1200,
    roofRearXMm: -2350,
    tailHMm: 1100,
    paint: '#3fae95',
  },
  bay: { widthMm: 1100, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-l15c',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 170,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 70,
    driven: 'front',
    fuelTank: { litres: 47, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 495 },
  bodyCgFrac: 0.44,
  blurb:
    'A long, low saloon on a front-drive hatch platform: the engine stays across the nose and the extra length goes to cabin and boot.',
  published: {
    curbKg: 1360,
    frontPct: 61,
    source:
      'Wb 2735, 4689 × 1802 × 1415 mm, 1.5T 240 Turbo 182 PS / 240 Nm, CVT or 6MT, 215/55 R16 – 225/45 R18 — GAC Honda via carnewschina.com; tracks 1547/1575 (Civic XI, auto-data.net); ~ kerb 1360 kg (US Civic sedan 1.5T 3004 lb), ~ 47 L tank (Civic), ~ 61/39 split and engine position estimated; ~ front overhang measured on the 3D model',
  },
};

export default v;

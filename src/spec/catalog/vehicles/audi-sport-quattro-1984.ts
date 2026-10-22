import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-sport-quattro-1984',
  name: 'Audi Sport quattro',
  archetype: 'sports',
  examples: [
    'Audi Quattro (Ur-quattro, long wheelbase)',
    'Audi 80 quattro',
    'Audi Sport quattro S1',
  ],
  years: '1984–1985',
  dims: {
    wheelbaseMm: 2224,
    trackFMm: 1516,
    trackRMm: 1492,
    lengthMm: 4160,
    widthMm: 1780,
    heightMm: 1345,
    overhangFMm: 955,
  },
  // 235/45 VR15 on 9J × 15
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 593, mu: 0.95 },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 880,
    beltHMm: 940,
    cowlXMm: -420,
    roofFrontXMm: -1100,
    roofRearXMm: -1950,
    tailHMm: 1000,
    paint: '#c4161c',
  },
  bay: { widthMm: 1100, lengthMm: 900 },
  powertrain: {
    kind: 'ice',
    engine: 'i5-kw',
    // The whole five-cylinder still hangs ahead of the front axle, now on a 300 mm shorter car.
    position: 'front-overhang',
    orientation: 'longitudinal',
    // ~ position and crank height: placed so the sump sits inside the measured underbody and the
    // cam cover under the bonnet
    engineXMm: 290,
    crankYMm: 455,
    gearbox: 'inline',
    gearboxKg: 60,
    driven: 'all',
    // Open centre and rear diffs, both lockable by the driver.
    awd: 'center-diff',
    frontTorqueShare: 0.5,
    awdDevice: { type: 'open', lockable: true },
    fuelTank: { litres: 90, xMm: -1950 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'macpherson' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 250 },
  bodyCgFrac: 0.44,
  blurb:
    'The Group B homologation special: the Quattro cut short between the axles, its five-cylinder still ahead of the front wheels.',
  published: {
    curbKg: 1300,
    frontPct: 61,
    source:
      'Wheelbase 2224 mm (Audi; 300 mm shorter than the Quattro), 4160 × 1780 × 1345 mm, tracks 1516/1492, 1300 kg, 5-speed manual — auto motor und sport data (1983–85) and Wikipedia "Audi Sport quattro" (de); 235/45 VR15 on 9J × 15 and lockable diffs (de.wikipedia); 90 L — ultimatespecs; ~ overhang and engine position; ~ 61/39 split estimated from the Quattro’s measured 60/40 (no published axle loads found)',
  },
};

export default v;

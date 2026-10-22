import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mclaren-artura-gt4',
  name: 'McLaren Artura GT4',
  archetype: 'supercar',
  examples: [
    'McLaren Artura (road car, plug-in hybrid)',
    'McLaren 570S GT4',
    'Ferrari 296 GT3 (120° V6)',
  ],
  years: '2023–',
  dims: {
    wheelbaseMm: 2640,
    trackFMm: 1650,
    trackRMm: 1613,
    // ~ measured on the scaled GT4 model (splitter, diffuser); the road car is 4539
    lengthMm: 4625,
    widthMm: 1913,
    heightMm: 1193,
    overhangFMm: 1175,
  },
  // ~ 18-inch GT4 slicks; mu kept under the sim’s 1.3 g cap
  tires: { widthFMm: 265, widthRMm: 305, diameterMm: 665, mu: 1.2 },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 720,
    beltHMm: 830,
    cowlXMm: -320,
    roofFrontXMm: -950,
    roofRearXMm: -1600,
    tailHMm: 1000,
    paint: '#ff7a00',
  },
  bay: { widthMm: 1250, lengthMm: 900 },
  powertrain: {
    kind: 'ice',
    // The GT4 drops the road car's e-motor and battery (GT4 rules allow no hybrids): the twin-turbo
    // V6 alone drives the rear wheels.
    engine: 'v6-m630',
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -1980,
    crankYMm: 310,
    gearbox: 'mid-transaxle',
    gearboxKg: 100,
    driven: 'rear',
    fuelTank: { litres: 100, xMm: -1450 },
  },
  chassis: 'carbon-tub',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: {},
  bodyCgFrac: 0.5,
  blurb:
    'The road car’s carbon tub and V6 without the hybrid: a mid-engined race car, rear drive only.',
  published: {
    curbKg: 1200,
    frontPct: 42,
    source:
      'GT4 is not a hybrid (rules): V6 only, rear drive, seven-speed gearbox with a mechanical LSD, ~1200 kg, 130 kg of hybrid parts removed — Autocar / Motor1 / Carscoops (2022 reveal); wheelbase 2640, track 1650/1613, 4539 × 1913 × 1193 mm as the road Artura (Wikipedia, CarExpert); ~ race power is set by BoP; ~ split, tank, tyres and engine position estimated',
  },
};

export default v;

import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'lotus-elise-sprint-220-s3',
  name: 'Lotus Elise Sprint 220 (S3)',
  archetype: 'sports',
  examples: ['Lotus Elise 111R (S2)', 'Toyota MR2 (AW11, W30)', 'Fiat X1/9'],
  years: '2017–2021',
  dims: {
    wheelbaseMm: 2300,
    trackFMm: 1499,
    trackRMm: 1548,
    lengthMm: 3824,
    widthMm: 1719,
    heightMm: 1117,
    overhangFMm: 800,
  },
  // 175/55 R16 front, 225/45 R17 rear
  // ~ μ (lateral peak) 0.99, set so the sim's 100–0 km/h stop matches: ~35 m from 100 km/h (878 kg
  // on track-biased tyres); no test found
  // ~ kind: OE Yokohama Advan Neova (track-biased street tyre)
  tires: { widthFMm: 175, widthRMm: 225, diameterMm: 599, mu: 0.99, kind: 'performance' },
  body: {
    style: 'roadster',
    tail: 'engine-deck',
    bonnetHMm: 700,
    beltHMm: 780,
    cowlXMm: -550,
    roofFrontXMm: -900,
    roofRearXMm: -1500,
    tailHMm: 850,
    paint: '#14532d',
  },
  bay: { widthMm: 1100, lengthMm: 600 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-2zr-sc',
    // A front-drive engine + gearbox unit, installed across the car behind the seats.
    position: 'mid',
    orientation: 'transverse',
    engineXMm: -2130,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 40,
    driven: 'rear',
    fuelTank: { litres: 40, xMm: -1500 },
  },
  // Bonded extruded-aluminium tub.
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 115 },
  // Occupants sit well aft of mid-wheelbase; the front clam carries little but the radiator.
  bodyCgFrac: 0.55,
  blurb:
    'A front-drive car’s engine and gearbox moved behind the seats of a featherweight two-seater.',
  published: {
    curbKg: 878,
    frontPct: 38,
    source:
      'Elise Sprint 220 (2018): kerb 878 kg (tare 851 kg), 162 kW / 250 Nm supercharged 1.8, 6-speed manual, 3824 × 1719 × 1117 mm, wheelbase 2300, track 1499/1548, 175/55 R16 + 225/45 R17, 40 L — carsales.com.au; 878 kg kerb also PistonHeads (2017 road test); bonded aluminium tub and double wishbones as every Elise — Wikipedia "Lotus Elise"; ~ 38/62 split as commonly quoted for the Elise (not found in a primary source); ~ front overhang measured on the model; ~ 115 L boot as the S2',
  },
};

export default v;

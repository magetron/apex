import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bugatti-chiron-pur-sport',
  name: 'Bugatti Chiron Pur Sport',
  archetype: 'hypercar',
  examples: ['Bugatti Chiron', 'Bugatti Divo', 'Bugatti Veyron 16.4 Super Sport'],
  dims: {
    wheelbaseMm: 2711,
    trackFMm: 1776,
    trackRMm: 1695,
    // the longer nose splitter and fixed rear wing add ~100 mm over the Chiron
    lengthMm: 4647,
    widthMm: 2038,
    heightMm: 1212,
    // ~ measured on the model (no published figure)
    overhangFMm: 985,
  },
  // Michelin Sport Cup 2 R, 285/30 R20 front, 355/25 R21 rear
  // ~ μ (lateral peak) 1.01, set so the sim's 100–0 km/h stop matches: ~34.9 m from 100 km/h: the
  // Chiron estimate less 5 % (Cup 2 R, −50 kg); no test found
  // kind: Michelin Pilot Sport Cup 2 R (factory fit)
  tires: { widthFMm: 285, widthRMm: 355, diameterMm: 679, mu: 1.01, kind: 'cup' },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 780,
    beltHMm: 860,
    cowlXMm: -350,
    roofFrontXMm: -1000,
    roofRearXMm: -1700,
    tailHMm: 1000,
    paint: '#2b2f36',
  },
  bay: { widthMm: 1400, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'w16',
    position: 'mid',
    orientation: 'longitudinal',
    // ~ W16 behind the fuel tank, its gearbox and rear diff over the rear axle (Veyron/Chiron layout)
    engineXMm: -2050,
    crankYMm: 420,
    gearbox: 'mid-transaxle',
    gearboxKg: 160,
    driven: 'all',
    // as the Chiron: rear driven directly, a clutch-controlled front axle takes a share
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.3,
    fuelTank: { litres: 100, xMm: -1450 },
  },
  chassis: 'carbon-tub',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 44 },
  bodyCgFrac: 0.5,
  blurb:
    'The Chiron made lighter and stiffer for corners rather than top speed: same W16 amidships.',
  published: {
    curbKg: 1945,
    frontPct: 44,
    source:
      'Weight 1945 kg, 50 kg below the Chiron (Bugatti press release "A pure driving machine", 2020); dims and tracks from autotijd.be (Chiron Pur Sport 2020–2023); tyres from Bugatti; ~ 44/56 split assumed as the Chiron',
  },
};

export default v;

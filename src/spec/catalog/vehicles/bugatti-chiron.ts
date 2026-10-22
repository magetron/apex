import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bugatti-chiron',
  name: 'Bugatti Chiron',
  archetype: 'hypercar',
  examples: ['Bugatti Veyron 16.4', 'Bugatti Divo', 'Bugatti Chiron Super Sport'],
  dims: {
    wheelbaseMm: 2711,
    trackFMm: 1748,
    trackRMm: 1666,
    lengthMm: 4544,
    widthMm: 2038,
    heightMm: 1212,
    overhangFMm: 920,
  },
  // 285/30 R20 front, 355/25 R21 rear
  // ~ μ (lateral peak) 0.97, set so the sim's 100–0 km/h stop matches: ~36.7 m from 100 km/h, as
  // the Veyron Super Sport test; no instrumented Chiron test found (31.3 m is a claim)
  // ~ kind: OE Michelin Pilot Sport Cup 2 (bespoke)
  tires: { widthFMm: 285, widthRMm: 355, diameterMm: 679, mu: 0.97, kind: 'cup' },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 780,
    beltHMm: 860,
    cowlXMm: -350,
    roofFrontXMm: -1000,
    roofRearXMm: -1700,
    tailHMm: 1000,
    paint: '#1d3f8f',
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
    // Permanent AWD: the rear is driven directly, a clutch-controlled front axle takes a share.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.3,
    fuelTank: { litres: 100, xMm: -1450 },
  },
  chassis: 'carbon-tub',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 44 },
  bodyCgFrac: 0.5,
  // Ten radiators: most of the cooling mass sits up front and in the flanks.
  blurb:
    'The extreme: a sixteen-cylinder engine mounted amidships, with all-wheel drive to deploy it.',
  published: {
    curbKg: 1995,
    frontPct: 44,
    source:
      'Kerb 1995 kg DIN (W16 1500 PS) — autotijd.be; ~ 44/56 split as quoted on German Car Forum (unverified); ~ dims from Bugatti data, not re-checked',
  },
};

export default v;

import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'jeep-wrangler-rubicon-392-jl',
  name: 'Jeep Wrangler Unlimited Rubicon 392 (JL)',
  archetype: 'offroader',
  examples: [
    'Jeep Wrangler (every generation)',
    'Ford Bronco (U725)',
    'Land Rover Defender (classic)',
  ],
  years: '2021–2024',
  dims: {
    wheelbaseMm: 3008,
    trackFMm: 1636,
    trackRMm: 1636,
    // includes the spare wheel on the tailgate
    lengthMm: 4786,
    widthMm: 1875,
    heightMm: 1893,
    overhangFMm: 770,
  },
  // LT285/70 R17
  // μ (lateral peak) 0.78, set so the sim's lateral limit matches: skidpad 0.72 g, 200 ft —
  // Edmunds, 2021
  // ~ kind: OE 33-inch all-terrain
  tires: { widthFMm: 285, widthRMm: 285, diameterMm: 831, mu: 0.78, kind: 'offroad' },
  body: {
    style: 'offroader',
    tail: 'hatch',
    bonnetHMm: 1350,
    beltHMm: 1400,
    cowlXMm: -800,
    roofFrontXMm: -1100,
    roofRearXMm: -3750,
    tailHMm: 1800,
    paint: '#8a2a20',
  },
  bay: { widthMm: 1150, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-hemi-392',
    // Behind the solid front axle, perched high so the sump clears the axle tube.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -250,
    crankYMm: 680,
    gearbox: 'inline',
    gearboxKg: 95,
    driven: 'all',
    // Selec-Trac: a clutch pack (no centre diff) in a two-speed transfer case. 4H and 4L lock the
    // front and rear prop shafts together; Auto varies from all-rear to 50:50. Shown locked (4H).
    awd: 'transfer-case',
    frontTorqueShare: 0.5,
    awdDevice: { type: 'locked', name: 'Selec-Trac' },
    fuelTank: { litres: 81, xMm: -2450 },
  },
  chassis: 'ladder-frame',
  suspension: { front: 'solid-axle', rear: 'solid-axle' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 548 },
  bodyCgFrac: 0.5,
  // Real separate masses the generic body model would otherwise put at mid-body height.
  extraMasses: [
    {
      id: 'ladder-frame',
      label: 'Ladder frame',
      kg: 260,
      posMm: [-1500, 520, 0],
      sizeMm: [4600, 200, 950],
    },
    {
      id: 'axle-front',
      label: 'Front axle beam (Dana 44)',
      kg: 100,
      posMm: [0, 415, 0],
      sizeMm: [300, 200, 1450],
    },
    {
      id: 'axle-rear',
      label: 'Rear axle beam (Dana 44)',
      kg: 110,
      posMm: [-3008, 415, 0],
      sizeMm: [300, 200, 1450],
    },
    { id: 'spare-wheel', label: 'Spare wheel (on the tailgate)', kg: 50, posMm: [-3940, 1110, 0] },
  ],
  blurb:
    'A ladder frame, two solid axles that lock and a 6.4 V8 behind the front one: built to crawl, fast in a straight line.',
  published: {
    curbKg: 2315,
    frontPct: 53,
    source:
      'Kerb 5103 lb (2315 kg), 188.4 in incl. spare × 73.8 × 74.5 in, wheelbase 118.4 in, track 64.4 in, LT285/70 R17, 21.5 gal (81 L), 8HP75, Selec-Trac MP3022 (4 Auto/4H/N/4L, 2.72:1), Dana 44 front and rear with lockers — Jeep spec sheet via rubitrux.com; Selec-Trac clutch pack 100:0 to 50:50 in 4WD Auto, locked in 4WD High/Low, no centre diff — Hagerty; 53/47 split — as-spec’d axle weights 2756/2442 lb (Auto123), an owner weighed 2780/2380 lb (JL Wrangler Forums); ~ overhang 770 measured on the Ddiaz model (to scale: 2993 mm wheelbase, 1875 mm tall); ~ frame/axle masses and engine position estimated',
  },
};

export default v;

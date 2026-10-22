import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-rs5-sportback-b9',
  name: 'Audi RS 5 Sportback (B9)',
  archetype: 'saloon',
  examples: ['Audi RS 4 Avant (B9)', 'Audi S5 Sportback (B9)', 'Audi A5 Sportback quattro (B9)'],
  dims: {
    wheelbaseMm: 2826,
    trackFMm: 1598,
    trackRMm: 1588,
    lengthMm: 4783,
    widthMm: 1866,
    heightMm: 1387,
    overhangFMm: 910,
  },
  // 265/35 R19
  // μ (lateral peak) 1.03, set so the sim's 100–0 km/h stop matches: 100–0 km/h 35.5 m cold — Auto
  // Zeitung 15/2019
  // ~ kind: OE 20-inch summer
  tires: { widthFMm: 265, widthRMm: 265, diameterMm: 668, mu: 1.03, kind: 'performance' },
  body: {
    style: 'fastback',
    tail: 'hatch',
    bonnetHMm: 910,
    beltHMm: 970,
    cowlXMm: -500,
    roofFrontXMm: -1300,
    roofRearXMm: -2750,
    tailHMm: 1050,
    paint: '#3f4b57',
  },
  bay: { widthMm: 1250, lengthMm: 950 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-90',
    // The longitudinal V6 hangs ahead of the front axle, with the front diff tucked between
    // engine and gearbox.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 170,
    crankYMm: 460,
    gearbox: 'inline',
    gearboxKg: 95,
    driven: 'all',
    // Purely mechanical self-locking centre diff: 40:60 nominal, 70:30 to 15:85 when it locks.
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 58, xMm: -2200 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 465 },
  bodyCgFrac: 0.49,
  extraMasses: [{ id: 'battery', label: '12 V battery (boot)', kg: 20, posMm: [-3350, 350, 450] }],
  blurb: 'The RS 4’s driveline under a five-door coupé: the engine still ahead of the front axle.',
  published: {
    curbKg: 1742,
    frontPct: 57,
    source:
      '4783 × 1866 × 1387 mm, wb 2826, 331 kW / 600 Nm, 8-speed tiptronic, self-locking centre diff 40:60 (70:30–15:85) — Audi MediaCenter (RS 5 facts and figures, 2020); tracks 1598/1588, 265/35 ZR19 — autotijd.be; kerb 1742 kg — cararac / encycarpedia; ~ 57/43 split estimated (PistonHeads notes more rear weight than the coupé); ~ engine position, 58 L tank',
  },
};

export default v;

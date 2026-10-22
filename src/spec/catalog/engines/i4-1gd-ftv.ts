import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-1gd-ftv',
  name: 'Inline-4 2.8 turbo-diesel',
  layoutLabel: 'Inline-4, flat (180°) crank, long stroke',
  examples: ['Toyota 1GD-FTV (Hilux, Fortuner, Land Cruiser Prado 150/250)', 'Toyota 2GD-FTV 2.4'],
  boreMm: 92,
  strokeMm: 103.6,
  rodMm: 158,
  borePitchMm: 102,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 4400,
  massKg: 215,
  powerKw: 150,
  torqueNm: 500,
  sound: sound({
    character: 'thrum',
    mix: { exhaust: 0.6, intake: 0.3, mechanical: 0.45 },
    turbo: { count: 1, spoolRpm: 1200, maxShaftKrpm: 190, bov: false, antiLag: false },
  }),
  notes:
    'Stroke longer than the bore and diesel compression: all its torque arrives below 3000 rpm, which suits towing and low-range crawling more than revving.',
  source:
    'Fortuner 2.8: 92.0 × 103.6 mm, 2755 cc, DOHC 16 valves, turbo-diesel, 150 kW @ 3000–3400 rpm, 500 Nm @ 1600–2800 rpm (6-speed auto) — Toyota Brunei spec sheet; 204 PS / 500 Nm in the 2025 Neo Drive 48V — Toyota Kirloskar via evoIndia; ~ rod, bore pitch, rev limit and mass (iron block) estimated',
});

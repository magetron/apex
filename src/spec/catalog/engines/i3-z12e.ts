import { inline, sound } from '../../builders';

export default inline(3, {
  id: 'i3-z12e',
  name: 'Inline-3 1.2 long-stroke',
  layoutLabel: 'Inline-3, 120° crank',
  examples: ['Suzuki Z12E (Swift 2024, Dzire)', 'Toyota 1KR-FE (Aygo, Yaris)'],
  boreMm: 74,
  strokeMm: 92.8,
  rodMm: 140,
  borePitchMm: 84,
  firingOrder: [1, 2, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 750,
  redlineRpm: 6200,
  massKg: 75,
  powerKw: 61,
  torqueNm: 112,
  sound: sound({
    character: 'thrum',
    headerMm: 450,
    mix: { exhaust: 0.6, intake: 0.3, mechanical: 0.35 },
  }),
  notes:
    'Replaced a 1.2 four: one cylinder fewer, a longer stroke and a high (13:1) compression ratio for low-speed torque and economy.',
  source:
    'Z12E: 74 × 92.8 mm, 1197 cc, 13:1, 61 kW / 112 Nm (European Swift) — Wikipedia "Suzuki Swift", encycarpedia, auto-data.net; ~ rod, bore pitch, red line and mass estimated',
});

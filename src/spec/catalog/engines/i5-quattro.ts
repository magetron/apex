import { inline, sound } from '../../builders';

export default inline(5, {
  id: 'i5-quattro',
  name: 'Inline-5 2.1 turbo, 10-valve',
  layoutLabel: 'Inline-5, 72° crank, SOHC',
  examples: ['Audi WR 2.1 turbo (Quattro, 1980–87)', 'Audi 200 Turbo'],
  boreMm: 79.5,
  strokeMm: 86.4,
  rodMm: 136,
  borePitchMm: 88,
  firingOrder: [1, 2, 4, 5, 3],
  valvetrain: { type: 'sohc', valvesPerCyl: 2 },
  induction: 'turbo',
  idleRpm: 850,
  redlineRpm: 6800,
  massKg: 165,
  powerKw: 147,
  torqueNm: 285,
  sound: sound({
    character: 'warble',
    // Short cast manifold into the turbo.
    headerMm: 450,
    turbo: { count: 1, spoolRpm: 3200, maxShaftKrpm: 140, bov: true, antiLag: false },
  }),
  notes:
    'Mounted longitudinally and entirely ahead of the front axle, with the gearbox and front differential behind it.',
  source:
    'Audi WR: 79.5 × 86.4 mm, 2144 cc, 147 kW (200 PS) / 285 Nm — Audi via Wikipedia "Audi Quattro"; ~ rod length and mass estimated',
});

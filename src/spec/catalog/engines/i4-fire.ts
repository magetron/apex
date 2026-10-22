import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-fire',
  name: 'Inline-4 small 8-valve',
  layoutLabel: 'Inline-4, flat (180°) crank, SOHC',
  examples: ['Fiat 1.2 8v FIRE (500, Panda)', 'Fiat 1.4 16v FIRE (500, Punto)'],
  boreMm: 70.8,
  strokeMm: 78.86,
  rodMm: 126,
  borePitchMm: 78,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'sohc', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 6200,
  massKg: 85,
  powerKw: 51,
  torqueNm: 102,
  sound: sound({
    character: 'thrum',
    headerMm: 450,
    mix: { exhaust: 0.6, intake: 0.35, mechanical: 0.3 },
  }),
  notes:
    'A short, light engine: mounted across the car with its gearbox it leaves almost the whole length for the cabin.',
  source:
    'FIRE 1.2 8v (169A4.000): 70.8 × 78.86 mm, 1242 cc, 51 kW (69 PS) / 102 Nm — Fiat data via Wikipedia "FIRE engine"; ~ rod, pitch and mass estimated',
});

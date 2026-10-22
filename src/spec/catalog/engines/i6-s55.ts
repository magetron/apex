import { inline, sound } from '../../builders';

export default inline(6, {
  id: 'i6-s55',
  name: 'Inline-6 twin-turbo (M, S55)',
  layoutLabel: 'Inline-6, 120° crank',
  examples: ['BMW S55 (M3/M4 F80/F82, M2 Competition)'],
  boreMm: 84,
  strokeMm: 89.6,
  rodMm: 144,
  borePitchMm: 91,
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 750,
  redlineRpm: 7300,
  massKg: 200,
  powerKw: 317,
  torqueNm: 550,
  sound: sound({
    character: 'smooth',
    collector: 'per-bank',
    headerMm: 420,
    turbo: { count: 2, spoolRpm: 1850, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Two mono-scroll turbos, each fed by three cylinders (1–3 and 4–6), on a closed-deck block with a forged crank.',
  source:
    'S55B30: 89.6 × 84 mm, 2979 cc, 317 kW (431 PS) at 5500–7300 rpm, 550 Nm at 1850–5500 rpm — BMW Media information 12/2013 (M3 Sedan / M4 Coupé tech data); bore pitch 91 mm as N55/B58; ~ rod and mass estimated',
});

import { inline, sound } from '../../builders';

export default inline(6, {
  id: 'i6-s58-competition',
  name: 'Inline-6 twin-turbo (M Competition)',
  layoutLabel: 'Inline-6, 120° crank',
  examples: ['BMW S58 Competition (M3/M4 Competition G80/G82)', 'BMW S58 (X3 M Competition)'],
  boreMm: 84,
  strokeMm: 90,
  rodMm: 144,
  borePitchMm: 91,
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 750,
  redlineRpm: 7200,
  massKg: 215,
  powerKw: 375,
  torqueNm: 650,
  sound: sound({
    character: 'smooth',
    collector: 'per-bank',
    headerMm: 420,
    turbo: { count: 2, spoolRpm: 2200, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Two mono-scroll turbos, each fed by three cylinders (1–3 and 4–6), so each sees evenly spaced pulses.',
  source:
    'The Competition tune of i6-s58 (same geometry and sound): 375 kW (510 PS) / 650 Nm in the M4 Competition Coupé, rear drive — auto-motor-und-sport.de; S58B30 84 × 90 mm, 2993 cc, red line 7200 rpm — BMW press kit (2020); bore pitch 91 mm as B58; ~ rod and mass estimated',
});

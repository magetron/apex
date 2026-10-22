import { sound, vee } from '../../builders';

export default vee(6, 90, {
  id: 'v6-690t',
  name: '90° V6 2.9 twin-turbo, odd-fire',
  layoutLabel: '90° V6, three shared pins 120° apart (uneven firing), turbos outside the vee',
  examples: [
    'Alfa Romeo 690T (Giulia / Stelvio Quadrifoglio)',
    'Buick Fireball 198 V6 (1962, the original odd-fire 90° V6)',
  ],
  boreMm: 86.5,
  strokeMm: 82,
  rodMm: 140,
  borePitchMm: 104,
  numbering: 'bank-sequential',
  firstBank: 'right',
  // Two rods side by side on each of three pins: a short, stiff crank, but with 90° between the
  // banks the firings come 90° then 150° apart instead of every 120°.
  pins: 'shared',
  firingOrder: [1, 4, 3, 6, 2, 5],
  fireIntervalsDeg: [90, 150, 90, 150, 90, 150],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 950,
  redlineRpm: 7400,
  massKg: 218,
  powerKw: 375,
  torqueNm: 600,
  sound: sound({
    character: 'warble',
    // Each turbo sits in its own bank's exhaust manifold, so each bank keeps its even 240° pulses.
    collector: 'per-bank',
    headerMm: 600,
    // long tailpipes: the Quadrifoglio's valved quad-pipe system runs the full length of the car
    tailpipeMm: 1100,
    turbo: { count: 2, spoolRpm: 2200, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Shares the Ferrari F154’s 86.5 × 82 mm bore and stroke and its 90° vee; one bank can shut down at light load.',
  source:
    '690T: 86.5 × 82 mm, 2891 cc, 375 kW (510 CV) / 600 Nm, 7400 rpm max, 218 kg dry, wet sump, three non-split 120° crank pins, IHI turbos integrated in the exhaust manifolds — Wikipedia "Alfa Romeo 690T engine"; FCA US spec sheet (fiat500usa.com); ~ rod and pitch estimated (F154 values); ~ firing order: Wikipedia gives 1-6-3-4-2-5, which does not fit shared pins with both banks counted front to rear, so 1-4-3-6-2-5 (same bank alternation) is used',
});

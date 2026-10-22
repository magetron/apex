import { inline, sound } from '../../builders';

export default inline(3, {
  id: 'i3-3b21',
  name: 'Inline-3 1.0 turbo, laid over',
  layoutLabel: 'Inline-3, 120° crank, inclined 45°',
  examples: [
    'Mitsubishi 3B21T / Mercedes M132 (Smart ForTwo 451 turbo and Brabus)',
    'Mitsubishi 3B21 (Smart ForTwo 451 mhd, non-turbo)',
  ],
  boreMm: 72,
  strokeMm: 81.8,
  rodMm: 130,
  borePitchMm: 80,
  firingOrder: [1, 2, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6200,
  massKg: 75,
  powerKw: 72,
  torqueNm: 140,
  sound: sound({
    character: 'thrum',
    mix: { exhaust: 0.6, intake: 0.3, mechanical: 0.35 },
    turbo: { count: 1, spoolRpm: 2200, maxShaftKrpm: 230, bov: false, antiLag: false },
  }),
  notes: 'Built to lie 45° over, so the whole engine and gearbox fit under the Smart’s boot floor.',
  source:
    '3B21T: 72 × 81.8 mm, 999 cc, DOHC 4 valves, 45° inclined (Wikipedia "Mitsubishi 3B2 engine"); Brabus 72 kW (98 PS) at 5500 rpm / 140 Nm at 3500 rpm — Mercedes-Benz press release (2007), later Brabus 75 kW / 147 Nm; ~ rod, pitch, red line and mass estimated (the family is quoted at 67 kg dry)',
});

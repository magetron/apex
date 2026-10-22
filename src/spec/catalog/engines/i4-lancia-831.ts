import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-lancia-831',
  name: 'Inline-4 2.0 16-valve turbo (Lampredi)',
  layoutLabel: 'Inline-4, flat (180°) crank, twin-cam, twin balance shafts',
  examples: [
    'Lancia 831 (Delta HF Integrale 16v / Evoluzione)',
    'Lancia Thema 2.0 16v turbo',
    'Fiat Coupé 2.0 16v Turbo',
  ],
  boreMm: 84,
  strokeMm: 90,
  rodMm: 145,
  borePitchMm: 92,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 900,
  redlineRpm: 6500,
  massKg: 165,
  powerKw: 158,
  torqueNm: 314,
  sound: sound({
    character: 'thrum',
    // Group A cars ran anti-lag; the road car's water-cooled Garrett T3 did not.
    turbo: { count: 1, spoolRpm: 2300, maxShaftKrpm: 170, bov: true, antiLag: true },
  }),
  notes:
    'Aurelio Lampredi’s iron-block twin-cam, with two counter-rotating balance shafts to cancel the 2nd-order shake.',
  source:
    'Evoluzione II (831 AB.020): 84 × 90 mm, 1995 cc, Garrett T3, 215 PS (158 kW) at 5750 rpm / 314 Nm at 2500 rpm — Lancia via Wikipedia "Lancia Delta", carsales.com.au, autoheritage.eu; ~ rod, pitch, redline and mass estimated',
});

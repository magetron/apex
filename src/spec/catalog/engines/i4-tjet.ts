import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-tjet',
  name: 'Inline-4 1.4 turbo 16-valve',
  layoutLabel: 'Inline-4, flat (180°) crank, twin-cam turbo',
  examples: ['Fiat 1.4 16v T-Jet (Abarth 500/595, Punto Abarth)', 'Alfa Romeo MiTo 1.4 TB'],
  boreMm: 72,
  strokeMm: 84,
  rodMm: 128,
  borePitchMm: 79,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6500,
  massKg: 100,
  powerKw: 99,
  torqueNm: 206,
  sound: sound({
    character: 'warble',
    headerMm: 450,
    mix: { exhaust: 0.7, intake: 0.3, mechanical: 0.25 },
    turbo: { count: 1, spoolRpm: 2200, maxShaftKrpm: 220, bov: true, antiLag: false },
  }),
  notes:
    'A turbocharged member of Fiat’s FIRE family, as short as the 1.2 it replaces across the nose.',
  source:
    'T-Jet 312A1000 (Abarth 500): 72 × 84 mm, 1368 cc, 9.8:1, 99 kW (135 PS) at 5500 rpm, 206 Nm at 3000 rpm with Sport pressed (180 Nm otherwise) — auto-data.net; ~ rod, pitch, red line and mass estimated',
});

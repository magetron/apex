import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-g4lf',
  name: 'Inline-4 1.2 dual-port injection',
  layoutLabel: 'Inline-4, flat (180°) crank, twin cam',
  examples: ['Hyundai-Kia Kappa 1.2 DPi G4LF (Picanto, i10)', 'Kappa 1.25 MPi G4LA'],
  boreMm: 71,
  strokeMm: 75.6,
  rodMm: 128,
  borePitchMm: 78,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 750,
  redlineRpm: 6500,
  massKg: 82,
  powerKw: 58,
  torqueNm: 113,
  sound: sound({
    character: 'thrum',
    headerMm: 450,
    mix: { exhaust: 0.6, intake: 0.35, mechanical: 0.3 },
  }),
  notes: 'Two injectors per cylinder, one in each intake port, for cleaner part-load burning.',
  source:
    'Kappa 1.2 DPi (G4LF): 71 × 75.6 mm, 1197 cc, 58 kW (79 PS) at 6000 rpm / 113 Nm at 4200 rpm — auto-data.net and autotijd.be (Picanto 2024 1.2 DPi); ~ rod, bore pitch, red line and mass estimated',
});

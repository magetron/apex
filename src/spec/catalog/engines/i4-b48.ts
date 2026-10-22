import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-b48',
  name: 'Inline-4 2.0 turbo, modular',
  layoutLabel: 'Inline-4, flat (180°) crank, twin balance shafts',
  examples: [
    'BMW B48 (Mini JCW GP, BMW M135i, 330i)',
    'BMW B38 three-cylinder (same 500 cc cylinder)',
  ],
  boreMm: 82,
  strokeMm: 94.6,
  rodMm: 145,
  borePitchMm: 91,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 6500,
  massKg: 140,
  powerKw: 225,
  torqueNm: 450,
  sound: sound({
    character: 'thrum',
    headerMm: 350,
    turbo: { count: 1, spoolRpm: 1750, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'One block family for front-drive Minis (transverse) and rear-drive BMWs (lengthwise): the same 500 cc cylinder makes the three, four and six.',
  source:
    'B48 (JCW GP tune): 82 × 94.6 mm, 1998 cc, 225 kW (306 PS) / 450 Nm — MINI via ultimatespecs.com and carexpert.com.au; 91 mm bore pitch of the BMW modular family; ~ rod, red line and mass estimated',
});

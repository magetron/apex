import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-ford-289',
  name: 'V8 289 Hi-Po (pushrod)',
  layoutLabel: '90° V8, cross-plane crank, pushrod',
  examples: [
    'Ford 289 Hi-Po "K-code" (Mustang, Shelby GT350)',
    'Ford 289 (AC Cobra)',
    'Ford 302 (Mustang Boss 302)',
  ],
  boreMm: 101.6,
  strokeMm: 72.9,
  rodMm: 130.9,
  borePitchMm: 111.25,
  // Ford: 1–4 down the right bank, 5–8 down the left, with the right bank further forward.
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 2, 6, 3, 7, 8],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 750,
  redlineRpm: 6500,
  massKg: 210,
  powerKw: 228,
  torqueNm: 446,
  sound: sound({
    character: 'burble',
    // Tri-Y headers per bank into side-exit pipes ahead of the rear wheels.
    collector: 'per-bank',
    headerMm: 900,
    tailpipeMm: 350,
    mix: { exhaust: 0.9, intake: 0.35, mechanical: 0.3 },
  }),
  notes:
    'A thin-wall cast-iron small-block: one camshaft in the vee works both banks through pushrods, so the engine is short and low for a V8.',
  source:
    '289 Hi-Po (GT350 tune): 4.00 × 2.87 in (101.6 × 72.9 mm), 4.7 L, 306 bhp (228 kW) at 6000 rpm / 329 lb-ft (446 Nm) at 4200 rpm gross, 4-barrel Holley — Wikipedia "Shelby Mustang"; 4.38 in bore spacing and 5.155 in rods (Ford small-block); ~ mass and redline estimated',
});

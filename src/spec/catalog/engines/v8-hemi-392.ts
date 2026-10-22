import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-hemi-392',
  name: 'Cross-plane V8 6.4 pushrod (HEMI 392)',
  layoutLabel: '90° V8, cross-plane crank, pushrods (one cam in the block)',
  examples: [
    'Chrysler 6.4 HEMI “392” (Jeep Wrangler Rubicon 392, Grand Cherokee SRT, Dodge Challenger/Charger 392)',
    'Ram 2500 6.4 HEMI',
  ],
  boreMm: 103.9,
  strokeMm: 94.6,
  rodMm: 155.5,
  borePitchMm: 113.3,
  // Chrysler counts like GM: odd cylinders on the left bank, 1 at the front.
  numbering: 'alternating',
  firstBank: 'left',
  pins: 'shared',
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 650,
  redlineRpm: 6400,
  massKg: 250,
  powerKw: 350,
  torqueNm: 637,
  sound: sound({
    character: 'burble',
    collector: 'per-bank',
    headerMm: 450,
    mix: { exhaust: 0.85, intake: 0.35, mechanical: 0.2 },
  }),
  notes:
    'One camshaft in the block works both banks through pushrods, so the heads stay low and narrow for 6.4 litres. Two plugs per cylinder; it can shut four cylinders down at light load.',
  source:
    '6.4 SRT 392 in the Wrangler Rubicon 392: 90° V8, OHV 16 valves, 103.9 × 94.5 mm, 6417 cc, 470 hp (350 kW) @ 6000 rpm, 470 lb-ft (637 Nm) @ 4300 rpm, limited to 6400 rpm — Jeep spec sheet via rubitrux.com; firing order 1-8-4-3-6-5-7-2 and 4.46 in (113.3 mm) bore spacing as the Gen III HEMI; ~ rod (6.123 in) and mass estimated',
});

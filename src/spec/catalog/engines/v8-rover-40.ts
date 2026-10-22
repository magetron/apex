import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-rover-40',
  name: 'V8 4.0 aluminium pushrod (Rover)',
  layoutLabel: '90° V8, cross-plane crank, pushrod, aluminium block',
  examples: [
    'Rover V8 4.0 (Defender, Discovery, Range Rover P38A)',
    'Buick 215 (1961, its origin)',
    'TVR Griffith / Chimaera',
  ],
  boreMm: 94,
  strokeMm: 71.1,
  rodMm: 155.2,
  borePitchMm: 107.7,
  numbering: 'alternating',
  firstBank: 'left',
  pins: 'shared',
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 5200,
  massKg: 170,
  powerKw: 136,
  torqueNm: 316,
  sound: sound({
    character: 'burble',
    headerMm: 700,
    mix: { exhaust: 0.75, intake: 0.3, mechanical: 0.25 },
    // a lower, steeper can that lets more of the highs past, fitted to a 3.5 Range Rover idling,
    // Commons "Rover-v8-rr79.ogg" (Collard, public domain; audio/test/real.ts); kept dark
    // enough that a full-load pull stays 20 dB under the comb
    muffler: { cutoffHz: 450, leak: 0.6, poles: 2 },
  }),
  notes:
    'Buick’s 1961 all-aluminium small-block, bought by Rover: light for a V8, so the nose of a 4×4 is not overloaded.',
  source:
    'Rover 4.0 V8 (1997 NAS Defender 90): 94 × 71.1 mm, 3.95 L, 182 hp (136 kW) at 4750 rpm / 233 lb-ft (316 Nm) at 3000 rpm — kbb.com 1997 Defender 90 specs; ~ rod (4.0 "interim" block), 4.24 in Buick bore spacing, redline and mass estimated',
});

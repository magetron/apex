import { inline, sound } from '../../builders';

export default inline(5, {
  id: 'i5-duratec-rs',
  name: 'Inline-5 2.5 turbo (Volvo-derived)',
  layoutLabel: 'Inline-5, 72° crank',
  examples: [
    'Ford Duratec RS / Volvo B5254T (Focus RS Mk2, Focus ST Mk2)',
    'Volvo T5 (S60, V70, C30)',
  ],
  boreMm: 83,
  strokeMm: 93.2,
  rodMm: 147,
  borePitchMm: 91,
  firingOrder: [1, 2, 4, 5, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6800,
  massKg: 170,
  powerKw: 224,
  torqueNm: 440,
  sound: sound({
    character: 'warble',
    headerMm: 350,
    turbo: { count: 1, spoolRpm: 2200, maxShaftKrpm: 190, bov: true, antiLag: false },
    // a freer-flowing silencer, thin in the lows: fitted to a Focus RS Mk2 at Goodwood, Commons
    // "Ford_Focus_RS.ogg" (Edvvc, CC BY-SA 3.0; audio/test/real.ts), as far as full load stays
    // 20 dB under the comb
    muffler: { cutoffHz: 600, leak: 0.8, lowHz: 1000 },
  }),
  notes:
    'A long engine to put across a car: five cylinders plus the gearbox fill the bay from wheel to wheel.',
  source:
    'Duratec RS (JZDA): 83 × 93.2 mm, 2522 cc, 8.5:1, 224 kW (305 PS) at 6500 rpm / 440 Nm at 2250–4500 rpm, BorgWarner K16 at 1.37 bar — Ford via australiancar.reviews and auto-data.net; ~ rod, bore pitch (Volvo modular family), red line and mass estimated',
});

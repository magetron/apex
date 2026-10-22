import { sound, vr } from '../../builders';

export default vr(6, 10.6, {
  id: 'vr6-ea390',
  name: 'VR6 3.6 FSI (narrow-angle)',
  layoutLabel: '10.6° VR6, one head, staggered cylinders',
  examples: [
    'VW EA390 3.6 FSI (Porsche Cayenne 958, VW Touareg 7P, Audi Q7 4L)',
    'VW Passat CC / Atlas 3.6',
  ],
  boreMm: 89,
  strokeMm: 96.4,
  rodMm: 164,
  borePitchMm: 65,
  firstRow: 'left',
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 650,
  redlineRpm: 6700,
  massKg: 180,
  powerKw: 220,
  torqueNm: 400,
  sound: sound({ character: 'howl' }),
  notes:
    'The 3.6 closes the vee from 15° to 10.6° so its bigger bores still fit on the 3.2’s bore centres under one cylinder head.',
  source:
    'Cayenne (958) 3.6 V6: 89 × 96.4 mm, 3.6 L, DOHC 4 valves, direct injection, 300 hp (220 kW) @ 6300 rpm, 295 lb-ft (400 Nm) @ 3000 rpm, redline 6700 — Porsche 2012 Cayenne specs (newsroom.porsche.com); 10.6° VR angle (VW EA390); ~ rod, axial step and mass estimated',
});

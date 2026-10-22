import type { MotorSpec } from '../../types';

const motor: MotorSpec = {
  id: 'induction-front',
  name: 'Induction front drive unit',
  kind: 'induction',
  examples: ['Tesla Model 3/Y Dual Motor front unit'],
  peakKw: 150,
  peakNm: 250,
  maxRpm: 18000,
  reduction: 9.0,
  lengthMm: 600,
  diameterMm: 300,
  massKg: 80,
  sound: { polePairs: 2, inverterHz: 8000, gearWhine: 0.35 },
  source:
    '~ Tesla does not publish per-motor ratings; power/torque, ~9:1 reduction and drive-unit mass are estimates for the Model 3/Y dual-motor front induction unit (an induction motor costs nothing when it freewheels, which suits the lightly used front axle)',
};

export default motor;

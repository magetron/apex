import type { MotorSpec } from '../../types';

const motor: MotorSpec = {
  id: 'pmsm-rear',
  name: 'Permanent-magnet rear drive unit',
  kind: 'pmsm',
  examples: ['Tesla Model 3/Y rear drive unit', 'Porsche Taycan rear PSM'],
  peakKw: 220,
  peakNm: 420,
  maxRpm: 18000,
  reduction: 9.0,
  lengthMm: 650,
  diameterMm: 320,
  massKg: 90,
  sound: { polePairs: 3, inverterHz: 10000, gearWhine: 0.45 },
  source:
    '~ Tesla does not publish per-motor ratings; ~220 kW / 420 Nm, ~9:1 reduction, ~18 000 rpm and ~90 kg drive unit are estimates for the Model 3 rear permanent-magnet (IPM-SynRM) unit; the 2024 Model 3 RWD is rated ~208 kW',
};

export default motor;

import type { Tour } from '../types';

const tour: Tour = {
  id: 'ev-changes',
  question: 'What changes when a car goes electric?',
  teaser: 'A battery for a floor and motors on the axles.',
  steps: [
    {
      id: 'floor',
      title: 'The battery is the floor',
      body: 'The battery fills the floor between the axles. The heaviest part of the car is also the lowest, so the CG roundel sits lower than in a petrol saloon of the same size.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'internals' },
        explode: 0.4,
        highlight: ['battery'],
        overlays: ['cg'],
      },
    },
    {
      id: 'drive-unit',
      title: 'Everything in one box',
      body: 'Each drive unit packs the motor, a single reduction gear and the differential into one box on the axle. There is no gearbox, no clutch and no prop shaft.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'part', part: 'motor-rear' },
        explode: 0.6,
      },
    },
    {
      id: 'frunk',
      title: 'Room up front',
      body: 'With no engine in the nose, the front motor fits low between the wheels and the space above it becomes a front boot. Compare the floor plan with a front-engined car.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'internals' },
        highlight: ['motor-front'],
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'rwd',
      title: 'One motor fewer',
      body: 'The single-motor car drops the front drive unit and drives only the rear wheels. Compare the front-axle share with the dual-motor car.',
      scene: {
        view: { vehicleId: 'tesla-model3-rwd', level: 'internals' },
        highlight: ['motor-rear', 'battery'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'heavy-but-low',
      title: 'Heavy, but low',
      body: 'On the skidpad, watch the heavier EV against a petrol saloon of similar size: more mass to turn, but it sits low and between the axles.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'drive' },
        drive: { scenario: 'skidpad', ghosts: ['bmw-m340i-g20'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Tesla_Model_3',
    'https://en.wikipedia.org/wiki/Skateboard_(automotive_platform)',
  ],
};

export default tour;

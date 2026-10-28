import type { Tour } from '../types';

const tour: Tour = {
  id: 'hot-hatch-ff',
  question: 'Why are hot hatches front-wheel drive?',
  teaser: 'One compact unit, right over the driven wheels.',
  steps: [
    {
      id: 'one-unit',
      title: 'One compact unit',
      body: 'Engine and gearbox sit side by side across the nose, with the differential inside the gearbox: no prop shaft and no rear differential to package or pay for.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        explode: 0.5,
        highlight: ['engine', 'gearbox', 'diff-front'],
      },
    },
    {
      id: 'cabin',
      title: 'The payoff: space',
      body: 'The floor plan from above: the whole drivetrain lives in the nose, so the rest of the length goes to people and luggage.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'weight-on-drive',
      title: 'Weight on the driven wheels',
      body: 'Torque flows straight out to the front wheels, and the axle-load bars show they also carry most of the weight.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        overlays: ['torque-flow', 'axle-loads'],
      },
    },
    {
      id: 'power-understeer',
      title: 'Limit: power understeer',
      body: 'The front tyres must steer and drive. On the throttle out of a turn the Golf pushes its front wide, while the rear-drive car slides its rear out.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'drive' },
        drive: { scenario: 'power-exit', ghosts: ['bmw-m340i-g20'] },
      },
    },
    {
      id: 'half-shafts',
      title: 'Half shafts of unequal length',
      body: 'The differential sits off-centre in the gearbox, so the half shafts reach the wheels at different lengths and angles: under hard throttle that imbalance can tug the steering (torque steer).',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        highlight: ['diff-front', 'half-front-left', 'half-front-right'],
        camera: 'top',
      },
    },
    {
      id: 'golf-r',
      title: 'Golf R adds rear drive',
      body: 'The Golf R keeps the same transverse engine and adds a prop shaft and a clutch-controlled rear drive unit: extra weight and cost buy traction the front tyres alone cannot give.',
      scene: {
        view: { vehicleId: 'vw-golf-r-mk8', level: 'internals' },
        highlight: ['prop-rear', 'coupling', 'diff-rear'],
        overlays: ['torque-flow', 'axle-loads'],
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Front-engine,_front-wheel-drive_layout',
    'https://en.wikipedia.org/wiki/Torque_steer',
    'https://en.wikipedia.org/wiki/Volkswagen_Golf_Mk8',
  ],
};

export default tour;

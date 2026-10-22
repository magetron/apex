import type { Tour } from '../types';

const tour: Tour = {
  id: 'mid-engine-handling',
  question: 'Why does a mid-engine car handle best but leave no room for people?',
  teaser: 'Mass near the middle turns quickly, and takes the back seat.',
  steps: [
    {
      id: 'dumbbell-mr',
      title: 'Mass near the middle',
      body: 'The dumbbell shows yaw inertia: how hard the car is to spin about its CG. With engine and gearbox inside the wheelbase, the heavy masses sit close to the middle and the dumbbell is short.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'dumbbell-fr',
      title: 'Mass at both ends',
      body: 'Front-engined: the M340i carries its engine ahead of the cabin and its fuel and boot behind. Mass at both ends stretches the dumbbell, so the car needs more yaw moment to turn in.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'dumbbell-rr',
      title: 'Mass at one end',
      body: 'Rear-engined: the 911’s flat-6 hangs out past the rear axle, far from the CG. Compare the dumbbell with the Ferrari’s.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'lane-change',
      title: 'Quick to change direction',
      body: 'In the same scripted lane change, watch which car takes its new heading first. Lower yaw inertia means the same tyre forces rotate the car sooner.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'drive' },
        drive: { scenario: 'lane-change', ghosts: ['bmw-m340i-g20', 'porsche-911-992'] },
      },
    },
    {
      id: 'no-seats',
      title: 'The price: space',
      body: 'The floor plan shows the cost. The engine occupies the space where rear seats would go: two seats, a small front boot, and the engine’s heat and noise right behind your head.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'lift-off',
      title: 'Quick to let go, too',
      body: 'Low inertia cuts both ways. Lift off mid-corner and watch the yaw rate: once the rear tyres slide, the mid-engined car also rotates sooner, so it gives the driver less time to catch it.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'drive' },
        drive: { scenario: 'lift-off', ghosts: ['bmw-m340i-g20'] },
      },
    },
  ],
  sources: [
    'W. F. Milliken and D. L. Milliken, Race Car Vehicle Dynamics, SAE (1995), ch. 5 (yaw inertia and transient response)',
    'T. D. Gillespie, Fundamentals of Vehicle Dynamics, SAE (1992), ch. 6',
  ],
};

export default tour;

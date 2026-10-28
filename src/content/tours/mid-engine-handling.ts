import type { Tour } from '../types';

const tour: Tour = {
  id: 'mid-engine-handling',
  question: 'Why does a mid-engine car handle best but leave no room for people?',
  teaser: 'Mass near the middle, where the back seats would be.',
  steps: [
    {
      id: 'dumbbell-mr',
      title: 'Mass near the middle',
      body: 'The dumbbell stands for yaw inertia, how hard the car is to turn about its centre of gravity. With engine and gearbox inside the wheelbase, the heavy masses sit close to the middle and the dumbbell is short.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'dumbbell-fr',
      title: 'Mass at both ends',
      body: 'Front-engined: the M340i carries its engine ahead of the cabin and its fuel and boot behind. Mass at both ends stretches the dumbbell.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'dumbbell-rr',
      title: 'Mass at one end',
      body: 'Rear-engined: the flat-6 of the 911 hangs out past the rear axle, far from the centre of gravity, and the dumbbell is longer than the Ferrari one.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        overlays: ['inertia', 'cg'],
      },
    },
    {
      id: 'lane-change',
      title: 'Quick to change direction',
      body: 'The same step of the wheel: the mid-engined car builds its turn sooner than the 911, whose yaw inertia for its size is larger.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'drive' },
        drive: { scenario: 'lane-change', ghosts: ['porsche-911-992'] },
      },
    },
    {
      id: 'no-seats',
      title: 'The price: space',
      body: 'The floor plan from above: the engine occupies the space where rear seats would go, leaving two seats and a small front boot.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'lift-off',
      title: 'Lift off: the tail goes',
      body: 'Lifting mid-corner takes load off the rear tyres: the rear of the mid-engined car slides out and it spins, while the front-engined car only tightens its line.',
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

import type { Tour } from '../types';

const tour: Tour = {
  id: 'fiat-500-old-new',
  question: 'Why did the Fiat 500 move its engine from the back to the front?',
  teaser: 'Same badge, opposite layout.',
  steps: [
    {
      id: 'rear',
      title: 'The original: engine out back',
      body: 'The original 500 hangs an air-cooled twin behind the rear axle, with the gearbox and differential just ahead of it: no radiator and no prop shaft.',
      scene: {
        view: { vehicleId: 'fiat-500-1957', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox'],
        overlays: ['cg'],
      },
    },
    {
      id: 'twin',
      title: 'It shakes like a single',
      body: 'Inside the twin, both pistons rise and fall together and fire on alternate turns. The balance view shows the primary shake: it behaves like one big cylinder.',
      scene: {
        view: { vehicleId: 'fiat-500-1957', level: 'part', part: 'engine' },
        balance: true,
        rpm: 2000,
      },
    },
    {
      id: 'front',
      title: 'Modern: engine in front',
      body: 'The modern 500 turns a water-cooled four across the nose with its gearbox, driving the front wheels: the centre of gravity jumps forward of the middle.',
      scene: {
        view: { vehicleId: 'abarth-500-312', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox', 'diff-front'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'boot',
      title: 'Room for a boot',
      body: 'The floor plan from above: a transverse front-drive unit is just as compact, shares its parts with many other small cars and leaves the tail free for luggage.',
      scene: {
        view: { vehicleId: 'abarth-500-312', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'lift-off',
      title: 'Lift off: the old spins',
      body: 'Lifting mid-corner: the tail-heavy original’s rear slides out and it spins, while the nose-heavy modern car only tightens its line.',
      scene: {
        view: { vehicleId: 'abarth-500-312', level: 'drive' },
        drive: { scenario: 'lift-off', ghosts: ['fiat-500-1957'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Fiat_500',
    'https://en.wikipedia.org/wiki/Fiat_500_(2007)',
  ],
};

export default tour;

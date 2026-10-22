import type { Tour } from '../types';

const tour: Tour = {
  id: 'fiat-500-old-new',
  question: 'Why did the Fiat 500 move its engine from the back to the front?',
  teaser: 'Same badge, opposite layout.',
  steps: [
    {
      id: 'rear',
      title: 'The original: engine out back',
      body: 'The original 500 hangs an air-cooled twin behind the rear axle, with the gearbox and differential just ahead of it. No radiator and no prop shaft: the cheapest way to fit four people into a tiny car.',
      scene: {
        view: { vehicleId: 'fiat-500-1957', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox'],
        overlays: ['cg'],
      },
    },
    {
      id: 'twin',
      title: 'A big single, really',
      body: 'Inside the twin, both pistons rise and fall together and fire on alternate turns. With the balance view on, the primary shake is plain to see: it behaves like one big cylinder.',
      scene: {
        view: { vehicleId: 'fiat-500-1957', level: 'part', part: 'engine' },
        balance: true,
        rpm: 2000,
      },
    },
    {
      id: 'front',
      title: 'The modern one: engine in front',
      body: 'The modern 500 turns a water-cooled four across the nose with its gearbox, driving the front wheels. Watch the CG roundel jump forward of the middle.',
      scene: {
        view: { vehicleId: 'abarth-500-312', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox', 'diff-front'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'why',
      title: 'Why the switch',
      body: 'A transverse front-drive unit is just as compact, shares its engine and gearbox with many other small cars, keeps a usable boot at the back, and its nose-heavy balance understeers predictably at the limit.',
      scene: {
        view: { vehicleId: 'abarth-500-312', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'lift-off',
      title: 'Lift off, old and new',
      body: 'Lift off mid-corner: watch the yaw rate of the tail-heavy original against the nose-heavy modern car.',
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

import type { Tour } from '../types';

const tour: Tour = {
  id: 'transverse-fit',
  question: 'How does a transverse engine limit engine size?',
  teaser: 'The engine’s length has to fit across the car.',
  steps: [
    {
      id: 'across',
      title: 'Length goes across',
      body: 'Mounted across the car, the engine’s length plus the gearbox must fit between the front wheels, and still leave room for them to steer. The bay-fit outline marks that space.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        highlight: ['engine', 'gearbox'],
        overlays: ['bay-fit'],
        camera: 'top',
      },
    },
    {
      id: 'inline-5',
      title: 'Five: tight',
      body: 'Swap in an inline-5: one cylinder longer. Audi does mount its five-cylinder transversely in the RS 3, with very little room to spare. Compare the outline with the four.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        engine: 'i5',
        overlays: ['bay-fit'],
        camera: 'top',
      },
    },
    {
      id: 'inline-6',
      title: 'Six won’t fit across',
      body: 'An inline-6 is longer again. Only a handful of production cars ever carried one sideways, with unusually compact gearboxes. Watch how much of the bay it takes.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        engine: 'i6',
        overlays: ['bay-fit'],
        camera: 'top',
      },
    },
    {
      id: 'vr6',
      title: 'VR6: six that fits',
      body: 'VW’s answer: the VR6. Its cylinders zig-zag in one block at a very narrow angle, so six cylinders take barely more length than four. It was invented to fit a six across a Golf or Passat.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        engine: 'vr6',
        overlays: ['bay-fit'],
        camera: 'top',
      },
    },
    {
      id: 'vr6-inside',
      title: 'One head, two rows',
      body: 'Zoom in: one block and a single cylinder head cover both staggered rows. A conventional V6 needs two heads and a wider block.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'part', part: 'engine' },
        engine: 'vr6',
        highlight: ['engine/block', 'engine/head-0'],
      },
    },
    {
      id: 'v8',
      title: 'A V8 crowds the bay',
      body: 'A V8 is short but wide and heavy. Transverse V8s exist in larger cars with narrow-angle blocks, but in a Golf’s bay the banks crowd the bulkhead and radiator. Check the outline.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'internals' },
        engine: 'v8-cross',
        overlays: ['bay-fit'],
        camera: 'top',
      },
    },
    {
      id: 'count',
      title: 'Count the cylinders',
      body: 'Block length is roughly the number of cylinders times the bore pitch, plus the timing drive at one end and the flywheel at the other. Zoom in and count.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'part', part: 'engine' },
        highlight: ['engine/block'],
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/VR6_engine',
    'https://en.wikipedia.org/wiki/Transverse_engine',
    'https://en.wikipedia.org/wiki/Audi_RS_3',
  ],
};

export default tour;

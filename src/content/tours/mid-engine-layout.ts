import type { Tour } from '../types';

const tour: Tour = {
  id: 'mid-engine-layout',
  question: 'Where is the engine in a Ferrari or an Audi R8?',
  teaser: 'Behind your back, ahead of the rear axle.',
  steps: [
    {
      id: 'outside',
      title: 'The clue is the deck',
      body: 'From outside, the R8 has a short nose, a cabin pushed forward and a long deck behind the seats. That deck is where the engine lives.',
      scene: { view: { vehicleId: 'audi-r8-v10-gen2', level: 'car' }, camera: 'side' },
    },
    {
      id: 'x-ray',
      title: 'Mid-engined',
      body: 'The V10 sits lengthwise behind the seats and ahead of the rear axle, inside the wheelbase. Watch the CG roundel: it lands just behind the middle of the car.',
      scene: {
        view: { vehicleId: 'audi-r8-v10-gen2', level: 'internals' },
        highlight: ['engine'],
        overlays: ['cg'],
      },
    },
    {
      id: 'transaxle',
      title: 'Gearbox behind the engine',
      body: 'Exploded, the gearbox and rear differential form one transaxle bolted to the back of the engine. It reaches back past the rear axle line, while the engine stays ahead of it.',
      scene: {
        view: { vehicleId: 'audi-r8-v10-gen2', level: 'internals' },
        explode: 0.6,
        highlight: ['engine', 'gearbox', 'diff-rear'],
      },
    },
    {
      id: 'front-drive',
      title: 'A prop shaft forward',
      body: 'The R8 also drives its front wheels: a prop shaft runs forward from the transaxle, past the engine, to a front differential with a multi-plate clutch. Most of the torque normally goes to the rear; follow the flow.',
      scene: {
        view: { vehicleId: 'audi-r8-v10-gen2', level: 'internals' },
        highlight: ['prop-front', 'diff-front'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'ferrari',
      title: 'Ferrari: rear drive only',
      body: 'The F8 Tributo uses the same recipe without the front driveline: no forward prop shaft, no front differential, so the front axle only steers. Compare its front-axle share with the R8’s.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'internals' },
        highlight: ['engine', 'gearbox'],
        overlays: ['torque-flow', 'axle-loads'],
      },
    },
    {
      id: 'low-v8',
      title: 'Low and light',
      body: 'Inside the F8’s engine: a flat-plane V8 with a dry sump, so the crank sits low in the car and the whole mass stays close to the road.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'part', part: 'engine' },
        highlight: ['engine/crank'],
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Audi_R8_(Type_4S)',
    'https://en.wikipedia.org/wiki/Ferrari_F8_Tributo',
    'Ferrari S.p.A., F8 Tributo press release (2019)',
  ],
};

export default tour;

import type { Tour } from '../types';

const tour: Tour = {
  id: 'awd-systems',
  question: 'How do all-wheel-drive systems differ?',
  teaser: 'Clutches, centre diffs, extra prop shafts or a second motor.',
  steps: [
    {
      id: 'on-demand',
      title: 'Clutch on demand',
      body: 'The Golf R is front-drive at heart. A prop shaft runs back to clutch packs at the rear axle, which close when the front tyres slip or the car needs help turning. Follow the torque as it shifts.',
      scene: {
        view: { vehicleId: 'vw-golf-r-mk8', level: 'internals' },
        highlight: ['prop-rear', 'coupling', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'centre-diff',
      title: 'A centre differential',
      body: 'The original quattro drives both axles all the time. A centre differential lets them turn at different speeds through corners, and the driver could lock it for loose surfaces. Later quattros use a self-locking Torsen-type centre diff.',
      scene: {
        view: { vehicleId: 'audi-sport-quattro-1984', level: 'internals' },
        highlight: ['coupling', 'prop-rear', 'diff-front', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'symmetrical',
      title: 'Subaru: symmetrical',
      body: 'Subaru lines up a low boxer engine, gearbox, centre differential and prop shaft on the car’s centre line, so the driveline is the same on both sides.',
      scene: {
        view: { vehicleId: 'subaru-wrx-sti', level: 'internals' },
        highlight: ['engine', 'gearbox', 'coupling', 'prop-rear'],
        overlays: ['torque-flow'],
        camera: 'top',
      },
    },
    {
      id: 'two-props',
      title: 'GT-R: two prop shafts',
      body: 'The GT-R puts its gearbox at the rear axle. One prop shaft runs back from the engine to the transaxle; a second runs forward again from its transfer clutch to the front differential.',
      scene: {
        view: { vehicleId: 'nissan-gtr-r35', level: 'internals' },
        explode: 0.4,
        highlight: ['prop-rear', 'gearbox', 'prop-front', 'diff-front'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'dual-motor',
      title: 'EV: a motor per axle',
      body: 'A dual-motor EV needs no shafts between the axles at all. Each axle has its own motor, and software sets the split many times a second.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'internals' },
        highlight: ['motor-front', 'motor-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'transfer-case',
      title: 'Off-road: a low range',
      body: 'The G-Class adds a transfer case with a low-range gear set behind its gearbox. Its centre, rear and front differentials can all be locked, so every wheel keeps turning even when others hang in the air.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'internals' },
        highlight: ['coupling', 'diff-front', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Quattro_(four-wheel-drive_system)',
    'https://en.wikipedia.org/wiki/Haldex_Traction',
    'https://en.wikipedia.org/wiki/Symmetrical_All-Wheel_Drive',
    'https://en.wikipedia.org/wiki/ATTESA',
    'https://en.wikipedia.org/wiki/Mercedes-Benz_G-Class',
  ],
};

export default tour;

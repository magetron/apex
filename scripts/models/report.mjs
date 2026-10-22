// Measures converted models without a browser and checks them against their specs.
// usage: node scripts/models/report.mjs [vehicle-id ...]   (default: every models/raw/*.glb)
// Per car (mm): length × height × width (width includes mirrors, height any antenna), roof
// height (the top of the measured body profile: no aerial), front overhang, front/rear track and tyre radius;
// then the spec's numbers, and a ✗ wherever the model is more than 5% off them.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mm = (m) => Math.round(m * 1000);
const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('models/raw')
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.replace(/\.glb$/, ''));

let flagged = 0;
for (const id of ids) {
  const doc = await io.read(`models/raw/${id}.glb`);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const nodes = doc.getRoot().listNodes();
  // older exports carry the sandbox's +wheelbase/2 on the root; undo it
  const [ox] = scene.listChildren()[0].getTranslation();
  const at = (corner) =>
    nodes.find((n) => n.getName() === `wheel-${corner}`)?.getTranslation() ?? [NaN, NaN, NaN];
  const box = getBounds(scene);
  const profile = `src/vehicle3d/gltf/profiles/${id}.json`;
  const top = existsSync(profile) ? JSON.parse(readFileSync(profile, 'utf8')).top : [];
  const m = {
    length: mm(box.max[0] - box.min[0]),
    roof: top.length ? Math.max(...top.map(([, y]) => y)) : NaN,
    overhangF: mm(box.max[0] - ox),
    trackF: mm(at('front-right')[2] - at('front-left')[2]),
    trackR: mm(at('rear-right')[2] - at('rear-left')[2]),
    tyreR: mm(at('front-left')[1]),
  };
  let spec = null;
  try {
    spec = (await import(`../../src/spec/catalog/vehicles/${id}.ts`)).default;
  } catch {
    /* no spec file of that name (a shared model) */
  }
  const s = spec && {
    length: spec.dims.lengthMm,
    roof: spec.dims.heightMm,
    overhangF: spec.dims.overhangFMm,
    trackF: spec.dims.trackFMm,
    trackR: spec.dims.trackRMm,
    tyreR: spec.tires.diameterMm / 2,
  };
  const cells = Object.keys(m).map((k) => {
    if (!s) return `${k} ${m[k]}`;
    const off = Math.abs(m[k] - s[k]) / s[k];
    // overhangs and tracks are short: judge them in mm (5% of the length / 60 mm), not percent
    const bad = k.startsWith('overhang')
      ? Math.abs(m[k] - s[k]) > (0.05 * s.length) / 2
      : k.startsWith('track')
        ? Math.abs(m[k] - s[k]) > 60
        : off > 0.05;
    if (bad || Number.isNaN(m[k])) flagged++;
    return `${bad || Number.isNaN(m[k]) ? '✗' : ' '}${k} ${m[k]}/${s[k]}`;
  });
  console.log(`${id.padEnd(36)} ${cells.join('  ')}`);
}
console.log(`\n${ids.length} models, ${flagged} values more than 5% off the spec (model/spec, mm)`);

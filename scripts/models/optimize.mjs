// Compresses the raw exports from #/dev/convert into the copies the site ships.
// usage: node scripts/models/optimize.mjs [vehicle-id ...]   (default: every file in models/raw)
//   models/raw/<id>.glb → public/models/<id>.glb
// Welds, quantizes and meshopt-compresses (no triangles removed: correctness first, size later);
// three's GLTFLoader decodes it with the bundled MeshoptDecoder.
import { readdirSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
  ALL_EXTENSIONS,
} from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('models/raw')
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.replace(/\.glb$/, ''));

for (const id of ids) {
  const src = `models/raw/${id}.glb`;
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const out = `public/models/${id}.glb`;
  await io.write(out, doc);
  const mb = (f) => (statSync(f).size / 1e6).toFixed(1);
  console.log(`${id}: ${mb(src)} MB → ${mb(out)} MB`);
}

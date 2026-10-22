/**
 * Cars that have a detailed glTF body (public/models/<file>), one file per car in ./cars/
 * named by vehicle id. Converted by #/dev/convert + scripts/models/optimize.mjs; cars not
 * listed use the procedural look-alike shell.
 */
import type { GltfCar } from './credit';

export type { GltfCar, GltfCredit } from './credit';

export const GLTF_CARS: Record<string, GltfCar> = Object.fromEntries(
  Object.entries(import.meta.glob<GltfCar>('./cars/*.ts', { eager: true, import: 'default' })).map(
    ([path, car]) => [path.replace(/^.*\/(.+)\.ts$/, '$1'), car],
  ),
);

/** What we changed, as CC BY-NC-SA asks: shown with the credits. */
export const GLTF_CHANGES =
  'Converted to glTF, aligned to each car’s wheelbase, wheels separated, engine bays removed, compressed. Adaptations are shared under the same licence.';

export const gltfUrl = (id: string) => {
  const c = GLTF_CARS[id];
  return c ? `${import.meta.env.BASE_URL}models/${c.file}` : null;
};

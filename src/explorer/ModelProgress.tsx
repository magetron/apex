/** A thin bar while the current car's detailed model streams in; a retry if it fails. */
import { Button } from '../app/ui';
import { gltfUrl } from '../vehicle3d/gltf/manifest';
import { retryModel, useModelLoad } from '../vehicle3d/gltf/load';

export function ModelProgress({ vehicleId }: { vehicleId: string }) {
  const url = gltfUrl(vehicleId);
  const load = useModelLoad((s) => (url ? s[url] : undefined));
  if (!url || load?.state === 'ready') return null;
  if (load?.state === 'failed')
    return (
      <div className="apx-model-progress is-failed" role="alert">
        <Button onClick={() => retryModel(url)}>Retry loading the car</Button>
      </div>
    );
  const frac = load && load.total > 0 ? load.loaded / load.total : null;
  return (
    <div
      className="apx-model-progress"
      role="progressbar"
      aria-label="Loading the car"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={frac === null ? undefined : Math.round(frac * 100)}
    >
      <span
        className={frac === null ? 'is-indeterminate' : undefined}
        style={frac === null ? undefined : { width: `${frac * 100}%` }}
      />
    </div>
  );
}

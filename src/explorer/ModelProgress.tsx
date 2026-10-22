/**
 * A thin bar while the car's detailed model (and those of the cars it is compared with) streams
 * in; a retry if one fails.
 */
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../app/ui';
import { gltfUrl } from '../vehicle3d/gltf/manifest';
import { retryModel, useModelLoad, type ModelLoad } from '../vehicle3d/gltf/load';

export function ModelProgress({ vehicleId, others }: { vehicleId: string; others?: string[] }) {
  const urls = [vehicleId, ...(others ?? [])].map(gltfUrl).filter((u): u is string => !!u);
  const loads = useModelLoad(useShallow((s) => urls.map((u) => s[u] as ModelLoad | undefined)));
  const pending = loads.filter((l) => l?.state !== 'ready');
  if (!pending.length) return null;
  const failed = urls.find((_, i) => loads[i]?.state === 'failed');
  if (failed)
    return (
      <div className="apx-model-progress is-failed" role="alert">
        <Button onClick={() => retryModel(failed)}>Retry loading the car</Button>
      </div>
    );
  // bytes over every model still coming (a prefetched one doesn't report its size)
  const total = pending.reduce((s, l) => s + (l?.total ?? 0), 0);
  const known = pending.every((l) => l && l.total > 0);
  const frac = known && total > 0 ? pending.reduce((s, l) => s + l!.loaded, 0) / total : null;
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

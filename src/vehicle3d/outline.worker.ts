/** Builds car outlines off the main thread (a detailed car takes a few hundred ms). */
import { buildOutline } from './outlineBuild';

interface Job {
  id: number;
  pos: Float32Array;
  kind: Uint8Array;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

ctx.onmessage = (e) => {
  const { id, pos, kind } = e.data;
  const o = buildOutline(pos, kind);
  ctx.postMessage({ id, ...o }, [
    o.positions.buffer,
    o.normals.buffer,
    o.index.buffer,
    o.edges.buffer,
  ]);
};

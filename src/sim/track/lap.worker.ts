/**
 * Works out racing lines and hot laps off the main thread (a line takes up to ~0.2 s, a lap up
 * to ~0.2 s for a 1,500 hp AWD car), so the 3D view never stalls while cars or circuits change.
 * Jobs run in the order asked; results are copied back (the worker keeps its own cache).
 */
import { getVehicle } from '../../spec/catalog';
import { hotLap, trackLine } from '.';

export interface LapJob {
  id: number;
  trackId: string;
  /** none: the racing line only */
  vehicleId?: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<LapJob>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (e) => {
  const { id, trackId, vehicleId } = e.data;
  try {
    const line = trackLine(trackId);
    if (!vehicleId) ctx.postMessage({ id, line });
    else ctx.postMessage({ id, lap: hotLap(trackId, getVehicle(vehicleId)) });
  } catch (err) {
    ctx.postMessage({ id, error: String(err) });
  }
};

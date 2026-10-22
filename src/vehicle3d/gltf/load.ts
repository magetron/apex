/**
 * Loading the detailed car models, with byte progress for the explorer's progress bar.
 * One load per URL (cached by useLoader); body and wheels share it.
 */
import { useLoader } from '@react-three/fiber';
import type { Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { create } from 'zustand';
import { gltfUrl } from './manifest';

export interface ModelLoad {
  state: 'loading' | 'ready' | 'failed';
  /** bytes; total is 0 when the server doesn't say */
  loaded: number;
  total: number;
  /** bumped by retry, so the boundary remounts and loads again */
  attempt: number;
}

export const useModelLoad = create<Record<string, ModelLoad>>(() => ({}));

const FRESH: ModelLoad = { state: 'loading', loaded: 0, total: 0, attempt: 0 };
const patch = (url: string, p: Partial<ModelLoad>) =>
  useModelLoad.setState((s) => ({ [url]: { ...FRESH, ...s[url], ...p } }));

export const markReady = (url: string) => {
  if (useModelLoad.getState()[url]?.state !== 'ready') patch(url, { state: 'ready' });
};
export const markFailed = (url: string) => patch(url, { state: 'failed' });

export function retryModel(url: string) {
  useLoader.clear(GLTFLoader, url);
  patch(url, {
    state: 'loading',
    loaded: 0,
    total: 0,
    attempt: (useModelLoad.getState()[url]?.attempt ?? 0) + 1,
  });
}

// the models are meshopt-compressed (scripts/models/optimize.mjs); the decoder is bundled
const withDecoder = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** The car's model scene (suspends while loading, throws if it fails). */
export function useCarModel(id: string): Object3D {
  const url = gltfUrl(id)!;
  return useLoader(GLTFLoader, url, withDecoder, (e) =>
    patch(url, { loaded: e.loaded, total: e.lengthComputable ? e.total : 0 }),
  ).scene;
}

const prefetched = new Set<string>();

/**
 * Start loading a car's model before it is shown (the cars either side of the current one), so
 * switching to it is instant. Same cache as useCarModel; each URL at most once.
 */
export function prefetchCar(id: string) {
  const url = gltfUrl(id);
  if (!url || prefetched.has(url) || useModelLoad.getState()[url]) return;
  prefetched.add(url);
  useLoader.preload(GLTFLoader, url, withDecoder);
}

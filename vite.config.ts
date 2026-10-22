import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// This checkout lives in Dropbox on Windows, where freshly written folders are briefly locked
// (EBUSY) by sync/antivirus scanners. Vite's graceful rename retries EACCES/EPERM but not
// EBUSY, so dependency pre-bundling fails with "504 Outdated Optimize Dep". Retry EBUSY too.
type RenameCb = (err: { code?: string } | null) => void;
const nodeFs = fs as unknown as {
  rename: (a: string, b: string, cb: RenameCb) => void;
  __apexRename?: boolean;
};
if (process.platform === 'win32' && !nodeFs.__apexRename) {
  nodeFs.__apexRename = true;
  const rename = nodeFs.rename.bind(fs);
  nodeFs.rename = (from, to, cb) => {
    const start = Date.now();
    const attempt = () =>
      rename(from, to, (err) => {
        if (err?.code === 'EBUSY' && Date.now() - start < 10_000) setTimeout(attempt, 150);
        else cb(err);
      });
    attempt();
  };
}

/**
 * Dev-only: lets #/dev/convert save the GLB it builds: POST raw bytes to
 * /__apex/save-model?id=<vehicle-id> → models/raw/<id>.glb. Nothing else can be written;
 * absent from builds.
 */
function saveModelPlugin(): Plugin {
  return {
    name: 'apex-save-model',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__apex/save-model', (req, res) => {
        const id = new URL(req.url ?? '', 'http://x').searchParams.get('id') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]+$/.test(id)) {
          res.statusCode = 400;
          return res.end('bad request');
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          fs.mkdirSync('models/raw', { recursive: true });
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(`models/raw/${id}.glb`, buf);
          res.end(`saved models/raw/${id}.glb (${buf.length} bytes)`);
        });
      });
    },
  };
}

/**
 * The conversion server runs without HMR, and without HMR Vite never re-evaluates an
 * import.meta.glob when a file is added (new catalog cars would stay "unknown vehicle"). So
 * drop every transformed module on any add/remove; the next page load picks the files up.
 */
function freshGlobsPlugin(): Plugin {
  return {
    name: 'apex-fresh-globs',
    apply: 'serve',
    configureServer(server) {
      const drop = () => server.moduleGraph.invalidateAll();
      server.watcher.on('add', drop);
      server.watcher.on('unlink', drop);
    },
  };
}

// Served from https://magetron.github.io/apex/ — every asset URL is relative to this base.
// APEX_CONVERT=1: the conversion server (`APEX_CONVERT=1 vite --port 5174`). No HMR, so source
// edits made meanwhile don't reload a tab mid-conversion,
// and its own deps cache so it never swaps the main server's.
const convertServer = !!process.env.APEX_CONVERT;
// Model archives, scratch and raw exports are big, often locked by Dropbox (EBUSY), and nothing
// imports them: keep them out of the file watcher. Anchored to the repo root: Vite learns about
// new public files (public/models/*.glb) from the watcher, so those must stay watched.
const unwatched = /^(models|\.tools)(\/|$)/;
const watch = {
  ignored: (file: string) =>
    unwatched.test(path.relative(process.cwd(), file).replaceAll('\\', '/')),
};

export default defineConfig({
  base: '/apex/',
  plugins: [react(), saveModelPlugin()],
  server: { watch },
  ...(convertServer && {
    server: { hmr: false, watch },
    cacheDir: 'node_modules/.vite-convert',
    plugins: [react(), saveModelPlugin(), freshGlobsPlugin()],
  }),
  resolve: {
    // '/src' is resolved from the project root by Vite (and Vitest).
    alias: [{ find: /^@\//, replacement: '/src/' }],
  },
  optimizeDeps: {
    // Pre-bundle everything at startup so the deps folder isn't swapped mid-session.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'postprocessing',
      'zustand',
      'wouter',
      'wouter/use-hash-location',
      // the car-model loader (src/vehicle3d/gltf/load.ts)
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/libs/meshopt_decoder.module.js',
    ],
    entries: ['index.html', 'src/**/*.tsx'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The persistent module cache doesn't notice files added under an import.meta.glob
    // (catalog/tours registries), so new catalog entries would silently go untested.
    fsModuleCache: false,
  },
});

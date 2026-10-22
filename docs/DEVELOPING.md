# Developing

Plan and architecture: `docs/PLAN.md`.

## Toolchain (repo-local only)
- Node is a portable copy in `.tools/` (git-ignored). Nothing is installed system-wide; nothing
  is written to the home directory.
- Before any node/npm/npx command: `source scripts/env.sh` (bash) or `. scripts/env.ps1`
  (PowerShell). It puts Node on PATH and points the npm cache, TMP and Playwright browsers into
  `.tools/`.
- The checkout may live in a synced folder (Dropbox) on Windows, where fresh files are briefly
  locked (`EBUSY`). `vite.config.ts` retries renames on `EBUSY`; if the dev server still serves
  "504 Outdated Optimize Dep", stop it, delete `node_modules/.vite` and start it again.

## Commands (from the repo root)
- Dev server: `npm run dev` → http://localhost:5173/apex/ (sandboxes at `#/dev/<module>`).
- Typecheck `npm run typecheck` · lint `npm run lint` · tests `npm test` · build `npm run build`.

## Conventions
- **Units and frames:** specs are mm/kg/deg; the scene is metres (`mm()` / `mmVec()` in
  `src/spec/units.ts`). Vehicle frame: +X forward, +Y up, +Z right, origin at the front-axle
  centre on the ground. The engine frame and crank convention are in the header of
  `src/spec/types.ts`.
- **One spec drives everything:** geometry and numbers come from `src/spec`
  (`layoutPowertrain`, `massProps`, `envelope`, `engineDims`, `firingEvents`, `balance`); never
  duplicate a number that can be derived.
- **Catalog:** one file per engine, motor and vehicle in `src/spec/catalog/`, discovered
  automatically. Every number has a source note, `~` marks an estimate. Vehicles are real cars
  with slug ids (`porsche-911-992`); each must pass the weight-split (±3 points) and
  ground-clearance tests.
- **Design: show, don't tell.** Minimal text: labels anchored to the parts they name, or data
  derived from the spec. Everything works in dark and light themes (CSS tokens in
  `src/app/theme.css`, 3D colours in `src/scene/theme.ts`).

## Car models
Every car wears a detailed model (Ddiaz Design on Sketchfab, CC BY-NC-SA 4.0: see
`public/models/LICENSE.md` and the About page). Downloaded archives go in `models/` (git-ignored).
Per car:
1. `bash scripts/models/extract.sh <archive.zip> <vehicle-id>` → `.tools/tmp/models/<id>/model.fbx`.
2. Run a second dev server for conversions without hot reload:
   `APEX_CONVERT=1 node node_modules/vite/bin/vite.js --port 5174`, then open
   `http://localhost:5174/apex/#/dev/convert?car=<id>[,<id>…]&auto=1`. The converter finds the
   wheels and the nose geometrically, aligns the model to the spec wheelbase, and saves
   `models/raw/<id>.glb`.
   `window.__convert.reports` lists each car's checks (`warnings` must be empty, `nose` says how
   the orientation was decided); `window.__inspect('<folder>')` lists every mesh of a model.
3. `node scripts/models/optimize.mjs <id>` → `public/models/<id>.glb`, and
   `node scripts/models/profile.mjs <id>` → `src/vehicle3d/gltf/profiles/<id>.json`: the body
   profile the cabin, seats and luggage are placed from.
4. Add `src/vehicle3d/gltf/cars/<id>.ts`: `export default ddiaz('<file>.glb', '<title>')`.
5. `node scripts/models/report.mjs <id>` measures the converted model; compare with the spec.

/**
 * #/dev/convert?car=<vehicle-id>&dir=<folder>&file=<model.fbx>[&auto=1]
 * Turns a downloaded FBX car (extracted into .tools/tmp/models/<folder>/) into the aligned GLB the
 * site loads, and saves it through the dev-only endpoint to models/raw/<vehicle-id>.glb
 * (scripts/models/optimize.mjs then compresses it into public/models/<vehicle-id>.glb).
 *
 * What it bakes in:
 *  - frame: model (+Z nose, +X left, +Y up) → vehicle frame (+X forward, +Y up, +Z right), front
 *    axle at x = 0, ground at y = 0, centre line at z = 0, scaled to the spec wheelbase
 *  - wheels: each corner's fragments merged into one node "wheel-<front|rear>-<left|right>",
 *    pivoted at the hub (so the site can spin it); engine-bay meshes dropped (ours shows instead)
 *  - materials: renamed "apx:<role>" (paint, glass, light, interior, trim, tyre, rim…) so the site
 *    can recolour the paint and ghost the body for the x-ray view
 */
import { useEffect } from 'react';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { create } from 'zustand';
import { Dock, Panel } from '../app/ui';
import { getVehicle } from '../spec/catalog';

const DIR = '/apex/.tools/tmp/models/';

export type Role =
  | 'paint'
  | 'glass'
  | 'light'
  | 'interior'
  | 'trim'
  | 'chrome'
  | 'tyre'
  | 'rim'
  | 'brake'
  | 'badge'
  | 'drop';

/** Material role from its (game-export) name. Order matters: first match wins. */
export function roleOf(name: string, inWheel: boolean): Role {
  const n = name.toLowerCase();
  if (inWheel) {
    // newer exports file every wheel part under "MAT_Tire_…": "Tire_Hub" is the rim, "Tire_Disk"
    // the brake; "llanta"/"neumático" are (Latin-American) Spanish for tyre
    const w = n.replace(/tire_(hub|dis[ck]|brake)/g, '$1');
    if (/tyre|tire|rubber|llanta|neum/.test(w)) return 'tyre';
    if (/brake|disc|disk|calip/.test(w)) return 'brake';
    return 'rim';
  }
  if (/engine|undercarriage_engine/.test(n)) return 'drop';
  // (by stem: exports misspell them, 'Windshiled', 'windwos', 'winsows', 'Ligth')
  if (/glass|win[ds](o|s|w)|kaca/.test(n)) return 'glass';
  // ("_Light_Blue_" is a colour, not a lamp)
  if (/(light|ligth|lamp|lens|emissive)(?!_?(blue|grey|gray|green|red|silver))/.test(n))
    return 'light';
  // "INT_Soft", "int2", screens; "(?<![a-z])" keeps "paint" out
  if (/interior|seat|dash|cabin|steer|pedal|carpet|belt|display|(?<![a-z])int(_|\d)/.test(n))
    return 'interior';
  if (/chrome|exhausttip|exhaust/.test(n)) return 'chrome';
  if (/badge|logo|plate/.test(n)) return 'badge';
  if (/chassis/.test(n)) return 'trim';
  // "…_mm_ext1": one exporter's exterior atlas
  // ("kuzov": Russian for body)
  if (/paint|coloured|colored|body|kuzov|(?<![a-z])ext(\d|_|$)/.test(n)) return 'paint';
  return 'trim';
}

/**
 * A mesh's own name, without the material name some exporters append
 * ("mansory_2Hood6_Mesh_013_M_Engine_Max_003" is a bonnet, not an engine part).
 */
const ownName = (n: string) => n.replace(/_MI?_[A-Za-z0-9].*$/, '');

/** Body panels: a nameless material on them is the paint. */
const PANEL =
  /hood|bonnet|bumper|fender|wing(?!_?mirror)|door|trunk|bootlid|tailgate|spoiler|skirt|quarter|roof(?!_?light)/i;

/** A material whose own name says plastic, grille, carbon… stays trim, whatever its panels say. */
const NAMED_TRIM = /plast|grill|carbon|matte|matt_|black|rubber|chassis/i;

/** What a body mesh's own name says it is (votes for its material's role; "drop" is final). */
function meshRole(name: string): Role {
  const n = ownName(name);
  const r = roleOf(n, false);
  return r === 'trim' && PANEL.test(n) ? 'paint' : r;
}

const ROLE_PBR: Record<Exclude<Role, 'drop'>, { roughness: number; metalness: number }> = {
  paint: { roughness: 0.32, metalness: 0.55 },
  glass: { roughness: 0.05, metalness: 0.0 },
  light: { roughness: 0.15, metalness: 0.1 },
  interior: { roughness: 0.8, metalness: 0.0 },
  trim: { roughness: 0.6, metalness: 0.15 },
  chrome: { roughness: 0.12, metalness: 1.0 },
  tyre: { roughness: 0.9, metalness: 0.0 },
  rim: { roughness: 0.35, metalness: 0.8 },
  brake: { roughness: 0.5, metalness: 0.6 },
  badge: { roughness: 0.3, metalness: 0.7 },
};

const PLATE = /licen[cs]e_?plate|plates?[_.-]|_plate/i;
/** materials on meshes that hang under a licence-plate node (filled by bodyRoles) */
const plateMats = new WeakSet<Material>();

/**
 * A licence plate, whatever its material is called ("phong9SG1" wears a game's own branding,
 * embedded, so no file name; its mesh hangs under "…_pivot_licenseplate"): named "…:plate",
 * so the site blanks it.
 */
function platedBy(src: Material): boolean {
  const t = (src as Material & { map?: Texture | null }).map;
  const file = `${t?.name ?? ''} ${(t?.image as { src?: string } | null)?.src ?? ''}`;
  return plateMats.has(src) || PLATE.test(file);
}

const matCache = new Map<string, MeshStandardMaterial>();
function standardFrom(src: Material, role: Exclude<Role, 'drop'>): MeshStandardMaterial {
  const key = `${src.uuid}|${role}`;
  let m = matCache.get(key);
  if (m) return m;
  const s = src as Material & {
    map?: Texture | null;
    normalMap?: Texture | null;
    color?: Color;
    opacity: number;
  };
  const jpeg = (t?: Texture | null) => {
    if (t) t.userData.mimeType = 'image/jpeg';
    return t ?? null;
  };
  m = new MeshStandardMaterial({
    name: `apx:${role}:${src.name}${!/plate/i.test(src.name) && platedBy(src) ? ':plate' : ''}`,
    color: s.color ? s.color.clone() : new Color(1, 1, 1),
    map: jpeg(s.map),
    normalMap: role === 'paint' || role === 'glass' ? null : jpeg(s.normalMap),
    transparent: role === 'glass',
    opacity: role === 'glass' ? 0.35 : 1,
    ...ROLE_PBR[role],
  });
  if (role === 'glass') m.color.set('#1a2129');
  matCache.set(key, m);
  return m;
}

/** Bakes world transform + T into a mesh's geometry, split per material group. */
/**
 * One role per body material: its own name decides; a nameless one ("MI_1272010001_002",
 * "phong3") takes the role most of its meshes' names agree on, else trim. Per material, not per
 * mesh, so panels sharing one paint never split into paint and glass (the 500F's front wings are
 * "…Fender_F…MI_Glass_Light" meshes).
 */
function bodyRoles(fbx: Object3D): Map<Material, Role> {
  const votes = new Map<Material, Role[]>();
  const plated = new Map<Material, number>();
  fbx.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || isWheelish(m)) return;
    const plate = PLATE.test(`${m.name} ${m.parent?.name ?? ''}`);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      votes.set(mat, [...(votes.get(mat) ?? []), meshRole(m.name)]);
      if (plate) plated.set(mat, (plated.get(mat) ?? 0) + 1);
    }
  });
  const out = new Map<Material, Role>();
  for (const [mat, v] of votes) {
    // the plates' own material, not an atlas they share with the rest of the car
    if ((plated.get(mat) ?? 0) > v.length / 2) plateMats.add(mat);
    const own = roleOf(mat.name, false);
    const count = new Map<Role, number>();
    for (const r of v) if (r !== 'trim' && r !== 'drop') count.set(r, (count.get(r) ?? 0) + 1);
    const [best, n] = [...count].sort((a, b) => b[1] - a[1])[0] ?? ['trim', 0];
    const most = n > v.length / 2 ? best : 'trim';
    // "Roof_Color", "Mirrors_color": a part in the paint's colour, whatever its meshes' names
    // say, unless they are inside ("Inr_Color_2"); a modeller's "Color_A06" is just a colour
    const colour = /[a-z]_colou?r/i.test(mat.name) && !NAMED_TRIM.test(mat.name);
    out.set(
      mat,
      platedBy(mat)
        ? 'badge'
        : own !== 'trim' || NAMED_TRIM.test(mat.name)
          ? own
          : colour
            ? most === 'interior'
              ? 'interior'
              : 'paint'
            : most,
    );
  }
  return out;
}

function bake(
  mesh: Mesh,
  T: Matrix4,
  wheel: boolean,
  roles?: Map<Material, Role>,
): { geo: BufferGeometry; role: Role; mat: MeshStandardMaterial | null }[] {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const M = new Matrix4().multiplyMatrices(T, mesh.matrixWorld);
  const src = mesh.geometry;
  const parts: { geo: BufferGeometry; role: Role; mat: MeshStandardMaterial | null }[] = [];
  const groups = src.groups.length
    ? src.groups
    : [
        {
          start: 0,
          count: src.index ? src.index.count : src.attributes.position.count,
          materialIndex: 0,
        },
      ];
  for (const g of groups) {
    const mat = mats[g.materialIndex ?? 0] ?? mats[0];
    // wheels: either name may say tyre, but a mesh of several materials is the whole wheel, so
    // its name ("JAni_Disc_Scale_BR7") says nothing of each; body: engine-bay meshes go by mesh
    // name, the rest take their material's role (bodyRoles)
    const role = wheel
      ? roleOf(groups.length > 1 ? mat.name : `${mat.name} ${mesh.name}`, true)
      : meshRole(mesh.name) === 'drop'
        ? 'drop'
        : (roles?.get(mat) ?? roleOf(mat.name, false));
    if (role === 'drop') continue;
    let geo = src.clone();
    if (src.groups.length > 1) {
      // one material group → its own non-indexed geometry (group ranges are in index order)
      const flat = geo.toNonIndexed();
      const sub = new BufferGeometry();
      for (const [k, attr] of Object.entries(flat.attributes)) {
        const arr = (attr.array as Float32Array).slice(
          g.start * attr.itemSize,
          (g.start + g.count) * attr.itemSize,
        );
        sub.setAttribute(k, new BufferAttribute(arr, attr.itemSize, attr.normalized));
      }
      geo = sub;
    }
    geo.clearGroups();
    // keep only what glTF/our materials use, so fragments with the same material can merge
    for (const k of Object.keys(geo.attributes))
      if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    // untextured geometry still counts (the 750Li's rims and discs have no UVs); glTF merging
    // wants every fragment to carry the same attributes
    if (!geo.attributes.uv)
      geo.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2),
      );
    geo.applyMatrix4(M);
    parts.push({ geo, role, mat: standardFrom(mat, role as Exclude<Role, 'drop'>) });
  }
  return parts;
}

/** Merge baked parts by material into a group of meshes. */
function assemble(
  parts: { geo: BufferGeometry; mat: MeshStandardMaterial | null }[],
  name: string,
): Group {
  const g = new Group();
  g.name = name;
  const byMat = new Map<MeshStandardMaterial, BufferGeometry[]>();
  for (const p of parts) if (p.mat) byMat.set(p.mat, [...(byMat.get(p.mat) ?? []), p.geo]);
  for (const [mat, geos] of byMat) {
    const merged =
      geos.length > 1
        ? (mergeGeometries(
            geos.map((x) => (x.index ? x.toNonIndexed() : x)),
            false,
          ) ?? null)
        : geos[0];
    if (!merged) continue;
    const m = new Mesh(merged, mat);
    m.name = `${name}:${mat.name}`;
    g.add(m);
  }
  return g;
}

/**
 * Game wheels are often one atlas material, so tyre and rim can't be told apart by name: split
 * by radius instead (triangles wholly beyond ~0.8 R from the axle are tyre), so the site can
 * paint driven tyres green in the x-ray view. Geometry is already pivoted on the hub, axle = Z.
 */
function splitTyre(g: Group, R: number) {
  for (const child of [...g.children]) {
    const m = child as Mesh;
    const mat = m.material as MeshStandardMaterial;
    if (!/^apx:rim:/.test(mat.name)) continue;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const pos = geo.attributes.position;
    const tyreIdx: number[] = [];
    const rimIdx: number[] = [];
    for (let t = 0; t < pos.count; t += 3) {
      let rMin = Infinity;
      for (let k = 0; k < 3; k++)
        rMin = Math.min(rMin, Math.hypot(pos.getX(t + k), pos.getY(t + k)));
      (rMin > 0.8 * R ? tyreIdx : rimIdx).push(t);
    }
    if (!tyreIdx.length) continue;
    // all of it beyond the rim: the tyre itself, unless its name says otherwise (an arch lip or
    // a painted wheel part caught with the wheel)
    if (!rimIdx.length) {
      if (/paint|body|colou?r|chrome/i.test(mat.name)) continue;
      const tyreMat = mat.clone();
      tyreMat.name = mat.name.replace(/^apx:rim:/, 'apx:tyre:');
      Object.assign(tyreMat, ROLE_PBR.tyre);
      m.material = tyreMat;
      m.name = `${g.name}:${tyreMat.name}`;
      continue;
    }
    const pick = (tris: number[]) => {
      const out = new BufferGeometry();
      for (const [k, attr] of Object.entries(geo.attributes)) {
        const arr = new Float32Array(tris.length * 3 * attr.itemSize);
        tris.forEach((t, i) =>
          arr.set(
            (attr.array as Float32Array).subarray(t * attr.itemSize, (t + 3) * attr.itemSize),
            i * 3 * attr.itemSize,
          ),
        );
        out.setAttribute(k, new BufferAttribute(arr, attr.itemSize, attr.normalized));
      }
      return out;
    };
    m.geometry = pick(rimIdx);
    const tyreMat = mat.clone();
    tyreMat.name = mat.name.replace(/^apx:rim:/, 'apx:tyre:');
    Object.assign(tyreMat, ROLE_PBR.tyre);
    const tyre = new Mesh(pick(tyreIdx), tyreMat);
    tyre.name = `${g.name}:${tyreMat.name}`;
    g.add(tyre);
  }
}

export interface ConvertReport {
  car: string;
  wheels: string[];
  modelWheelbaseMm: number;
  scale: number;
  sizeMm: number[];
  spec: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    wheelbaseMm: number;
    overhangFMm: number;
  };
  overhangFMm: number;
  trackFMm: number;
  trackRMm: number;
  tyreRmm: number;
  meshes: number;
  wheelMats: string[];
  /** checks that failed (a corner that is not round, so body parts were taken for wheel) */
  warnings: string[];
  /** which way the model faced (+z for most exports) and how that was decided */
  nose: string;
  /** corners whose tyre was found as unnamed body triangles */
  claimedTyres: string[];
  /** roof height: 99.9th percentile of body vertex heights, so an antenna does not count */
  roofMm: number;
  bytes?: number;
  saved?: string;
}

type Part = ReturnType<typeof bake>[number];
type Corner = 'front-left' | 'front-right' | 'rear-left' | 'rear-right';
const CORNERS: Corner[] = ['front-left', 'front-right', 'rear-left', 'rear-right'];

/**
 * Meshes that belong to a wheel (tyre, rim, brake), recognised by mesh, parent or material name.
 * Exports name them every which way (groups, single meshes, rim + tyre, one combined mesh for all
 * four), so the corners are found geometrically afterwards, not from the names.
 */
// "rim" not after a letter, so body "Trim_…" materials stay body ("RRim_FL" is Golf's rim)
// ("alloy": RS5 rims; "break": its misspelt brakes)
const WHEELISH =
  /(?<![a-z])rim|rrim|wheel|whl|tyre|tire|cal+iper|brake|break|disc|disk|rotor|hub|alloy|llanta|neum|(?<![a-z])rin(?![a-z])/i;
// a spare wheel (the 500F keeps one in its front boot, filed under "Engine") is not a corner;
// nor is body chrome named after rims ("chassis_rims_chrome" is the S4's grille)
const NOT_WHEEL =
  /steering|steer_?wheel|arch|well|liner|fender|interior|seat|light|lamp|dash|spare|engine|boot|trunk|chassis|bumper|grill/i;
function isWheelish(m: Mesh) {
  const names: string[] = [];
  for (let o: Object3D | null = m; o; o = o.parent) names.push(o.name);
  // exclusions look at the mesh and its group only: some exports file the wheels under a
  // "Chassis" node, and those must still count
  if (NOT_WHEEL.test(`${ownName(m.name)} ${m.parent?.name ?? ''}`)) return false;
  if (WHEELISH.test(names.join(' '))) return true;
  // unnamed meshes: by material, but only if every material is a wheel one (a body mesh may
  // carry one stray wheel material)
  const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name);
  return mats.length > 0 && mats.every((x) => WHEELISH.test(x) && !NOT_WHEEL.test(x));
}

/** Splits a non-indexed geometry's triangles by which corner of the car their centroid is in. */
function splitByCorner(
  geo: BufferGeometry,
  midX: number,
  midZ: number,
): Map<Corner, BufferGeometry> {
  const pos = geo.attributes.position;
  const tris = new Map<Corner, number[]>();
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    const k = `${cx > midX ? 'front' : 'rear'}-${cz > midZ ? 'right' : 'left'}` as Corner;
    const list = tris.get(k);
    if (list) list.push(t);
    else tris.set(k, [t]);
  }
  const out = new Map<Corner, BufferGeometry>();
  for (const [k, list] of tris) {
    const g = new BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const arr = new Float32Array(list.length * 3 * attr.itemSize);
      list.forEach((t, i) =>
        arr.set(
          (attr.array as Float32Array).subarray(t * attr.itemSize, (t + 3) * attr.itemSize),
          i * 3 * attr.itemSize,
        ),
      );
      g.setAttribute(name, new BufferAttribute(arr, attr.itemSize, attr.normalized));
    }
    out.set(k, g);
  }
  return out;
}

/** Mirror across the plane z = midZ (fixing normals and winding) for a corner the export lacks. */
function mirrorZ(geo: BufferGeometry, midZ: number): BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(
    new Matrix4()
      .makeTranslation(0, 0, midZ)
      .multiply(new Matrix4().makeScale(1, 1, -1))
      .multiply(new Matrix4().makeTranslation(0, 0, -midZ)),
  );
  for (const attr of Object.values(g.attributes)) {
    const a = attr.array as Float32Array;
    const n = attr.itemSize;
    for (let t = 0; t < attr.count; t += 3) {
      for (let c = 0; c < n; c++) {
        const i1 = (t + 1) * n + c;
        const i2 = (t + 2) * n + c;
        [a[i1], a[i2]] = [a[i2], a[i1]];
      }
    }
  }
  return g;
}

/** A geometry of just these triangles (start indices into a non-indexed geometry). */
function pickTriangles(geo: BufferGeometry, tris: number[]): BufferGeometry {
  const out = new BufferGeometry();
  for (const [k, attr] of Object.entries(geo.attributes)) {
    const arr = new Float32Array(tris.length * 3 * attr.itemSize);
    tris.forEach((t, i) =>
      arr.set(
        (attr.array as Float32Array).subarray(t * attr.itemSize, (t + 3) * attr.itemSize),
        i * 3 * attr.itemSize,
      ),
    );
    out.setAttribute(k, new BufferAttribute(arr, attr.itemSize, attr.normalized));
  }
  return out;
}

/**
 * Which way the model's nose points, as a turn about Y into the vehicle frame (+X forward,
 * +Z right). Most exports face +Z, but not all: the SU7, Wrangler and Fortuner lie along X and
 * the 370Z faces −Z. The long horizontal side gives the axis; front/rear words in mesh names
 * (wheels named "…Front_L", bumpers, bonnet, tail lights) give the end.
 */
const FRONT_CUE =
  /(?<![a-z])front|hood|bonnet|grill|headl|frunk|windscreen|windshield|(?<![a-z])bumper_?f(?![a-z])/i;
const REAR_CUE =
  /(?<![a-z])rear(?!_?view)|trunk|(?<![a-z])tail|bootlid|diffuser|spare|(?<![a-z])bumper_?[br](?![a-z])/i;
const NOSE_YAW = { '+z': Math.PI / 2, '-z': -Math.PI / 2, '+x': 0, '-x': Math.PI } as const;
type Nose = keyof typeof NOSE_YAW;
/** Cars whose name cues mislead: their nose set by hand. */
const NOSE: Partial<Record<string, Nose>> = {
  // no front/rear names at all; its frunk grille and dashboard sit at model −X
  'xiaomi-su7-ultra': '-x',
};

/** Body materials whose names say nothing, nor their meshes': their role set by hand. */
const ROLES: Partial<Record<string, Record<string, Exclude<Role, 'drop'>>>> = {
  // the windows (on "Door", "Body", "Roof" meshes) and the black bumper/lamp trim
  'porsche-718-boxster-t-982': { _dummy_material_13: 'glass', _dummy_material_1_028: 'trim' },
};

function findNose(fbx: Object3D, carId: string): { nose: Nose; how: string } {
  const forced = NOSE[carId];
  if (forced) return { nose: forced, how: 'set by hand' };
  const all = new Box3().setFromObject(fbx);
  const size = all.getSize(new Vector3());
  const axis = size.x > size.z * 1.15 ? 'x' : 'z';
  const mid = all.getCenter(new Vector3())[axis];
  const half = size[axis] / 2;
  let score = 0;
  let cues = 0;
  const b = new Box3();
  const c = new Vector3();
  fbx.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const names = `${ownName(m.name)} ${m.parent?.name ?? ''}`;
    const mats = (Array.isArray(m.material) ? m.material : [m.material])
      .map((x) => x.name)
      .join(' ');
    const front = FRONT_CUE.test(names) || /head_?l|front_?light/i.test(mats);
    const rear =
      REAR_CUE.test(names) || /red_glass|tail_?light|back_?light|rear_?light/i.test(mats);
    if (front === rear) return;
    const at = (b.setFromObject(m).getCenter(c)[axis] - mid) / half;
    // near the middle (cabin, mirrors) a cue says nothing about which end is which
    if (Math.abs(at) < 0.2) return;
    score += (front ? 1 : -1) * Math.sign(at);
    cues++;
  });
  if (score > 1) return { nose: `+${axis}`, how: `${cues} name cues` };
  if (score < -1) return { nose: `-${axis}`, how: `${cues} name cues` };
  return { nose: `+${axis}`, how: axis === 'z' ? 'default' : 'undecided, check it (NOSE)' };
}

const roleMats = new Map<string, MeshStandardMaterial>();
/** The same material under another role (body triangles that turn out to be tyre). */
function asRole(mat: MeshStandardMaterial | null, role: Exclude<Role, 'drop'>) {
  if (!mat) return null;
  const key = `${mat.uuid}|${role}`;
  let m = roleMats.get(key);
  if (!m) {
    m = mat.clone();
    m.name = mat.name.replace(/^apx:[a-z]+:/, `apx:${role}:`);
    Object.assign(m, ROLE_PBR[role]);
    roleMats.set(key, m);
  }
  return m;
}

/**
 * Wheel parts nobody named. Body triangles inside a wheel's tyre cylinder join that wheel:
 *  - a whole body mesh inside one cylinder always does (the Micra's rims and wheel nuts);
 *  - single triangles only where the corner has no tyre yet (the 750Li's unnamed tyres, the
 *    RS5's tyres baked into a body atlas mesh), so well-named cars keep their body intact.
 * Returns the corners that gained some.
 */
function claimTyres(
  bodyParts: Part[],
  corners: Map<Corner, Part[]>,
  wb: Record<Corner, Box3>,
  tyreR: number,
  tyreHalfW: number,
): Corner[] {
  const hubs = CORNERS.map((k) => ({
    k,
    c: wb[k].getCenter(new Vector3()),
    open: !corners.get(k)!.some((p) => p.role === 'tyre'),
  }));
  const r2 = (tyreR * 1.03) ** 2;
  const hubAt = (x: number, y: number, z: number) =>
    hubs.find(
      ({ c }) => (x - c.x) ** 2 + (y - c.y) ** 2 < r2 && Math.abs(z - c.z) < tyreHalfW * 1.3,
    );
  const gained = new Set<Corner>();
  for (let i = bodyParts.length - 1; i >= 0; i--) {
    const p = bodyParts[i];
    const geo = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const pos = geo.attributes.position;
    const kept: number[] = [];
    const taken = new Map<Corner, number[]>();
    for (let t = 0; t < pos.count; t += 3) {
      const h = [0, 1, 2].map((v) => hubAt(pos.getX(t + v), pos.getY(t + v), pos.getZ(t + v)));
      const k = h[0] && h.every((x) => x === h[0]) ? h[0].k : null;
      if (!k) kept.push(t);
      else if (taken.has(k)) taken.get(k)!.push(t);
      else taken.set(k, [t]);
    }
    if (!taken.size) continue;
    const whole = !kept.length && taken.size === 1;
    let moved = false;
    for (const [k, tris] of taken) {
      if (!whole && !hubs.find((x) => x.k === k)!.open) {
        kept.push(...tris);
        continue;
      }
      corners
        .get(k)!
        .push({ geo: pickTriangles(geo, tris), role: 'rim', mat: asRole(p.mat, 'rim') });
      gained.add(k);
      moved = true;
    }
    if (!moved) continue;
    if (kept.length)
      bodyParts[i] = {
        ...p,
        geo: pickTriangles(
          geo,
          kept.sort((a, b) => a - b),
        ),
      };
    else bodyParts.splice(i, 1);
  }
  return [...gained];
}

/** 99.9th percentile of the body's vertex heights (sampled), in the vehicle frame. */
function roofHeight(scene: Group): number {
  const ys: number[] = [];
  scene.getObjectByName('body')?.traverse((o) => {
    const pos = (o as Mesh).geometry?.attributes.position;
    if (pos) for (let i = 0; i < pos.count; i += 7) ys.push(pos.getY(i));
  });
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length * 0.999)] ?? 0;
}

export function buildCar(fbx: Object3D, carId: string): { scene: Group; report: ConvertReport } {
  const spec = getVehicle(carId);
  fbx.updateMatrixWorld(true);
  // model frame → vehicle frame (+X nose, +Y up, +Z right)
  const { nose, how } = findNose(fbx, carId);
  const R = new Matrix4().makeRotationY(NOSE_YAW[nose]);

  const bodyParts: Part[] = [];
  const wheelParts: Part[] = [];
  const wheelMats = new Set<string>();
  const roles = bodyRoles(fbx);
  for (const mat of roles.keys()) {
    const forced = ROLES[carId]?.[mat.name];
    if (forced) roles.set(mat, forced);
  }
  fbx.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.visible) return;
    if (isWheelish(m)) {
      for (const x of Array.isArray(m.material) ? m.material : [m.material]) wheelMats.add(x.name);
      wheelParts.push(...bake(m, R, true));
    } else bodyParts.push(...bake(m, R, false, roles));
  });
  const carBox = new Box3();
  for (const p of bodyParts) {
    p.geo.computeBoundingBox();
    carBox.union(p.geo.boundingBox!);
  }
  const midX = (carBox.min.x + carBox.max.x) / 2;
  const midZ = (carBox.min.z + carBox.max.z) / 2;

  // every wheel triangle into its corner
  const corners = new Map<Corner, Part[]>();
  for (const p of wheelParts) {
    const flat = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    for (const [k, g] of splitByCorner(flat, midX, midZ))
      corners.set(k, [...(corners.get(k) ?? []), { ...p, geo: g }]);
  }
  const twin = (k: Corner): Corner =>
    k.endsWith('left')
      ? (k.replace('left', 'right') as Corner)
      : (k.replace('right', 'left') as Corner);
  const mirrored: string[] = [];
  for (const k of CORNERS) {
    if (corners.has(k)) continue;
    const src = corners.get(twin(k));
    if (!src)
      throw new Error(
        `no wheel geometry near the ${k} corner (wheel materials: ${[...wheelMats].join(', ')})`,
      );
    corners.set(
      k,
      src.map((p) => ({ ...p, geo: mirrorZ(p.geo, midZ) })),
    );
    mirrored.push(k);
  }
  const bounds = (k: Corner) => {
    const b = new Box3();
    for (const p of corners.get(k)!) {
      p.geo.computeBoundingBox();
      b.union(p.geo.boundingBox!);
    }
    return b;
  };
  const wb = Object.fromEntries(CORNERS.map((k) => [k, bounds(k)])) as Record<Corner, Box3>;
  const cx = (k: Corner) => (wb[k].min.x + wb[k].max.x) / 2;
  const xF = (cx('front-left') + cx('front-right')) / 2;
  const xR = (cx('rear-left') + cx('rear-right')) / 2;
  const wbModel = xF - xR;
  const s = spec.dims.wheelbaseMm / 1000 / wbModel;
  // hubs are known from rims/discs alone, so unnamed tyres can be found around them (sized by
  // the spec, in model units)
  const claimed = claimTyres(
    bodyParts,
    corners,
    wb,
    spec.tires.diameterMm / 2000 / s,
    Math.max(spec.tires.widthFMm, spec.tires.widthRMm) / 2000 / s,
  );
  for (const k of claimed) wb[k] = bounds(k);
  const warnings: string[] = [];
  for (const k of CORNERS) {
    // a wheel is round: as long as it is tall (a caliper or disc may stick out a little)
    const ratio = (wb[k].max.x - wb[k].min.x) / (wb[k].max.y - wb[k].min.y);
    if (ratio < 0.9 || ratio > 1.15)
      warnings.push(`${k} wheel is ${ratio.toFixed(2)}× as long as tall`);
  }
  if (how.startsWith('undecided')) warnings.push(`nose direction ${how}`);
  // scaled to the wheelbase, the body should come out near the published length; if it doesn't,
  // the wheels were misread (a part taken for a wheel, or a wheel missed)
  const lengthOff = ((carBox.max.x - carBox.min.x) * s * 1000) / spec.dims.lengthMm - 1;
  if (Math.abs(lengthOff) > 0.06)
    warnings.push(`length ${Math.round(lengthOff * 100)}% off the spec: check the wheels`);
  const ground = Math.min(...CORNERS.map((k) => wb[k].min.y));
  const T = new Matrix4()
    .makeScale(s, s, s)
    .multiply(new Matrix4().makeTranslation(-xF, -ground, -midZ));

  const scene = new Group();
  scene.name = carId;
  for (const p of bodyParts) p.geo.applyMatrix4(T);
  scene.add(assemble(bodyParts, 'body'));

  let tyreR = 0;
  for (const k of CORNERS) {
    const parts = corners.get(k)!;
    for (const p of parts) p.geo.applyMatrix4(T);
    const g = assemble(parts, `wheel-${k}`);
    // Pivot on the hub plane: the bounds' x/y are the tyre, but z is biased inward by the
    // disc/caliper, so take the tyre's OUTER face minus half the spec tyre width.
    const b = new Box3().setFromObject(g);
    const tyreW = (k.startsWith('front') ? spec.tires.widthFMm : spec.tires.widthRMm) / 1000;
    const pivot = new Vector3(
      (b.min.x + b.max.x) / 2,
      (b.min.y + b.max.y) / 2,
      k.endsWith('right') ? b.max.z - tyreW / 2 : b.min.z + tyreW / 2,
    );
    g.children.forEach((m) => (m as Mesh).geometry.translate(-pivot.x, -pivot.y, -pivot.z));
    splitTyre(g, (b.max.y - b.min.y) / 2);
    tyreR += (b.max.y - b.min.y) / 8;
    g.position.copy(pivot);
    scene.add(g);
  }

  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const wc = (n: string) => scene.getObjectByName(n)!.position;
  const report: ConvertReport = {
    car: carId,
    wheels: CORNERS.map((k) => `${k}${mirrored.includes(k) ? ' (mirrored)' : ''}`),
    modelWheelbaseMm: Math.round(wbModel * 1000),
    scale: +s.toFixed(4),
    sizeMm: [size.x, size.y, size.z].map((v) => Math.round(v * 1000)),
    spec: {
      lengthMm: spec.dims.lengthMm,
      widthMm: spec.dims.widthMm,
      heightMm: spec.dims.heightMm,
      wheelbaseMm: spec.dims.wheelbaseMm,
      overhangFMm: spec.dims.overhangFMm,
    },
    overhangFMm: Math.round(box.max.x * 1000),
    roofMm: Math.round(roofHeight(scene) * 1000),
    trackFMm: Math.round((wc('wheel-front-right').z - wc('wheel-front-left').z) * 1000),
    trackRMm: Math.round((wc('wheel-rear-right').z - wc('wheel-rear-left').z) * 1000),
    tyreRmm: Math.round(tyreR * 1000),
    meshes: 0,
    wheelMats: [...wheelMats],
    warnings,
    nose: `${nose} (${how})`,
    claimedTyres: claimed,
  };
  scene.traverse((o) => {
    if ((o as Mesh).isMesh) report.meshes++;
  });
  return { scene, report };
}

/** FBXLoader returns before its textures finish; wait for them, drop any that never load. */
async function settleTextures(scene: Group, timeoutMs = 15000) {
  const slots: { m: MeshStandardMaterial; k: 'map' | 'normalMap' }[] = [];
  scene.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (!m || !(o as Mesh).isMesh) return;
    for (const k of ['map', 'normalMap'] as const) if (m[k]) slots.push({ m, k });
  });
  // slots repeat when meshes share a material, so a texture may already be dropped
  const ok = (t: Texture | null) => {
    if (!t) return true;
    const img = t.image as { width?: number; complete?: boolean } | undefined;
    return !!img && (img.width ?? 0) > 0 && img.complete !== false;
  };
  const t0 = performance.now();
  while (slots.some((s) => !ok(s.m[s.k])) && performance.now() - t0 < timeoutMs)
    await new Promise((r) => setTimeout(r, 200));
  for (const s of slots) if (!ok(s.m[s.k])) s.m[s.k] = null;
}

async function exportGlb(scene: Group): Promise<ArrayBuffer> {
  await settleTextures(scene);
  return new Promise((resolve, reject) =>
    new GLTFExporter().parse(scene, (r) => resolve(r as ArrayBuffer), reject, {
      binary: true,
      // full-size textures for now: correctness first, sizes later
      maxTextureSize: 8192,
    }),
  );
}

/** Every mesh of a model in the vehicle frame (unscaled), to see how an export names its wheels. */
export async function inspect(dir: string, file = 'model.fbx') {
  const fbx = await new FBXLoader().loadAsync(`${DIR}${dir}/${file}`);
  fbx.updateMatrixWorld(true);
  const R = new Matrix4().makeRotationY(Math.PI / 2);
  const r = (v: Vector3) => [v.x, v.y, v.z].map((x) => +x.toPrecision(3));
  const out: {
    name: string;
    parent: string;
    mats: string;
    wheelish: boolean;
    min: number[];
    max: number[];
    verts: number;
  }[] = [];
  fbx.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const b = new Box3().setFromObject(m).applyMatrix4(R);
    const mats = (Array.isArray(m.material) ? m.material : [m.material])
      .map((x) => x.name)
      .join(',');
    out.push({
      name: m.name,
      parent: m.parent?.name ?? '',
      mats,
      wheelish: isWheelish(m),
      min: r(b.min),
      max: r(b.max),
      verts: m.geometry.attributes.position.count,
    });
  });
  return out;
}

/** The model on show, set by the batch below (which runs in the DOM overlay, not the canvas:
 * a background tab doesn't render its canvas, but its DOM effects still run). */
const useShown = create<{ shown: { obj: Object3D; L: number } | null; status: string }>(() => ({
  shown: null,
  status: '',
}));

/** ?car=a[,b,…] converts each in turn (folder = car id unless ?dir=), auto=1 saves each. */
function useBatch() {
  useEffect(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const cars = (q.get('car') ?? 'bmw-z4-g29').split(',');
    const w = window as unknown as {
      __convert: { status: string; reports: unknown[]; error?: string; current?: string };
    };
    w.__convert = { status: 'loading', reports: [] };
    (window as unknown as { __inspect: typeof inspect }).__inspect = inspect;
    let live = true;
    (async () => {
      for (const [i, car] of cars.entries()) {
        if (!live) return;
        w.__convert.current = car;
        useShown.setState({ status: `${i + 1}/${cars.length} ${car}` });
        try {
          const fbx = await new FBXLoader().loadAsync(
            `${DIR}${q.get('dir') ?? car}/${q.get('file') ?? 'model.fbx'}`,
          );
          // React's dev double-mount starts a second batch; the first stops here
          if (!live) return;
          const { scene, report } = buildCar(fbx, car);
          useShown.setState({ shown: { obj: scene, L: getVehicle(car).dims.wheelbaseMm / 1000 } });
          let extra = {};
          if (q.get('auto') === '1') {
            const buf = await exportGlb(scene);
            const res = await fetch(`/__apex/save-model?id=${car}`, { method: 'POST', body: buf });
            extra = { bytes: buf.byteLength, saved: await res.text() };
          }
          w.__convert.reports.push({ ...report, ...extra });
        } catch (e) {
          w.__convert.reports.push({
            car,
            error: String(e),
            stack: (e as Error).stack?.split('\n').slice(0, 6).join(' | '),
          });
        }
      }
      w.__convert.status = 'done';
      useShown.setState({ status: `done · ${cars.length} car${cars.length > 1 ? 's' : ''}` });
    })();
    return () => {
      live = false;
    };
  }, []);
}

export function Scene() {
  const shown = useShown((s) => s.shown);
  // spec-placed like the explorer: the model's front axle at x = 0 → centre the wheelbase.
  // The offset goes on a wrapper: on the model itself it would end up in the exported file.
  return shown ? (
    <group position={[shown.L / 2, 0, 0]}>
      <primitive object={shown.obj} />
    </group>
  ) : null;
}

export function Overlay() {
  useBatch();
  const status = useShown((s) => s.status);
  return (
    <Dock side="top-left">
      <Panel title="Convert">
        <span className="apx-muted">
          ?car=&lt;vehicle-id&gt;&amp;dir=&lt;folder&gt;&amp;file=&lt;model.fbx&gt;&amp;auto=1 ·
          window.__convert
        </span>
        <div>{status}</div>
      </Panel>
    </Dock>
  );
}

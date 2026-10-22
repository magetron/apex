/**
 * Side-profile reference photos for tuning the look-alike bodies (dev sandbox only, never part
 * of the site). All from Wikimedia Commons; the file page states its licence and author.
 * One file per car in ./likeness-refs/<vehicle-id>.ts, discovered automatically:
 *   export default ref('<hash path a/ab>', '<File_name.jpg>', aspect, facing, front, rear, depth);
 * front/rear = wheel-centre positions as fractions of the image (u right, v down).
 */
export interface LikenessRef {
  /** Commons file name (its page: https://commons.wikimedia.org/wiki/File:<file>) */
  file: string;
  /** a ~1280 px thumbnail */
  url: string;
  /** which way the car's nose points in the photo */
  facing: 'left' | 'right';
  front: [number, number];
  rear: [number, number];
  /** image width / height */
  aspect: number;
  /** perspective depth ratio of the centre plane (1 = telephoto / no correction) */
  depth?: number;
}

const thumb = (path: string, file: string, w = 1280) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${file}/${w}px-${file}`;

export function ref(
  path: string,
  file: string,
  aspect: number,
  facing: 'left' | 'right',
  front: [number, number],
  rear: [number, number],
  depth?: number,
): LikenessRef {
  return { file, url: thumb(path, file), facing, front, rear, aspect, depth };
}

export const LIKENESS_REFS: Record<string, LikenessRef> = Object.fromEntries(
  Object.entries(
    import.meta.glob<LikenessRef>('./likeness-refs/*.ts', { eager: true, import: 'default' }),
  ).map(([path, r]) => [path.replace(/^.*\/|\.ts$/g, ''), r]),
);

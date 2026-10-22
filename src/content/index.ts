/** Tour registry: add src/content/tours/<id>.ts default-exporting a Tour; it is discovered. */
import type { Tour } from './types';

const tours = new Map<string, Tour>();
for (const [path, t] of Object.entries(
  import.meta.glob<Tour>('./tours/*.ts', { eager: true, import: 'default' }),
)) {
  if (tours.has(t.id)) throw new Error(`duplicate tour id "${t.id}" (${path})`);
  tours.set(t.id, t);
}

export const listTours = (): Tour[] => [...tours.values()];
export const findTour = (id: string) => tours.get(id);

export type * from './types';

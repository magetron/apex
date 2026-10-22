import type { ComponentType } from 'react';

export type Params = Record<string, string | undefined>;
export interface PageProps {
  params: Params;
}

/**
 * A page module named-exports:
 *  - Scene   (optional) rendered inside the one persistent <Canvas>
 *  - Overlay rendered in the DOM layer above it
 * The site is essentially one page — the explorer — plus a couple of utility routes.
 */
export interface PageModule {
  Scene?: ComponentType<PageProps>;
  Overlay: ComponentType<PageProps>;
}

export interface RouteDef {
  /** "/dev/:module?" — ":x?" is an optional segment */
  pattern: string;
  title: string;
  /** shown in the top bar when set */
  nav?: string;
  load: () => Promise<PageModule>;
}

export const ROUTES: RouteDef[] = [
  { pattern: '/about', title: 'About', nav: 'About', load: () => import('../pages/About') },
  { pattern: '/dev/:module?', title: 'Dev sandbox', load: () => import('../dev/DevPage') },
  // everything else is the explorer; it parses the rest of the hash itself (see explorer/view.ts)
  { pattern: '/:vehicle?/:level?/:detail?', title: 'Explorer', load: () => import('../explorer') },
];

export function matchPattern(pattern: string, path: string): Params | null {
  const want = pattern.split('/').filter(Boolean);
  const got = path.split('?')[0].split('/').filter(Boolean);
  const params: Params = {};
  let i = 0;
  for (const seg of want) {
    const optional = seg.endsWith('?');
    const name = seg.replace(/^:/, '').replace(/\?$/, '');
    const value = got[i];
    if (seg.startsWith(':')) {
      if (value === undefined) {
        if (optional) continue;
        return null;
      }
      params[name] = decodeURIComponent(value);
      i++;
    } else {
      if (value !== seg) return null;
      i++;
    }
  }
  return i === got.length ? params : null;
}

export function matchRoute(path: string): { route: RouteDef; params: Params } | null {
  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

/** Hash href for a path, e.g. href('/porsche-911-992/engine') → '#/porsche-911-992/engine'. */
export const href = (path: string) => `#${path}`;

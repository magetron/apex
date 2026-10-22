import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, events as pointerEvents } from '@react-three/fiber';
import { Suspense, use, useEffect, useState } from 'react';
import type { Object3D } from 'three';
import { useHashLocation } from 'wouter/use-hash-location';
import { Stage } from '../scene/Stage';
import { useScene } from '../scene/store';
import { matchRoute, ROUTES, type PageModule, type Params, type RouteDef } from './routes';
import { TopBar } from './TopBar';

const modules = new Map<string, Promise<PageModule>>();
const loadPage = (route: RouteDef) => {
  let p = modules.get(route.pattern);
  if (!p) {
    p = route.load();
    modules.set(route.pattern, p);
  }
  return p;
};

function PageScene({ route, params }: { route: RouteDef; params: Params }) {
  const { Scene } = use(loadPage(route));
  return Scene ? <Scene params={params} /> : null;
}

function PageOverlay({ route, params }: { route: RouteDef; params: Params }) {
  const { Overlay } = use(loadPage(route));
  return <Overlay params={params} />;
}

/** three.js raycasts hidden objects too; parts hidden by focus isolation must not catch clicks. */
const shown = (o: Object3D | null): boolean => {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
};

function AppCanvas({ route, params }: { route: RouteDef; params: Params }) {
  const [dpr, setDpr] = useState(() => Math.min(2, window.devicePixelRatio || 1));
  return (
    <Canvas
      className="apx-canvas"
      shadows
      dpr={dpr}
      // near 0.1 (not 0.05): twice the depth precision for the near-coplanar road/grid/marks
      camera={{ position: [4.8, 2.4, 5.6], fov: 35, near: 0.1, far: 250 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => useScene.getState().miss()}
      events={(store) => ({
        ...pointerEvents(store),
        filter: (hits) => hits.filter((h) => shown(h.object)),
      })}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio || 1))}
      />
      <Stage>
        <Suspense fallback={null}>
          <PageScene route={route} params={params} />
        </Suspense>
      </Stage>
    </Canvas>
  );
}

export function App() {
  const [location] = useHashLocation();
  const match = matchRoute(location) ?? { route: ROUTES[ROUTES.length - 1], params: {} };
  const { route, params } = match;

  useEffect(() => {
    useScene.getState().resetView();
    document.title = route.title === 'Explorer' ? 'Apex' : `${route.title} · Apex`;
  }, [route]);

  return (
    <div className="apx-app">
      <AppCanvas route={route} params={params} />
      <TopBar location={location} />
      <main className="apx-overlay">
        <Suspense fallback={<div className="apx-loading">Loading…</div>}>
          <PageOverlay route={route} params={params} />
        </Suspense>
      </main>
    </div>
  );
}

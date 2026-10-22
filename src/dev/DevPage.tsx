/**
 * #/dev/<module> — one sandbox per module. Add src/dev/<module>.tsx exporting
 * { Scene?, Overlay } (same shape as a page); it is discovered automatically.
 */
import { use } from 'react';
import { Dock, Panel } from '../app/ui';
import { href, type PageModule, type PageProps } from '../app/routes';

const sandboxes = Object.fromEntries(
  Object.entries(import.meta.glob<PageModule>(['./*.tsx', '!./DevPage.tsx'])).map(
    ([path, load]) => [path.replace(/^\.\/|\.tsx$/g, ''), load],
  ),
);

const cache = new Map<string, Promise<PageModule>>();
const load = (name: string) => {
  let p = cache.get(name);
  if (!p) {
    p = sandboxes[name]();
    cache.set(name, p);
  }
  return p;
};

function Index() {
  return (
    <Dock side="center">
      <Panel title="Dev sandboxes" style={{ minWidth: 280 }}>
        <ul className="apx-list">
          {Object.keys(sandboxes).map((name) => (
            <li key={name}>
              <a href={href(`/dev/${name}`)}>{name}</a>
            </li>
          ))}
        </ul>
      </Panel>
    </Dock>
  );
}

function SandboxScene({ name, params }: { name: string } & PageProps) {
  const { Scene } = use(load(name));
  return Scene ? <Scene params={params} /> : null;
}

function SandboxOverlay({ name, params }: { name: string } & PageProps) {
  const { Overlay } = use(load(name));
  return <Overlay params={params} />;
}

export function Scene({ params }: PageProps) {
  const name = params.module;
  return name && sandboxes[name] ? <SandboxScene name={name} params={params} /> : null;
}

export function Overlay({ params }: PageProps) {
  const name = params.module;
  return name && sandboxes[name] ? <SandboxOverlay name={name} params={params} /> : <Index />;
}

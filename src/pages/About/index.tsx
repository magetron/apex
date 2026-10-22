/** About: purpose, fair-use statement and credits (model credits from the glTF manifest). */
import { Dock, Panel } from '../../app/ui';
import { GLTF_CARS, GLTF_CHANGES, type GltfCredit } from '../../vehicle3d/gltf/manifest';

/** one entry per model file, grouped by author + licence */
function modelCredits() {
  const byFile = new Map<string, GltfCredit>();
  for (const c of Object.values(GLTF_CARS)) byFile.set(c.file, c.credit);
  const groups = new Map<string, { credit: GltfCredit; titles: string[] }>();
  for (const credit of byFile.values()) {
    const k = `${credit.author}|${credit.license}`;
    const g = groups.get(k) ?? { credit, titles: [] };
    g.titles.push(credit.title);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => ({ ...g, titles: g.titles.sort() }));
}

export function Overlay() {
  const credits = modelCredits();
  return (
    <Dock side="center">
      <Panel title="About Apex" style={{ maxWidth: 620 }}>
        <p>
          A non-profit teaching project. Car names identify real examples; the drivetrains, engines
          and numbers are our own simplified models (“~” marks an estimate).
        </p>
        {credits.map(({ credit, titles }) => (
          <p key={credit.author}>
            Car models by {credit.author} (Sketchfab), licensed{' '}
            <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
              {credit.license}
            </a>
            . {GLTF_CHANGES} Thank you.
            <br />
            <small className="apx-muted">{titles.join(' · ')}</small>
          </p>
        ))}
        <p>
          Built with three.js, React Three Fiber, drei and Vite. Engine sound after Baldan &amp;
          Delle Monache (2015) and the MIT-licensed enginesound and engine-sound-generator projects.
        </p>
      </Panel>
    </Dock>
  );
}

// Contact sheet of Wikimedia Commons photos for picking side-profile references.
// usage: node scripts/likeness/sheet.mjs .tools/tmp/refs/<car>.html "Category:A" ...  (walks 2 levels)
// then open http://localhost:5173/apex/.tools/tmp/refs/<car>.html — widest (side-on) photos first.
// MIN_ASPECT=1.5 env var widens the net.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'apex-edu/0.1' };
const get = async (params) =>
  (
    await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: UA })
  ).json();

async function members(cat, type) {
  const out = [];
  let cont;
  do {
    const r = await get({
      action: 'query',
      list: 'categorymembers',
      cmtitle: cat,
      cmtype: type,
      cmlimit: '500',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    out.push(...r.query.categorymembers.map((m) => m.title));
    cont = r.continue?.cmcontinue;
  } while (cont);
  return out;
}

async function walk(cat, depth, seen) {
  if (seen.has(cat)) return [];
  seen.add(cat);
  const files = await members(cat, 'file');
  if (depth > 0)
    for (const sub of await members(cat, 'subcat'))
      files.push(...(await walk(sub, depth - 1, seen)));
  return files;
}

const [out, ...cats] = process.argv.slice(2);
const seen = new Set();
let files = [];
for (const c of cats) files.push(...(await walk(c, 2, seen)));
files = [...new Set(files)].filter((f) => /\.(jpe?g|png)$/i.test(f)).slice(0, 1500);

const thumbs = [];
for (let i = 0; i < files.length; i += 40) {
  const r = await get({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '360',
    titles: files.slice(i, i + 40).join('|'),
  });
  for (const p of Object.values(r.query.pages)) {
    const ii = p.imageinfo?.[0];
    if (ii) thumbs.push({ title: p.title, thumb: ii.thumburl, w: ii.width, h: ii.height });
  }
}
// side profiles are wide: rank by aspect ratio, keep the widest
const minAspect = Number(process.env.MIN_ASPECT ?? 1.7);
thumbs.sort((a, b) => b.w / b.h - a.w / a.h);
thumbs.splice(
  0,
  thumbs.length,
  ...thumbs
    .filter(
      (t) =>
        t.w / t.h >= minAspect &&
        !/racing|race|gt3|cup|rsr|le mans|wec|imsa|dtm|hours/i.test(t.title),
    )
    .slice(0, 120),
);
const html = `<!doctype html><meta charset="utf-8"><style>body{font:11px sans-serif;margin:8px;background:#fff}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px}.c{border:1px solid #ccc;padding:3px}
img{width:100%;height:110px;object-fit:contain;background:#eee}b{display:block;font-weight:normal;word-break:break-all}</style>
<div class="g">${thumbs.map((t, i) => `<div class="c"><img loading="lazy" src="${t.thumb}"><b>#${i} ${t.title.replace('File:', '')} (${t.w}×${t.h})</b></div>`).join('')}</div>
<script>window.__thumbs=${JSON.stringify(thumbs)}</script>`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${thumbs.length} images → ${out}`);

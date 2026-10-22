/**
 * The drive page's text budget: at most BUDGET words in sight at any moment of a watched run
 * (its start, its stop at the key moment, its end), car names and question titles aside. The
 * scene explains; words only name what it shows. Counted here the same way for the test and
 * the #/dev/drive sandbox.
 */

export const BUDGET = 25;

/** A speed as the cars' tags say it. */
export const speedText = (kmh: number) => `${Math.round(kmh)} km/h`;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  times: '×',
};

/**
 * The text a visitor sees in server-rendered markup: an SVG's tooltip (<title>), a menu's
 * options (<select>) and anything marked hidden left out; every tag a space, so text in
 * neighbouring elements never runs together.
 */
export function visibleText(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<select[\s\S]*?<\/select>/g, ' ')
    .replace(/<([a-z]+)[^>]*\shidden(?:=""|\s|>)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10))
        : (ENTITIES[e] ?? m),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words in `text` once the names (car names, question titles, as they appear) are taken
 *  out: each run of characters between spaces with a letter or digit in it. */
export function words(text: string, names: readonly string[] = []): string[] {
  let t = ` ${text} `;
  // longest first, so a name inside another goes with it
  for (const n of [...names].filter(Boolean).sort((a, b) => b.length - a.length))
    t = t.split(n).join(' ');
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

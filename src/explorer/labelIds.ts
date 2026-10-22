/**
 * Which part a 3D label names, by its text, for the explorer's own car: a click on a label opens
 * (or picks) its part, as a click on the part does. The parts' label wrappers note themselves here
 * as they render.
 */
const ids = new Map<string, string>();

/** A compared car's part ("vs1:engine") never takes over its text from the explorer's own car. */
export function noteLabel(label: string | undefined, id: string) {
  if (label && !id.includes(':')) ids.set(label, id);
}

export const partOfLabel = (text: string) => ids.get(text.trim());

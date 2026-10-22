/**
 * The engine's and motor's own parts (block, crank, pistons, stator…) name themselves on hover
 * as ever, but "All" labels them only with the unit open (zoomed into), and then only the parts
 * that explain it (crank, pistons, heads, cams, intake, exhaust, turbos; not the block, sump,
 * flywheel, timing drive or casings): about ten labels on one crank line buried each other.
 */
import { noteLabel } from '../explorer/labelIds';
import { useView } from '../explorer/view';
import { Part as ScenePart, type PartProps } from '../scene/Part';
import { useScene } from '../scene/store';

/** sub-parts "All" leaves out (they still name themselves on hover) */
const MINOR = /\/(block|sump|flywheel|timing|front-cover|chambers|housing|case)/;

export function Part(props: PartProps) {
  const [view] = useView();
  // "engine/crank" belongs to the unit "engine" (a compared car's "vs1:engine" never opens)
  const open = view.level === 'part' && view.part === props.id.split('/')[0];
  const all = useScene((s) => s.labels === 'all');
  const pointed = useScene((s) => s.hovered === props.id || s.selected === props.id);
  noteLabel(props.label, props.id);
  const quiet = all && !pointed && (!open || MINOR.test(props.id));
  return <ScenePart {...props} label={quiet ? undefined : props.label} />;
}

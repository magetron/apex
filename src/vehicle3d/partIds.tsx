/**
 * Part ids and labels per car. The explorer's own car uses the plain layout ids ("engine",
 * "body"); a second car in the same scene (a comparison) prefixes every id ("vs1:engine"), so the
 * two never share a registry entry, a hover outline or a zoom. The vehicle model's parts all go
 * through this <Part>, which adds the prefix from context and keeps the labels readable:
 *  - labels "All" names only the major parts (engine, gearbox, diffs, motors, battery, tank),
 *    and not those at the far end of the car from the camera (the engine always); everything
 *    still names itself on hover
 *  - a part hidden (inside the painted body, or behind a zoom) says nothing
 *  - a zoomed unit leaves its name to its own parts and the card
 *  - a compared car keeps its hover labels but not "All": two cars' worth of labels is noise
 */
import { createContext, useContext } from 'react';
import { create } from 'zustand';
import { noteLabel } from '../explorer/labelIds';
import { Part as ScenePart, type PartProps } from '../scene/Part';
import { relatedToFocus, useScene } from '../scene/store';

export const PartPrefix = createContext('');

export const usePartPrefix = () => useContext(PartPrefix);

/** true around parts the painted body hides (the drivetrain with see-through off) */
export const Unseen = createContext(false);

/**
 * The car's length as its parts are placed (vehicle frame, m): its middle and how far from it a
 * part counts as at one end.
 */
export const CarSpan = createContext<{ mid: number; end: number } | null>(null);

/** Which end of the car the camera looks from (null: from the side or above), kept by the model. */
export const useCameraEnd = create<{ end: 'front' | 'rear' | null }>(() => ({ end: null }));

/** the parts "All" labels: the drivetrain's big pieces (not their sub-parts) */
const MAJOR = /^(engine|gearbox|diff-|coupling|motor-|battery|fuel-tank)[^/]*$/;
/** never hidden for being at the far end: what the page is about */
const KEY = /^(engine|motor-)/;

export function Part(props: PartProps) {
  const prefix = useContext(PartPrefix);
  const unseen = useContext(Unseen);
  const span = useContext(CarSpan);
  const id = prefix + props.id;
  const all = useScene((s) => s.labels === 'all');
  const pointed = useScene((s) => s.hovered === id || s.selected === id);
  const away = useScene((s) => s.focus !== null && !relatedToFocus(id, s.focus));
  const zoomed = useScene((s) => s.focus === id);
  const end = useCameraEnd((s) => s.end);
  const x = props.position?.[0];
  const far =
    !!span &&
    x !== undefined &&
    !KEY.test(props.id) &&
    (end === 'rear' ? x > span.mid + span.end : end === 'front' ? x < span.mid - span.end : false);
  const listed = !prefix && MAJOR.test(props.id) && !far && !zoomed;
  const quiet = unseen || away || (all && !pointed && !listed);
  noteLabel(props.label, id);
  return <ScenePart {...props} id={id} label={quiet ? undefined : props.label} />;
}

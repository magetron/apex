/**
 * Part ids per car. The explorer's own car uses the plain layout ids ("engine", "body"); a second
 * car in the same scene (a comparison) prefixes every id ("vs1:engine"), so the two never share
 * a registry entry, a hover outline or a zoom. The vehicle model's parts all go through this
 * <Part>, which adds the prefix from context.
 */
import { createContext, useContext } from 'react';
import { Part as ScenePart, type PartProps } from '../scene/Part';
import { useScene } from '../scene/store';

export const PartPrefix = createContext('');

export const usePartPrefix = () => useContext(PartPrefix);

export function Part(props: PartProps) {
  const prefix = useContext(PartPrefix);
  // a compared car keeps its hover labels but not "all": two cars' worth of labels is noise
  const all = useScene((s) => s.labels === 'all');
  if (!prefix) return <ScenePart {...props} />;
  return <ScenePart {...props} id={prefix + props.id} label={all ? undefined : props.label} />;
}

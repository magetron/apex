/**
 * A light from behind and above the car on show: it draws a bright edge round the body, so a
 * black car stands off the dark ground (on the light theme a softer one; a pale car needs little).
 */
import { useTheme } from '../scene/theme';

export function RimLight() {
  const dark = useTheme((s) => s.theme === 'dark');
  return <directionalLight position={[-5, 5, -6]} intensity={dark ? 1.6 : 0.5} color="#d8e8ff" />;
}

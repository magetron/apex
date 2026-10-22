/** Sound API: mount <SoundPanel engine>, or drive a voice yourself with useEngineAudio. */
export { SoundControls, SoundPanel } from './SoundPanel';
export { useEngineAudio, type EngineAudio, type EngineAudioOptions } from './useEngineAudio';
export {
  availableAddons,
  defaultAddons,
  isMotor,
  voiceConfig,
  type AddonKey,
  type SoundSource,
} from './config';
export type { Addons } from './dsp/types';
export { useAudioSettings } from './settings';

/** Sound API: drive a voice with useEngineAudio and mount <SoundControls audio>. */
export { SoundControls } from './SoundPanel';
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

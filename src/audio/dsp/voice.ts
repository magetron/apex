import { EngineKernel } from './engineKernel';
import { MotorKernel } from './motorKernel';
import type { Addons, Voice, VoiceConfig } from './types';

export function createVoice(
  config: VoiceConfig,
  sampleRate: number,
  opts: { seed?: number; addons?: Addons; recordEvents?: boolean; jitter?: number } = {},
): Voice {
  return config.kind === 'engine'
    ? new EngineKernel(config, sampleRate, opts)
    : new MotorKernel(config, sampleRate, opts);
}

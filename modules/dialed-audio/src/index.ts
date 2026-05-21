import { requireNativeModule } from 'expo-modules-core';

export type AudioSessionConfig = {
  carrierHz: number;
  beatHz: number;
  brownNoiseEnabled?: boolean;
};

type DialedAudioNative = {
  startSession(config: AudioSessionConfig): Promise<void>;
  stopSession(): Promise<void>;
  setCarrierFrequency(hz: number): Promise<void>;
  setBeatFrequency(hz: number): Promise<void>;
  setVolume(level: number): Promise<void>;
  setBrownNoiseEnabled(enabled: boolean): Promise<void>;
};

export default requireNativeModule<DialedAudioNative>('DialedAudio');

import { Platform } from 'react-native';

import DialedAudioModule from '../../modules/dialed-audio/src';

export type AudioSessionConfig = {
  carrierHz: number;
  beatHz: number;
  brownNoiseEnabled?: boolean;
};

export async function startAudioSession(config: AudioSessionConfig): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.warn('[Dialed] Native audio engine is iOS-only; session not started.');
    return;
  }
  await DialedAudioModule.startSession(config);
}

export async function stopAudioSession(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.stopSession();
}

export async function setCarrierFrequency(hz: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setCarrierFrequency(hz);
}

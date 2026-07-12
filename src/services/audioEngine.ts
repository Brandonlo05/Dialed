import { Platform } from 'react-native';

import DialedAudioModule from '../../modules/dialed-audio/src';

export type NoiseColor = 'brown' | 'pink';

export type AudioSessionConfig = {
  carrierHz: number;
  beatHz: number;
  /** Noise layer on/off; color via noiseColor. */
  brownNoiseEnabled?: boolean;
  /** 'brown' (default) or 'pink'. */
  noiseColor?: NoiseColor;
  /** Independent per-channel AM envelopes — depth 0 leaves a channel clean. */
  amLeftHz?: number;
  amLeftDepth?: number;
  amRightHz?: number;
  amRightDepth?: number;
  /** Legacy asymmetric Left-Ear SMR keys (calibration path). */
  asymmetricSMR?: boolean;
  /** SMR envelope rate in Hz (12–15 band from calibration). */
  smrHz?: number;
  /** AM depth 0–1. */
  smrDepth?: number;
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

export async function setBeatFrequency(hz: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setBeatFrequency(hz);
}

/** level: 0.0 – 1.0 */
export async function setVolume(level: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setVolume(Math.max(0, Math.min(1, level)));
}

export async function setBrownNoiseEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setBrownNoiseEnabled(enabled);
}

/**
 * Toggle Asymmetric Left-Ear SMR mode on the live engine.
 * Resolves once the native engine has accepted the parameters — callers can
 * await this to sequence the confirmation haptic.
 */
export async function setAsymmetricSMR(
  enabled: boolean,
  smrHz: number,
  depth: number,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setAsymmetricSMR(
    enabled,
    Math.max(8, Math.min(20, smrHz)),
    Math.max(0, Math.min(1, depth)),
  );
}

/**
 * Set both per-channel AM envelopes live (depth 0 = channel unmodulated).
 * Rates clamp natively to 0–45 Hz (low-gamma ceiling for isochronic/ASSR).
 */
export async function setChannelModulation(
  leftHz: number,
  leftDepth: number,
  rightHz: number,
  rightDepth: number,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setChannelModulation(leftHz, leftDepth, rightHz, rightDepth);
}

/** Switch the noise layer color live. */
export async function setNoiseColor(color: NoiseColor): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setNoiseColor(color);
}

import { Platform } from 'react-native';

import DialedAudioModule, {
  addPhaseAdvanceListener,
  type PhaseAdvanceEvent,
} from '../../modules/dialed-audio/src';

export type { PhaseAdvanceEvent };

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
  /** Pythagorean overtone stack (f/4, f/2, 2f) level, 0–1. 0 = off. */
  overtoneGain?: number;
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

// Last gain written to the engine — lets UI (e.g. the Engine Volume slider)
// initialize from the true current level instead of guessing.
let lastVolume = 0.25;

/** The most recent 0–1 gain sent to the engine. */
export function getLastVolume(): number {
  return lastVolume;
}

/** level: 0.0 – 1.0 */
export async function setVolume(level: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1, level));
  lastVolume = clamped;
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setVolume(clamped);
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

/** Golden Frequency overtone stack level (0–1); 0 disables the path. */
export async function setOvertoneGain(gain: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setOvertoneGain(Math.max(0, Math.min(1, gain)));
}

/**
 * Native block-level frequency glide.
 * `rateHzPerSec > 0` ramps linearly; `tauSeconds > 0` approaches
 * exponentially and wins. Both 0 snaps immediately.
 */
export async function setBeatGlide(
  targetHz: number,
  rateHzPerSec = 0,
  tauSeconds = 0,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setBeatGlide(targetHz, rateHzPerSec, tauSeconds);
}

/** Isochronic pulse layer; level 0 disables the whole path. */
export async function setIsochronic(
  level: number,
  carrierHz = 1000,
  rateHz = 40,
  depth = 1,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setIsochronic(
    Math.max(0, Math.min(1, level)), carrierHz, rateHz, Math.max(0, Math.min(1, depth)),
  );
}

/**
 * Ask the system to duck other apps' audio. iOS chooses the attenuation
 * amount and curve — apps cannot gain-stage another process's stream.
 */
export async function setDuckExternalAudio(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setDuckExternalAudio(enabled);
}

/**
 * Arm headphone transport gestures (AirPods squeeze / XM5 tap).
 *
 * While armed, Dialed owns the system Now Playing slot, so those gestures
 * advance training phases INSTEAD of controlling the user's music app.
 * Always pair with disableRemoteCommands on exit.
 */
export async function enableRemoteCommands(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.enableRemoteCommands();
}

/** Release transport control back to iOS / the user's music app. */
export async function disableRemoteCommands(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.disableRemoteCommands();
}

/** Lock-screen + AVRCP metadata (keeps third-party BT gestures flowing). */
export async function updateNowPlaying(
  title: string,
  subtitle: string,
  elapsed: number,
  duration: number,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.updateNowPlaying(title, subtitle, elapsed, duration);
}

/** 1200 Hz / 100 ms / −12 dBFS confirmation cue synthesized in-render. */
export async function triggerPing(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.triggerPing();
}

/**
 * Lock the master swell to a breath cycle so the audio physically rises on
 * the inhale and recedes on the exhale, guiding respiration rather than
 * merely accompanying it. Pass the four stage durations in seconds.
 * `depth` 0 disables; the native side caps it so it never fades to silence.
 */
export async function setBreathEnvelope(
  cycle: [number, number, number, number],
  depth = 0.35,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await DialedAudioModule.setBreathEnvelope(
    cycle[0], cycle[1], cycle[2], cycle[3], Math.max(0, Math.min(0.8, depth)),
  );
}

/** Subscribe to hardware headphone phase-advance gestures. */
export { addPhaseAdvanceListener };

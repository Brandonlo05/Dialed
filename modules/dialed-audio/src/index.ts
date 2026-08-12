import { EventEmitter, requireNativeModule, type EventSubscription } from 'expo-modules-core';

export type NoiseColor = 'brown' | 'pink';

/** Hardware headphone gesture that requested a phase advance. */
export type PhaseAdvanceEvent = { source: 'nextTrack' | 'togglePlayPause' };

export type AudioSessionConfig = {
  carrierHz: number;
  beatHz: number;
  /** Noise layer on/off (color chosen by noiseColor). */
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
  /** Legacy asymmetric Left-Ear SMR keys — mapped onto left-channel AM natively. */
  asymmetricSMR?: boolean;
  smrHz?: number;
  smrDepth?: number;
};

type DialedAudioNative = {
  startSession(config: AudioSessionConfig): Promise<void>;
  stopSession(): Promise<void>;
  setCarrierFrequency(hz: number): Promise<void>;
  setBeatFrequency(hz: number): Promise<void>;
  setVolume(level: number): Promise<void>;
  setBrownNoiseEnabled(enabled: boolean): Promise<void>;
  setNoiseColor(color: NoiseColor): Promise<void>;
  setOvertoneGain(gain: number): Promise<void>;
  setBeatGlide(targetHz: number, rateHzPerSec: number, tauSeconds: number): Promise<void>;
  setIsochronic(level: number, carrierHz: number, rateHz: number, depth: number): Promise<void>;
  setDuckExternalAudio(enabled: boolean): Promise<void>;
  enableRemoteCommands(): Promise<void>;
  disableRemoteCommands(): Promise<void>;
  updateNowPlaying(
    title: string,
    subtitle: string,
    elapsed: number,
    duration: number,
  ): Promise<void>;
  triggerPing(): Promise<void>;
  setChannelModulation(
    leftHz: number,
    leftDepth: number,
    rightHz: number,
    rightDepth: number,
  ): Promise<void>;
  setAsymmetricSMR(enabled: boolean, smrHz: number, depth: number): Promise<void>;
};

const NativeModule = requireNativeModule<DialedAudioNative>('DialedAudio');

type AudioEventsMap = {
  onPhaseAdvanceRequest: (event: PhaseAdvanceEvent) => void;
};

const emitter = new EventEmitter<AudioEventsMap>(NativeModule as never);

/** Subscribe to hardware headphone phase-advance gestures. */
export function addPhaseAdvanceListener(
  listener: (event: PhaseAdvanceEvent) => void,
): EventSubscription {
  return emitter.addListener('onPhaseAdvanceRequest', listener);
}

export default NativeModule;

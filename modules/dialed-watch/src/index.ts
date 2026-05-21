import { EventEmitter, type EventSubscription, requireNativeModule } from 'expo-modules-core';

export type BiometricPacket = {
  /** Instantaneous heart rate in BPM. */
  bpm: number;
  /** Inter-beat interval estimates in milliseconds (derived from BPM). */
  rrIntervals: number[];
  /** Unix timestamp (seconds) from the watch at flush time. */
  timestamp: number;
};

type DialedWatchNative = {
  activateSession(): Promise<void>;
  isWatchReachable(): boolean;
};

let NativeModule: DialedWatchNative;
try {
  NativeModule = requireNativeModule<DialedWatchNative>('DialedWatch');
} catch {
  // Non-iOS or pre-prebuild environment: return safe no-op stubs
  NativeModule = {
    activateSession: async () => {},
    isWatchReachable: () => false,
  };
}

type WatchEventsMap = {
  onBiometricData: (packet: BiometricPacket) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitter = new EventEmitter<WatchEventsMap>(NativeModule as any);

export async function activateWatchSession(): Promise<void> {
  return NativeModule.activateSession();
}

export function isWatchReachable(): boolean {
  return NativeModule.isWatchReachable();
}

/** Subscribe to live biometric packets streamed from the watch. */
export function addBiometricListener(
  listener: (packet: BiometricPacket) => void,
): EventSubscription {
  return emitter.addListener('onBiometricData', listener);
}

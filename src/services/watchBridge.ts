import type { EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

import { pushBiometric } from './adaptiveAudio';

import {
  activateWatchSession,
  addBiometricListener,
  isWatchReachable,
  type BiometricPacket,
} from '../../modules/dialed-watch/src';

// ─── Ring Buffer ──────────────────────────────────────────────────────────────

const RING_SIZE = 256;

/**
 * Fixed-capacity circular buffer for RR-interval samples (ms).
 *
 * Designed for lossy Bluetooth delivery: dropped WCSession packets leave gaps
 * in the timeline but never cause array reallocation or index errors.
 * Oldest samples are silently overwritten once the buffer is full.
 */
export class RRIntervalRingBuffer {
  private readonly buffer: number[] = new Array(RING_SIZE).fill(0);
  private head = 0;
  private count = 0;

  push(intervalMs: number): void {
    this.buffer[this.head] = intervalMs;
    this.head = (this.head + 1) % RING_SIZE;
    if (this.count < RING_SIZE) this.count += 1;
  }

  pushBatch(intervals: number[]): void {
    for (const iv of intervals) this.push(iv);
  }

  /**
   * Return the `n` most-recent samples in chronological order.
   * Never throws — clamps `n` to the number of valid samples.
   */
  latest(n = 32): number[] {
    const len = Math.min(n, this.count);
    const out: number[] = [];
    let idx = (this.head - 1 + RING_SIZE) % RING_SIZE;
    for (let i = 0; i < len; i++) {
      out.unshift(this.buffer[idx]);
      idx = (idx - 1 + RING_SIZE) % RING_SIZE;
    }
    return out;
  }

  /**
   * Average BPM calculated from the most recent 64 RR samples.
   * Returns `null` when no valid data has arrived yet.
   */
  averageBpm(): number | null {
    const samples = this.latest(64).filter((v) => v > 300 && v < 1800);
    if (samples.length === 0) return null;
    const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
    return Math.round(60_000 / avgMs);
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(0);
    this.head = 0;
    this.count = 0;
  }
}

// Singleton buffer shared across the app — import `rrBuffer` wherever needed
export const rrBuffer = new RRIntervalRingBuffer();

// ─── Event broadcasting ───────────────────────────────────────────────────────

type BiometricListener = (bpm: number, rrIntervals: number[]) => void;

const listeners = new Set<BiometricListener>();
let nativeSubscription: EventSubscription | null = null;
let lastBpm = 0;

function handlePacket(packet: BiometricPacket): void {
  lastBpm = packet.bpm;

  if (packet.rrIntervals.length > 0) {
    // Filter physiologically implausible values before pushing into the buffer
    const valid = packet.rrIntervals.filter((ms) => ms > 300 && ms < 1800);
    rrBuffer.pushBatch(valid);
  }

  for (const fn of listeners) fn(packet.bpm, packet.rrIntervals);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Activate WCSession and begin piping packets into the ring buffer.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function startWatchBridge(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (nativeSubscription) return;
  await activateWatchSession();
  nativeSubscription = addBiometricListener(handlePacket);
}

/** Detach the native listener and stop filling the ring buffer. */
export function stopWatchBridge(): void {
  nativeSubscription?.remove();
  nativeSubscription = null;
}

/**
 * Subscribe to every arriving biometric packet.
 * Returns an unsubscribe function — call it in a cleanup effect.
 */
/**
 * Route incoming watch packets straight into the adaptive audio layer.
 * Call once alongside startWatchBridge(); returns an unsubscribe.
 *
 * RMSSD is computed from the RR-interval ring buffer rather than trusting a
 * single packet — successive-difference measures are meaningless on one
 * sample and very noisy on few.
 */
export function connectWatchToAdaptiveAudio(): () => void {
  return addBiometricDataListener((bpm) => {
    const rr = rrBuffer.latest(64);
    if (rr.length < 8) return; // not enough intervals for a stable RMSSD
    let sumSq = 0;
    for (let i = 1; i < rr.length; i++) {
      const d = rr[i] - rr[i - 1];
      sumSq += d * d;
    }
    const rmssd = Math.sqrt(sumSq / (rr.length - 1));
    pushBiometric({ bpm, rmssd, source: 'watch' });
  });
}

export function addBiometricDataListener(listener: BiometricListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Last BPM received from the watch. Returns 0 if no packet has arrived. */
export function getLastBpm(): number {
  return lastBpm;
}

export { isWatchReachable };
export type { BiometricPacket };

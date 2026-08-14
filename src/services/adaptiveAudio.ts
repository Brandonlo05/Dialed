/**
 * Adaptive audio — biometrics → engine parameters.
 *
 * Sits between any biometric source and the lock-free parameter path in the
 * native engine. Sources are interchangeable:
 *   • Apple Watch (WatchConnectivity → watchBridge) — once a watchOS target
 *     exists; the receive pipeline is already built and waiting.
 *   • Neuro-Lab simulator sliders — available today, which is what keeps this
 *     module exercised rather than dead code.
 *
 * DESIGN NOTES
 * - Every write goes through audioEngine, which crosses the seqlock. The
 *   render thread never blocks and never sees a torn value.
 * - Updates are rate-limited and slew-limited. Raw HRV is noisy; piping it
 *   straight to a frequency would produce audible warble. We move at most
 *   ADAPT_STEP_HZ per update toward the target.
 * - Adaptation is bounded. It nudges within a band around the program's
 *   baseline — it can never run away from the protocol the user chose.
 */

import { setBeatFrequency, setBreathEnvelope } from './audioEngine';

// ── Types ────────────────────────────────────────────────────────────────────

export type BiometricSample = {
  /** Beats per minute. */
  bpm: number;
  /** RMSSD in ms — higher = more parasympathetic / recovered. */
  rmssd: number;
  /** 0–100 movement/restlessness index, if the source provides one. */
  restlessness?: number;
  /** Where this came from — surfaced in diagnostics. */
  source: 'watch' | 'simulator';
};

export type AdaptiveConfig = {
  /** Program's nominal entrainment rate — adaptation centres on this. */
  baselineHz: number;
  /** Program's breath cycle — adaptation scales its depth, not its shape. */
  breathCycle: [number, number, number, number];
  /** Maximum deviation from baseline, in Hz. Keeps the protocol recognisable. */
  maxDeviationHz?: number;
};

// ── Tunables ─────────────────────────────────────────────────────────────────

const MIN_UPDATE_MS = 1500;   // never retune faster than this
const ADAPT_STEP_HZ = 0.25;   // max change per update — prevents warble
const DEFAULT_MAX_DEV = 3;    // Hz either side of baseline

// RMSSD interpretation band. Below LOW reads as stressed/under-recovered,
// above HIGH as settled. Deliberately wide — individual baselines vary hugely,
// so this is a coarse nudge, never a diagnosis.
const RMSSD_LOW = 25;
const RMSSD_HIGH = 90;

// ── State ────────────────────────────────────────────────────────────────────

let config: AdaptiveConfig | null = null;
let currentHz = 0;
let lastUpdate = 0;
let lastSample: BiometricSample | null = null;

/** Begin adapting around a program's baseline. */
export function startAdaptive(cfg: AdaptiveConfig): void {
  config = cfg;
  currentHz = cfg.baselineHz;
  lastUpdate = 0;
  lastSample = null;
}

/** Stop adapting and hand the engine back to the program's fixed values. */
export function stopAdaptive(): void {
  if (config) {
    void setBeatFrequency(config.baselineHz);
    void setBreathEnvelope(config.breathCycle);
  }
  config = null;
  lastSample = null;
}

export function isAdaptive(): boolean {
  return config !== null;
}

export function lastBiometric(): BiometricSample | null {
  return lastSample;
}

/**
 * Normalised arousal, 0 (settled) → 1 (activated).
 * Exported so the UI can show the same number the audio is acting on rather
 * than recomputing it and drifting out of step.
 */
export function arousalFrom(sample: BiometricSample): number {
  const hrvNorm = clamp01((sample.rmssd - RMSSD_LOW) / (RMSSD_HIGH - RMSSD_LOW));
  const settled = hrvNorm; // high RMSSD = settled
  const move = clamp01((sample.restlessness ?? 0) / 100);
  // Weighted: HRV dominates, movement modifies
  return clamp01(0.75 * (1 - settled) + 0.25 * move);
}

/**
 * Feed a sample. Safe to call at any rate — internally rate-limited.
 * Returns the frequency actually applied, or null if nothing changed.
 */
export function pushBiometric(sample: BiometricSample): number | null {
  lastSample = sample;
  if (!config) return null;

  const now = Date.now();
  if (now - lastUpdate < MIN_UPDATE_MS) return null;
  lastUpdate = now;

  const arousal = arousalFrom(sample);
  const maxDev = config.maxDeviationHz ?? DEFAULT_MAX_DEV;

  // arousal 0 → baseline + maxDev (settled, room to run a touch faster)
  // arousal 1 → baseline − maxDev (activated, pull toward slower/settling)
  const target = clamp(
    config.baselineHz - maxDev * (2 * arousal - 1),
    Math.max(0.5, config.baselineHz - maxDev),
    config.baselineHz + maxDev,
  );

  // Slew-limit toward the target so retuning is never audible as a jump
  const delta = target - currentHz;
  currentHz += Math.sign(delta) * Math.min(Math.abs(delta), ADAPT_STEP_HZ);

  void setBeatFrequency(currentHz);

  // Deeper breath swell when arousal is high — the guidance gets more
  // insistent exactly when the user needs pacing most.
  const depth = 0.28 + 0.24 * arousal;
  void setBreathEnvelope(config.breathCycle, depth);

  return currentHz;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

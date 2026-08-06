/**
 * Clinical Neuro-Presets — three specialized entrainment programs wired to
 * the native per-channel modulation engine.
 *
 * 1. BURNOUT MODE — 600 s deceleration sweep. A 1 s clock linearly
 *    interpolates the binaural beat 18→10 Hz (0–180 s), 10→5 Hz (180–480 s),
 *    5→2 Hz (480–600 s), piping each fresh value to the native engine.
 * 2. SCREEN FOG CLEANSER — fixed 400 Hz carrier, bilateral coherent 40 Hz
 *    isochronic AM (gamma ASSR) over an unmasked pink-noise envelope.
 * 3. PRE-EXAM RESET — left ear locked to a 13 Hz SMR envelope, right ear
 *    locked to a 10 Hz alpha envelope; carriers stay matched so the two
 *    bands remain the only interaural difference. (Configured atomically at
 *    session start through the same native path setAsymmetricSMR wraps —
 *    start-config avoids a start/set race on the render thread.)
 *
 * The module owns exactly one interval (Burnout's clock). stopNeuroPreset()
 * is idempotent and always clears it — no orphaned timers.
 */

import {
  setBeatFrequency,
  setVolume,
  startAudioSession,
} from './audioEngine';
import { rigidLock } from './haptics';

// ── Types ────────────────────────────────────────────────────────────────────

export type NeuroPresetId = 'burnout' | 'screen-fog' | 'pre-exam' | 'golden-432';

export type NeuroPreset = {
  id: NeuroPresetId;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  badge: string;
  /** Modulation rate the FocusRing pulse should track. */
  displayHz: number;
  /** Fixed duration in seconds, or null for open-ended presets. */
  durationSec: number | null;
};

export const NEURO_PRESETS: NeuroPreset[] = [
  {
    id: 'burnout',
    title: 'Burnout Mode',
    subtitle: 'Deceleration sweep · 18 → 2 Hz over 10 min',
    icon: '↓',
    accent: '#fb923c',
    badge: '10:00',
    displayHz: 10,
    durationSec: 600,
  },
  {
    id: 'screen-fog',
    title: 'Screen Fog Cleanser',
    subtitle: 'Gamma ASSR · bilateral 40 Hz isochronic · pink noise',
    icon: '◈',
    accent: '#22d3ee',
    badge: '40 Hz',
    displayHz: 40,
    durationSec: null,
  },
  {
    id: 'pre-exam',
    title: 'Pre-Exam Reset',
    subtitle: 'Asymmetric bypass · L 13 Hz SMR · R 10 Hz alpha',
    icon: '⟠',
    accent: '#4ade80',
    badge: 'SMR+α',
    displayHz: 13,
    durationSec: null,
  },
  {
    id: 'golden-432',
    title: 'The Golden Frequency',
    subtitle: 'True 432.0 Hz fundamental · Pythagorean overtone stack (108 / 216 / 864 Hz)',
    icon: '✦',
    accent: '#FFD700',
    badge: '432 Hz',
    displayHz: 432,
    durationSec: null,
  },
];

// ── Burnout sweep math (pure — exported for testability) ────────────────────

export type BurnoutPhase = 1 | 2 | 3;

export type BurnoutTick = {
  elapsedSec: number;
  remainingSec: number;
  phase: BurnoutPhase;
  phaseLabel: string;
  beatHz: number;
};

export const BURNOUT_DURATION_SEC = 600;

const BURNOUT_PHASE_LABELS: Record<BurnoutPhase, string> = {
  1: 'Phase 1: Capturing Stress',
  2: 'Phase 2: Alpha Crossover',
  3: 'Phase 3: Delta Stabilization',
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Piecewise-linear beat frequency at second t of the Burnout sweep. */
export function burnoutBeatAt(t: number): { beatHz: number; phase: BurnoutPhase } {
  if (t < 180) return { beatHz: lerp(18, 10, t / 180), phase: 1 };
  if (t < 480) return { beatHz: lerp(10, 5, (t - 180) / 300), phase: 2 };
  const clamped = Math.min(t, BURNOUT_DURATION_SEC);
  return { beatHz: lerp(5, 2, (clamped - 480) / 120), phase: 3 };
}

export function burnoutPhaseLabel(phase: BurnoutPhase): string {
  return BURNOUT_PHASE_LABELS[phase];
}

// ── Preset runner ────────────────────────────────────────────────────────────

export type PresetCallbacks = {
  /** Burnout only — fired every second with the fresh sweep state. */
  onBurnoutTick?: (tick: BurnoutTick) => void;
  /** Burnout only — fired once when the 600 s program completes. */
  onComplete?: () => void;
};

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start a preset. Idempotent — always tears down any previous sweep clock
 * first. Audio session teardown remains the caller's responsibility (the
 * dashboard owns start/stop symmetry and XP accounting).
 */
export async function startNeuroPreset(
  id: NeuroPresetId,
  callbacks?: PresetCallbacks,
): Promise<void> {
  stopNeuroPreset();

  switch (id) {
    case 'burnout': {
      await startAudioSession({
        carrierHz: 200,
        beatHz: 18, // sweep entry point — the clock takes over from here
        brownNoiseEnabled: true,
        noiseColor: 'brown',
      });
      void setVolume(0.3);

      const startedAt = Date.now();
      sweepTimer = setInterval(() => {
        const t = Math.floor((Date.now() - startedAt) / 1000);

        if (t >= BURNOUT_DURATION_SEC) {
          stopNeuroPreset();
          callbacks?.onComplete?.();
          return;
        }

        const { beatHz, phase } = burnoutBeatAt(t);
        // Pipe the freshly computed target straight down to Swift every second
        void setBeatFrequency(beatHz);
        callbacks?.onBurnoutTick?.({
          elapsedSec: t,
          remainingSec: BURNOUT_DURATION_SEC - t,
          phase,
          phaseLabel: burnoutPhaseLabel(phase),
          beatHz,
        });
      }, 1000);
      break;
    }

    case 'screen-fog': {
      // Fixed 400 Hz carrier; hard-coded coherent 40 Hz isochronic AM on BOTH
      // channels; unmasked pink-noise envelope underneath.
      await startAudioSession({
        carrierHz: 400,
        beatHz: 0,
        brownNoiseEnabled: true,
        noiseColor: 'pink',
        amLeftHz: 40,
        amLeftDepth: 0.9,
        amRightHz: 40,
        amRightDepth: 0.9,
      });
      void setVolume(0.35);
      break;
    }

    case 'pre-exam': {
      // Hard-locked asymmetric bands: L = 13 Hz SMR, R = 10 Hz alpha.
      // Right depth is gentler — the alpha side anchors, the SMR side drives.
      await startAudioSession({
        carrierHz: 200,
        beatHz: 0,
        brownNoiseEnabled: false,
        amLeftHz: 13,
        amLeftDepth: 0.85,
        amRightHz: 10,
        amRightDepth: 0.6,
      });
      void setVolume(0.25);
      break;
    }

    case 'golden-432': {
      // Mathematically true 432.0 Hz fundamental: identical phase-accumulated
      // carriers in both ears (beatHz 0 — any offset would break exactness),
      // no noise floor, plus the native Pythagorean overtone stack which the
      // engine derives from the carrier: 216 Hz (f/2), 108 Hz (f/4),
      // 864 Hz (2f). −31.7666 cents below A440 concert pitch by definition.
      await startAudioSession({
        carrierHz: 432.0,
        beatHz: 0,
        brownNoiseEnabled: false,
        overtoneGain: 0.35,
      });
      void setVolume(0.28);
      rigidLock(); // firm mechanical confirmation on frequency lock
      break;
    }
  }
}

/** Clear the sweep clock. Idempotent; safe to call from any teardown path. */
export function stopNeuroPreset(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

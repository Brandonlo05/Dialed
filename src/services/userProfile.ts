/**
 * Onboarding calibration profile — persisted answers to the three
 * onboarding questions, plus the logic that translates them into
 * concrete audio-engine parameters (carrier Hz, beat Hz, volume,
 * brown-noise layer).
 *
 * Maps onto the native engine params: `carrierHz`, `beatHz`, `volume`,
 * `brownNoise`, plus the Asymmetric Left-Ear SMR trio (`asymmetricSMR`,
 * `smrHz`, `smrDepth`) — ADHD/Hyper-Active profiles lock the engine into
 * left-ear SMR amplitude modulation with a clean right-channel carrier.
 *
 * Honest limitation (deferred): "cinematic drones / isochronic pacing
 * layers" don't exist as assets yet; environment maps to master volume
 * depth + brown-noise floor.
 */

import type { Bottleneck, DiagnosticAnswers } from '../constants/diagnostic';
import type { FocusMode, FocusModeId } from '../constants/modes';
import type { ProgramId } from '../constants/presetUx';
import { loadJson, saveJson } from './storage';

// ── Types ────────────────────────────────────────────────────────────────────

export type CognitiveProfile = 'neurotypical' | 'adhd' | 'anxiety' | 'fatigue';
export type Environment = 'silent' | 'coffee-shop' | 'office-hum' | 'creative-chaos';
export type SessionGoal = 'linear-execution' | 'rapid-tasks' | 'creative-ideation' | 'wind-down';
/** Audio texture bias from the Cognitive OS diagnostic question. */
export type SensoryScaffolding = 'high-valence-cyberpunk' | 'minimalist-ambient';

export type UserProfile = {
  cognitive: CognitiveProfile;
  environment: Environment;
  goal: SessionGoal;
  /** Neurodivergent → high-valence scaffolding; absent (legacy) → minimalist. */
  sensoryScaffolding?: SensoryScaffolding;
  /** Raw answers from the Neural Diagnostic onboarding (absent on legacy profiles). */
  diagnostic?: DiagnosticAnswers;
  /** ISO timestamp of when calibration was completed. */
  calibratedAt: string;
};

export type AudioCalibration = {
  carrierHz: number;
  beatHz: number;
  /** 0–1 master amplitude, from environmental chaos depth. */
  volume: number;
  brownNoise: boolean;
  /** Asymmetric Left-Ear SMR mode — engaged for ADHD/Hyper-Active profiles. */
  asymmetricSMR: boolean;
  /** SMR AM envelope rate (12–15 Hz band). */
  smrHz: number;
  /** AM depth 0–1. */
  smrDepth: number;
};

// ── Persistence (with sync cache for the audio start path) ──────────────────

const KEY = '@dialed/profile';

let cached: UserProfile | null = null;

export async function loadUserProfile(): Promise<UserProfile | null> {
  cached = await loadJson<UserProfile>(KEY);
  return cached;
}

/** Synchronous read — valid after loadUserProfile() has run (tabs gate). */
export function getCachedProfile(): UserProfile | null {
  return cached;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  cached = profile;
  await saveJson(KEY, profile);
}

// ── Calibration logic ────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Environmental chaos → master volume depth + noise floor. */
const ENV_VOLUME: Record<Environment, { volume: number; forceBrown: boolean }> = {
  silent:           { volume: 0.18, forceBrown: false },
  'coffee-shop':    { volume: 0.30, forceBrown: false },
  'office-hum':     { volume: 0.40, forceBrown: true },
  'creative-chaos': { volume: 0.50, forceBrown: true },
};

/**
 * Derive the final engine parameters for a mode, adjusted by the user's
 * calibration profile. Null profile → the mode's stock parameters.
 */
export function calibrate(mode: FocusMode, profile: UserProfile | null): AudioCalibration {
  let carrierHz = mode.carrierHz;
  let beatHz = mode.beatHz;
  let volume = 0.25;
  let brownNoise = mode.id === 'standard-focus';
  let asymmetricSMR = false;
  let smrHz = 13.5;
  const smrDepth = 0.85;

  if (!profile) {
    return { carrierHz, beatHz, volume, brownNoise, asymmetricSMR, smrHz, smrDepth };
  }

  // 1) Cognitive profile
  switch (profile.cognitive) {
    case 'adhd':
      // Asymmetric Left-Ear SMR lock: the left channel is amplitude-modulated
      // at the mode's rate clamped into the 12–15 Hz SMR band; the right
      // channel renders a clean carrier (beatHz is bypassed natively).
      beatHz = clamp(beatHz, 12, 15);
      asymmetricSMR = true;
      smrHz = beatHz;
      break;
    case 'anxiety':
      // Soft carrier ceiling + calming theta-leaning modulation.
      carrierHz = Math.min(carrierHz, 300);
      beatHz = Math.min(beatHz, 7);
      break;
    case 'fatigue':
      // Gentle alerting lift — keep beat in the 10–14 Hz low-beta band.
      beatHz = clamp(beatHz, 10, 14);
      break;
    case 'neurotypical':
      break;
  }

  // 2) Environmental chaos
  const env = ENV_VOLUME[profile.environment];
  volume = env.volume;
  brownNoise = brownNoise || env.forceBrown;

  // 2b) Sensory scaffolding — neurodivergent profiles get a constant
  // low-level noise floor as a non-distracting interest anchor; the
  // minimalist profile leaves each mode's default texture untouched.
  if (profile.sensoryScaffolding === 'high-valence-cyberpunk') {
    brownNoise = true;
  }

  // 3) Session goal
  if (profile.goal === 'wind-down') {
    // Nervous-system downshift — theta ceiling, softer floor.
    beatHz = Math.min(beatHz, 6);
    volume = Math.min(volume, 0.3);
  }

  return { carrierHz, beatHz, volume, brownNoise, asymmetricSMR, smrHz, smrDepth };
}

// ── Neural Diagnostic → calibration derivation ──────────────────────────────

/**
 * Map the 4-question diagnostic onto the calibration fields the audio
 * engine's calibrate() consumes. Deterministic, documented heuristics:
 * - cognitive: bottleneck is primary signal, stress response breaks ties
 * - environment: inferred from arena (adjustable via Recalibrate later)
 * - goal: follows the bottleneck's remedy direction
 */
export function deriveCalibrationFromDiagnostic(
  d: DiagnosticAnswers,
): Pick<UserProfile, 'cognitive' | 'environment' | 'goal' | 'sensoryScaffolding'> {
  let cognitive: CognitiveProfile;
  switch (d.bottleneck) {
    case 'anxiety':
      cognitive = 'anxiety';
      break;
    case 'burnout':
      cognitive = 'fatigue';
      break;
    case 'sluggish':
      // Restless-body procrastination (or a neurodivergent OS) → SMR path
      cognitive =
        d.operatingProfile === 'neurodivergent' || d.stressSignature === 'somatic'
          ? 'adhd'
          : 'fatigue';
      break;
    case 'fog':
      cognitive = d.stressSignature === 'somatic' ? 'fatigue' : 'neurotypical';
      break;
  }

  const environment: Environment =
    d.coreArena === 'student' ? 'coffee-shop'
    : d.coreArena === 'athlete' ? 'creative-chaos'
    : 'office-hum';

  const goal: SessionGoal =
    d.bottleneck === 'sluggish' ? 'rapid-tasks'
    : d.bottleneck === 'fog' ? 'linear-execution'
    : d.bottleneck === 'anxiety' ? 'creative-ideation'
    : 'wind-down';

  const sensoryScaffolding: SensoryScaffolding =
    d.operatingProfile === 'neurodivergent' ? 'high-valence-cyberpunk' : 'minimalist-ambient';

  return { cognitive, environment, goal, sensoryScaffolding };
}

/** Classification router — the ideal program for the user's bottleneck. */
export function recommendedProgramId(bottleneck: Bottleneck): ProgramId {
  switch (bottleneck) {
    case 'anxiety':  return 'pre-exam';
    case 'fog':      return 'screen-fog';
    case 'sluggish': return 'caffeine-rush';
    case 'burnout':  return 'burnout';
  }
}

// One-shot recommendation handoff: onboarding sets it, the dashboard
// consumes it once on mount and pops the program's Command Sheet.
let pendingRecommendation: ProgramId | null = null;

export function setPendingRecommendation(id: ProgramId): void {
  pendingRecommendation = id;
}

export function consumePendingRecommendation(): ProgramId | null {
  const id = pendingRecommendation;
  pendingRecommendation = null;
  return id;
}

/** Which mode card gets the "calibrated for you" badge on the dashboard. */
export function recommendedModeId(goal: SessionGoal): FocusModeId {
  switch (goal) {
    case 'linear-execution':   return 'standard-focus';
    case 'rapid-tasks':        return 'caffeine-rush';
    case 'creative-ideation':  return 'clutch-mode';
    case 'wind-down':          return 'clutch-mode';
  }
}

// ── Display labels (Settings summary card) ──────────────────────────────────

export const COGNITIVE_LABELS: Record<CognitiveProfile, string> = {
  neurotypical: 'Steady Baseline',
  adhd:         'Hyper-Active · L-ear SMR 12–15 Hz',
  anxiety:      'Anxiety-Aware · ≤300 Hz carriers',
  fatigue:      'Fatigue Lift · 10–14 Hz',
};

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  silent:           'Dead Silent',
  'coffee-shop':    'Coffee Shop Chatter',
  'office-hum':     'Office / Traffic Hum',
  'creative-chaos': 'Creative Chaos',
};

export const GOAL_LABELS: Record<SessionGoal, string> = {
  'linear-execution':  'Linear Coding / Writing',
  'rapid-tasks':       'Rapid Task Execution',
  'creative-ideation': 'Deep Creative Ideation',
  'wind-down':         'Nervous System Wind Down',
};

export const SCAFFOLDING_LABELS: Record<SensoryScaffolding, string> = {
  'high-valence-cyberpunk': 'High-Valence Cyberpunk',
  'minimalist-ambient':     'Minimalist Ambient',
};

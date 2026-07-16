/**
 * The Daily Cognitive Rep — 10-day gamified neuro-conditioning cycle.
 *
 * Each calendar day maps to one 8-minute high-impact session drawn from the
 * existing entrainment programs:
 *   Days 1, 4, 7, 10 → Clutch Mode      (7 Hz theta-alpha crossover)
 *   Days 2, 5, 8     → Deep Lockdown    (40 Hz gamma)
 *   Days 3, 6, 9     → Pre-Exam Reset   (L 13 Hz SMR / R 10 Hz alpha)
 *
 * Streak rules (all local-timezone calendar days):
 * - Completing today's rep: streak +1 if yesterday was also completed,
 *   otherwise streak restarts at 1. One completion per day (idempotent).
 * - Missing a day: streak resets to 0 on next load; cycle-day progress is
 *   retained (missing a day costs the streak, not the program position).
 * - Completing day 10 wraps the cycle back to day 1.
 *
 * Persisted via AsyncStorage — the RN equivalent of localStorage.
 */

import { FOCUS_MODES } from '../constants/modes';
import type { ProgramId } from '../constants/presetUx';
import { PRESET_UX_DATA } from '../constants/presetUx';
import { setVolume, startAudioSession, stopAudioSession } from './audioEngine';
import { NEURO_PRESETS, startNeuroPreset, stopNeuroPreset } from './audioPresets';
import { localDay } from './gamification';
import { loadJson, saveJson } from './storage';
import { calibrate, getCachedProfile } from './userProfile';

// ── Constants ────────────────────────────────────────────────────────────────

export const REP_DURATION_SEC = 8 * 60;
export const REP_CYCLE_DAYS = 10;

const KEY = '@dialed/daily-rep';

// ── Types ────────────────────────────────────────────────────────────────────

export type DailyRepState = {
  /** 1–10: today's target position in the conditioning cycle. */
  currentDay: number;
  /** Consecutive days completed. */
  streakCount: number;
  /** Local calendar day (YYYY-MM-DD) of the last completed rep. */
  lastCompletedDay: string | null;
};

export type DailyRepStatus = DailyRepState & {
  completedToday: boolean;
  program: RepProgram;
};

export type RepProgram = {
  id: ProgramId;
  title: string;
  hz: number;
  accent: string;
};

const FRESH: DailyRepState = {
  currentDay: 1,
  streakCount: 0,
  lastCompletedDay: null,
};

// ── Protocol mapping ─────────────────────────────────────────────────────────

/** Days 1,4,7,10 → clutch-mode · 2,5,8 → deep-lockdown · 3,6,9 → pre-exam. */
export function repProgramIdForDay(day: number): ProgramId {
  const slot = (day - 1) % 3;
  if (slot === 0) return 'clutch-mode';
  if (slot === 1) return 'deep-lockdown';
  return 'pre-exam';
}

export function repProgramForDay(day: number): RepProgram {
  const id = repProgramIdForDay(day);
  const ux = PRESET_UX_DATA[id];
  const preset = NEURO_PRESETS.find((p) => p.id === id);
  const mode = FOCUS_MODES.find((m) => m.id === id);
  return {
    id,
    title: preset?.title ?? mode?.title ?? id,
    hz: ux.targetHz,
    accent: ux.glow,
  };
}

// ── State machine ────────────────────────────────────────────────────────────

function yesterdayStr(): string {
  return localDay(new Date(Date.now() - 86_400_000));
}

/**
 * Load current status. If the user missed a day (last completion is neither
 * today nor yesterday) the streak is reset to 0 and persisted.
 */
export async function loadDailyRep(): Promise<DailyRepStatus> {
  const state = (await loadJson<DailyRepState>(KEY)) ?? { ...FRESH };
  const today = localDay();

  if (
    state.streakCount > 0 &&
    state.lastCompletedDay !== null &&
    state.lastCompletedDay !== today &&
    state.lastCompletedDay !== yesterdayStr()
  ) {
    state.streakCount = 0;
    await saveJson(KEY, state);
  }

  const completedToday = state.lastCompletedDay === today;
  // While completedToday, currentDay already points at tomorrow's target —
  // report the day the user actually locked in for display purposes.
  const displayDay = completedToday
    ? state.currentDay === 1 ? REP_CYCLE_DAYS : state.currentDay - 1
    : state.currentDay;

  return {
    ...state,
    currentDay: displayDay,
    completedToday,
    program: repProgramForDay(displayDay),
  };
}

/**
 * Record today's completed rep: bump streak, advance the cycle (10 wraps
 * to 1), persist. Idempotent — a second call on the same day is a no-op.
 */
export async function completeDailyRep(): Promise<DailyRepStatus> {
  const state = (await loadJson<DailyRepState>(KEY)) ?? { ...FRESH };
  const today = localDay();

  if (state.lastCompletedDay !== today) {
    state.streakCount = state.lastCompletedDay === yesterdayStr() ? state.streakCount + 1 : 1;
    state.lastCompletedDay = today;
    state.currentDay = state.currentDay >= REP_CYCLE_DAYS ? 1 : state.currentDay + 1;
    await saveJson(KEY, state);
  }

  const displayDay = state.currentDay === 1 ? REP_CYCLE_DAYS : state.currentDay - 1;
  return {
    ...state,
    currentDay: displayDay,
    completedToday: true,
    program: repProgramForDay(displayDay),
  };
}

// ── Audio control (delegates to the existing engine paths) ──────────────────

/** Start the audio for a given rep program (mode or clinical preset). */
export async function startRepAudio(program: RepProgram): Promise<void> {
  if (NEURO_PRESETS.some((p) => p.id === program.id)) {
    await startNeuroPreset(program.id as (typeof NEURO_PRESETS)[number]['id']);
    return;
  }
  const mode = FOCUS_MODES.find((m) => m.id === program.id);
  if (!mode) return;
  const cal = calibrate(mode, getCachedProfile());
  await startAudioSession({
    carrierHz: cal.carrierHz,
    beatHz: cal.beatHz,
    brownNoiseEnabled: cal.brownNoise,
    asymmetricSMR: cal.asymmetricSMR,
    smrHz: cal.smrHz,
    smrDepth: cal.smrDepth,
  });
  void setVolume(cal.volume);
}

/** Stop any rep audio (idempotent — safe on every teardown path). */
export async function stopRepAudio(): Promise<void> {
  stopNeuroPreset();
  await stopAudioSession();
}

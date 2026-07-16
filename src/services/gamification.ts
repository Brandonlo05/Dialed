/**
 * High-velocity dopamine loop — Focus XP, cognitive levels, day streaks,
 * and sound-vault unlocks. Pure JS state machine persisted to AsyncStorage;
 * the audio engine is never touched from here.
 *
 * Honest note: unlockable pads are registered by name only — the custom
 * synthesized pad assets don't exist yet, so unlocks are recorded and
 * displayed but not yet audible. "Somatic Stillness" is a deterministic
 * estimate derived from session shape (no live biometric source until the
 * watch pipeline ships) and is labeled as an estimate in the UI.
 */

import { loadJson, saveJson } from './storage';
import type { SessionGoal } from './userProfile';

// ── Tunables ─────────────────────────────────────────────────────────────────

export const XP_PER_MINUTE = 10;

/** Cumulative XP required to *reach* a level. Level 1 = 0 XP. */
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(250 * Math.pow(level - 1, 1.45));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) level += 1;
  return level;
}

/** 0–1 progress from the current level toward the next. */
export function progressToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  const base = xpToReachLevel(level);
  const next = xpToReachLevel(level + 1);
  return Math.min(1, (xp - base) / (next - base));
}

// ── Sound vault (names registered now; assets ship later) ───────────────────

export type PadUnlock = { level: number; name: string; flavor: string };

export const PAD_UNLOCKS: PadUnlock[] = [
  { level: 2,  name: 'Deep Space Pad',      flavor: 'Sub-zero drift · 62 Hz root' },
  { level: 3,  name: 'Tokyo Rain Synth',    flavor: 'Wet neon shimmer · gentle motion' },
  { level: 4,  name: 'Analog Monsoon',      flavor: 'Warm tape noise · slow swell' },
  { level: 6,  name: 'Neon Monolith Drone', flavor: 'Massive still air · obsidian' },
  { level: 8,  name: 'Kyoto Night Air',     flavor: 'Distant temple hum · 3 am' },
  { level: 10, name: 'Andromeda Bloom',     flavor: 'Granular star field · weightless' },
];

export function unlockedPads(level: number): PadUnlock[] {
  return PAD_UNLOCKS.filter((p) => p.level <= level);
}

export function nextUnlock(level: number): PadUnlock | null {
  return PAD_UNLOCKS.find((p) => p.level > level) ?? null;
}

// ── Persistent state ─────────────────────────────────────────────────────────

export type GamificationState = {
  totalXp: number;
  sessionsCompleted: number;
  totalMinutes: number;
  streakDays: number;
  /** Local date string (YYYY-MM-DD) of the last counted session. */
  lastSessionDay: string | null;
};

const KEY = '@dialed/gamification';

const FRESH: GamificationState = {
  totalXp: 0,
  sessionsCompleted: 0,
  totalMinutes: 0,
  streakDays: 0,
  lastSessionDay: null,
};

export async function loadGamification(): Promise<GamificationState> {
  return (await loadJson<GamificationState>(KEY)) ?? { ...FRESH };
}

// ── Session recording ────────────────────────────────────────────────────────

export type SessionSummaryData = {
  minutes: number;
  xpEarned: number;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  newUnlocks: PadUnlock[];
  streakDays: number;
  /** Deterministic recovery estimate 0–100 — labeled as estimate in UI. */
  somaticStillness: number;
};

/** Local-timezone calendar day (YYYY-MM-DD) — shared by streak systems. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Record a completed session and return everything the reward card needs.
 * Streak counts one session per local day; a missed day resets to 1.
 */
export async function recordSession(
  minutes: number,
  goal: SessionGoal | null,
): Promise<SessionSummaryData> {
  const state = await loadGamification();

  const xpEarned = Math.max(0, Math.round(minutes * XP_PER_MINUTE));
  const levelBefore = levelForXp(state.totalXp);
  state.totalXp += xpEarned;
  const levelAfter = levelForXp(state.totalXp);

  state.sessionsCompleted += 1;
  state.totalMinutes += Math.round(minutes);

  const today = localDay();
  if (state.lastSessionDay !== today) {
    const yesterday = localDay(new Date(Date.now() - 86_400_000));
    state.streakDays = state.lastSessionDay === yesterday ? state.streakDays + 1 : 1;
    state.lastSessionDay = today;
  }

  await saveJson(KEY, state);

  return {
    minutes: Math.round(minutes),
    xpEarned,
    totalXp: state.totalXp,
    levelBefore,
    levelAfter,
    newUnlocks: PAD_UNLOCKS.filter((p) => p.level > levelBefore && p.level <= levelAfter),
    streakDays: state.streakDays,
    somaticStillness: somaticStillness(minutes, goal),
  };
}

/**
 * Deterministic recovery estimate — asymptotically approaches 97% with
 * session length; wind-down goal gets a calm bonus. Placeholder until real
 * HRV data arrives from the watch pipeline.
 */
export function somaticStillness(minutes: number, goal: SessionGoal | null): number {
  const base = 97 - 45 * Math.exp(-minutes / 18);
  const calmBonus = goal === 'wind-down' ? 4 : 0;
  return Math.min(97, Math.round(base + calmBonus));
}

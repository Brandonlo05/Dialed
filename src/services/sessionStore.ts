/**
 * Session store — the single source of truth for "what is playing right now".
 *
 * WHY THIS EXISTS
 * Session state used to live in `useState` inside the dashboard screen. That
 * worked when the dashboard *was* the app, but a NOW PLAYING tab cannot read
 * another screen's local state — and neither can the mini-player, the tab bar
 * badge, or the tuner's "yield the engine" check. All five tabs need the same
 * answer, so the answer moved out of the component tree.
 *
 * WHY NOT CONTEXT
 * A context provider re-renders every consumer on every change. Screens here
 * want different slices (the mini-player wants title+accent; Now Playing wants
 * everything; the tuner wants only `isPlaying`). `useSyncExternalStore` with a
 * selector re-renders a screen only when its own slice changes — which is what
 * keeps browsing tabs cheap while audio runs.
 *
 * THREAD NOTE
 * Nothing here runs per frame. Session state changes on start/stop/phase —
 * roughly once a minute, not 60× a second. The breath ring, countdown and
 * elapsed clock stay in Reanimated worklets and never touch this store.
 */

import { useCallback, useSyncExternalStore } from 'react';

import type { BreathPattern } from '../constants/breathwork';
import type { CheckInLevel } from '../constants/checkIn';
import type { ProgramId } from '../constants/presetUx';
import type { NeuroHackId } from '../constants/neurohack';

/** Anything that can occupy the engine. */
export type SessionSourceKind = 'neurohack' | 'preset' | 'mode' | 'daily-rep' | 'tuner';

export type SessionState = {
  isPlaying: boolean;
  /** Stable id of whatever is running — union across every surface. */
  protocolId: ProgramId | NeuroHackId | 'tuner' | null;
  kind: SessionSourceKind | null;

  // ── Identity (drives Now Playing, the mini-player and Now Playing Info) ──
  title: string;
  subtitle: string;
  accent: string;

  // ── Live telemetry ──
  beatHz: number;
  carrierHz: number;
  breath: BreathPattern | null;
  /** Free-text status line — e.g. Burnout's phase countdown. */
  statusLine: string | null;

  /** Epoch ms the session began; null when idle. Drives the stopwatch. */
  startedAt: number | null;

  /**
   * Pre-session check-in, captured before audio starts. Held here rather than
   * in the check-in component so it survives tab switches and is still around
   * when the session ends on a different screen.
   */
  preState: CheckInLevel | null;
  /**
   * Whether the pre-session read has been offered yet. Separate from
   * `preState` so a deliberate skip is remembered and the sheet does not
   * reappear every time the user returns to the Now Playing tab.
   */
  preAsked: boolean;
};

const IDLE: SessionState = {
  isPlaying: false,
  protocolId: null,
  kind: null,
  title: '',
  subtitle: '',
  accent: '#7c5cff',
  beatHz: 10,
  carrierHz: 200,
  breath: null,
  statusLine: null,
  startedAt: null,
  preState: null,
  preAsked: false,
};

let state: SessionState = IDLE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): SessionState {
  return state;
}

/**
 * Merge a patch into session state.
 *
 * Identity-stable: if every key in the patch already matches, no new object is
 * created and no listener fires. This matters because the burnout preset ticks
 * a status line every second — screens that don't read `statusLine` must not
 * re-render because of it. (They won't: their selector output is unchanged, and
 * `useSyncExternalStore` bails out on `Object.is` equality.)
 */
export function updateSession(patch: Partial<SessionState>): void {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof SessionState)[]) {
    if (!Object.is(state[k], patch[k])) { changed = true; break; }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  emit();
}

/** Begin a session. Stamps `startedAt` only on an idle→playing edge. */
export function beginSession(next: Omit<Partial<SessionState>, 'isPlaying' | 'startedAt'>): void {
  state = {
    ...state,
    ...next,
    isPlaying: true,
    // A protocol swap mid-session keeps the original clock running: the user
    // experiences one continuous sitting, so XP should reflect that.
    startedAt: state.startedAt ?? Date.now(),
  };
  emit();
}

/**
 * Clears state and hands back what the caller needs to close the loop: elapsed
 * minutes for XP, and the pre-session level so the post-session check-in can
 * be compared against it. Both are read before the reset, because the session
 * may be ended from a surface that never saw them.
 */
export function endSession(): { minutes: number; preState: CheckInLevel | null } {
  const startedAt = state.startedAt;
  const preState = state.preState;
  state = { ...IDLE };
  emit();
  return {
    minutes: startedAt ? (Date.now() - startedAt) / 60_000 : 0,
    preState,
  };
}

export function getSession(): SessionState {
  return state;
}

/**
 * Subscribe to a slice. The selector runs on every store change but the
 * component re-renders only when the selected value actually differs.
 *
 * Selectors MUST return a primitive or a stable reference — returning a fresh
 * object literal defeats the bail-out and re-renders on every tick.
 */
export function useSession<T>(selector: (s: SessionState) => T): T {
  const sel = useCallback(() => selector(state), [selector]);
  return useSyncExternalStore(subscribe, sel, sel);
}

/** Whole-state read, for screens that genuinely use most of it (Now Playing). */
export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Session summary channel ──────────────────────────────────────────────────
//
// A session can be ended from three places: the Now Playing transport, the
// mini-player on any other tab, or a preset completing on its own. The XP
// summary must appear in all three cases, but it is mounted once in the tab
// layout — so the result is published here rather than returned to whichever
// screen happened to make the call. Without this, ending a session from Now
// Playing would silently swallow the summary.

type SummaryPayload = { xpEarned: number } & Record<string, unknown>;

let pendingSummary: SummaryPayload | null = null;
const summaryListeners = new Set<() => void>();

export function publishSummary(summary: SummaryPayload | null): void {
  pendingSummary = summary;
  for (const l of summaryListeners) l();
}

function subscribeSummary(listener: () => void): () => void {
  summaryListeners.add(listener);
  return () => { summaryListeners.delete(listener); };
}

function getSummary(): SummaryPayload | null {
  return pendingSummary;
}

/** Mounted once, in the tab layout. */
export function usePendingSummary<T>(): T | null {
  return useSyncExternalStore(subscribeSummary, getSummary, getSummary) as T | null;
}

// ── Post-session check-in channel ────────────────────────────────────────────
//
// Same reasoning as the summary channel: the session can end from any surface,
// but the check-in sheet is mounted once in the tab layout. Publishing the
// request here (rather than returning it) means the post read happens whether
// the user hit END on Now Playing, tapped stop in the mini-player from the
// Library, or a preset ran itself to completion.
//
// Only published when a pre-session level exists — asking "where are you now?"
// with nothing to compare against is a question with no payoff.

export type PostCheckInRequest = {
  preState: CheckInLevel;
  protocolId: string | null;
  title: string;
  accent: string;
  minutes: number;
};

let pendingPostCheckIn: PostCheckInRequest | null = null;
const postListeners = new Set<() => void>();

export function requestPostCheckIn(req: PostCheckInRequest | null): void {
  pendingPostCheckIn = req;
  for (const l of postListeners) l();
}

function subscribePost(listener: () => void): () => void {
  postListeners.add(listener);
  return () => { postListeners.delete(listener); };
}

function getPost(): PostCheckInRequest | null {
  return pendingPostCheckIn;
}

/** Mounted once, in the tab layout. */
export function usePendingPostCheckIn(): PostCheckInRequest | null {
  return useSyncExternalStore(subscribePost, getPost, getPost);
}

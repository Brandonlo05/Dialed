/**
 * Phase 4: Spotify now-playing poll loop.
 *
 * Polls /v1/me/player/currently-playing every 2 seconds while an audio session
 * is active. On a stable track change (debounced 1 second to absorb gapless
 * playback transitions), fetches audio features and recalibrates the binaural
 * carrier frequency — achieving the <3s recalibration target.
 *
 * Requires a Spotify User Bearer token (set via setUserToken after OAuth).
 * If no token is present all polls are no-ops; the audio session continues
 * unaffected on its mode's default carrier.
 */

import { setCarrierFrequency } from './audioEngine';
import {
  recalibrateCarrierFromTrackId,
  type MatchResult,
} from './harmonicMatcher';
import { getCurrentlyPlaying, hasUserToken } from './spotifyClient';

// ── Types ────────────────────────────────────────────────────────────────────

export type PollerConfig = {
  /**
   * The active mode's base carrier frequency.
   * The recalibrated Hz is computed relative to this value.
   */
  baseCarrierHz: number;
  /** Fired on every successful recalibration (max once per track change). */
  onRecalibrate: (result: MatchResult) => void;
};

// ── Module-level state ───────────────────────────────────────────────────────

const POLL_MS     = 2_000;
const DEBOUNCE_MS = 1_000;

let pollTimer:     ReturnType<typeof setInterval>  | null = null;
let debounceTimer: ReturnType<typeof setTimeout>   | null = null;
let onRecalibrate: ((r: MatchResult) => void)      | null = null;

let baseCarrierHz      = 200;
let lastConfirmedId    = '';
let candidateId        = '';
// User preference survives startMusicPoller / stopMusicPoller cycles
let userEnabled        = true;

// ── Public API ───────────────────────────────────────────────────────────────

/** Start (or restart) the poll loop. Idempotent — stops any previous loop first. */
export function startMusicPoller(config: PollerConfig): void {
  stopMusicPoller();
  baseCarrierHz   = config.baseCarrierHz;
  onRecalibrate   = config.onRecalibrate;
  lastConfirmedId = '';
  candidateId     = '';

  pollTimer = setInterval(() => { void tick(); }, POLL_MS);
  void tick(); // Run immediately without waiting for the first interval
}

/** Stop the poll loop and cancel any pending debounce. */
export function stopMusicPoller(): void {
  if (pollTimer)     { clearInterval(pollTimer);    pollTimer     = null; }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  onRecalibrate = null;
}

/**
 * Enable or disable polling without stopping the loop.
 * Preference persists across startMusicPoller calls.
 */
export function setPollerEnabled(enabled: boolean): void {
  userEnabled = enabled;
}

/** Update base carrier if the user switches modes mid-session. */
export function updatePollerBaseCarrier(hz: number): void {
  baseCarrierHz = hz;
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!userEnabled || !hasUserToken()) return;

  const nowPlaying = await getCurrentlyPlaying();

  // Nothing playing or user paused — leave carrier untouched
  if (!nowPlaying?.isPlaying) return;

  const trackId = nowPlaying.track.id;
  if (trackId === lastConfirmedId) return; // Same track, no action needed

  if (trackId !== candidateId) {
    // New candidate — start the debounce window
    candidateId = trackId;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void confirmAndRecalibrate(trackId);
    }, DEBOUNCE_MS);
  }
  // If trackId === candidateId, debounce timer is already running — do nothing
}

async function confirmAndRecalibrate(trackId: string): Promise<void> {
  debounceTimer = null;

  const result = await recalibrateCarrierFromTrackId(trackId, baseCarrierHz);
  if (!result) {
    console.log(`[Dialed] Key detection failed for track ${trackId}`);
    return;
  }

  // Apply to the live audio engine (fire-and-forget — safe per Phase 2 design)
  void setCarrierFrequency(result.carrierHz);

  lastConfirmedId = trackId;
  onRecalibrate?.(result);

  console.log(
    `[Dialed] Harmonic match → ${result.keyLabel} (${result.camelotKey}) · ${Math.round(result.carrierHz)} Hz · ${result.tempo} BPM`,
  );
}

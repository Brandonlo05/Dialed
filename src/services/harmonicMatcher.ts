/**
 * Phase 4: Harmonic carrier recalibration pipeline.
 *
 * Data flow:
 *   Spotify pitch class (0–11) + mode (0|1)
 *     → semitone offset from mode reference
 *     → equal-temperament Hz shift: hz = base × 2^(semitones/12)
 *     → clamped to 80–480 Hz (safe entrainment range)
 *
 * Also exposes Camelot Wheel labelling for the UI badge.
 */

import { getAudioFeatures, searchTrack } from './spotifyClient';

// ── Pitch class table ─────────────────────────────────────────────────────────

const PITCH_CLASS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

type Note = (typeof PITCH_CLASS)[number];

// ── Camelot Wheel ─────────────────────────────────────────────────────────────
// Major keys use the "B" (bright) suffix, minor keys use "A" (dark) suffix.

const CAMELOT: Readonly<Record<string, string>> = {
  'C:major': '8B',  'C:minor': '5A',
  'C#:major': '3B', 'C#:minor': '12A',
  'D:major': '10B', 'D:minor': '7A',
  'D#:major': '5B', 'D#:minor': '2A',
  'E:major': '12B', 'E:minor': '9A',
  'F:major': '7B',  'F:minor': '4A',
  'F#:major': '2B', 'F#:minor': '11A',
  'G:major': '9B',  'G:minor': '6A',
  'G#:major': '4B', 'G#:minor': '1A',
  'A:major': '11B', 'A:minor': '8A',
  'A#:major': '6B', 'A#:minor': '3A',
  'B:major': '1B',  'B:minor': '10A',
};

// ── Public types ──────────────────────────────────────────────────────────────

export type MatchResult = {
  /** Recalibrated carrier frequency in Hz. */
  carrierHz: number;
  /** Human-readable key e.g. "C# minor" */
  keyLabel: string;
  /** Camelot notation e.g. "12A" */
  camelotKey: string;
  /** Spotify pitch class integer 0–11 */
  pitchClass: number;
  /** Rounded BPM from audio features */
  tempo: number;
};

// Kept for backward compat with pre-Phase-4 call sites
export type TrackMetadata = {
  title: string;
  artist: string;
  key?: string;
  tempo?: number;
};

// ── Core math ─────────────────────────────────────────────────────────────────

/**
 * Shift `baseCarrierHz` by the semitone distance between the song's pitch class
 * and the mode reference (C for major, A for minor), taking the shortest arc
 * around the chromatic circle (never more than ±6 semitones).
 *
 * Equal temperament: each semitone = ×2^(1/12) ≈ 1.05946
 * Safe carrier range: 80–480 Hz
 */
export function carrierHzForSpotifyKey(
  pitchClass: number,
  mode: number,
  baseCarrierHz: number,
): number {
  // Reference pitch class: C(0) for major, A(9) for minor
  const ref = mode === 1 ? 0 : 9;
  let delta = pitchClass - ref;
  // Shortest arc: wrap to ±6
  if (delta > 6)  delta -= 12;
  if (delta < -6) delta += 12;
  const hz = baseCarrierHz * Math.pow(2, delta / 12);
  return Math.max(80, Math.min(480, hz));
}

/** Build the UI label and Camelot key from Spotify's integer fields. */
export function buildKeyLabel(
  pitchClass: number,
  mode: number,
): { keyLabel: string; camelotKey: string } {
  if (pitchClass < 0 || pitchClass > 11) {
    return { keyLabel: 'Unknown key', camelotKey: '—' };
  }
  const note     = PITCH_CLASS[pitchClass] as Note;
  const modeName = mode === 1 ? 'major' : 'minor';
  return {
    keyLabel:   `${note} ${modeName}`,
    camelotKey: CAMELOT[`${note}:${modeName}`] ?? '—',
  };
}

// ── Pipeline entry points ────────────────────────────────────────────────────

/**
 * Full pipeline: title + artist → Spotify search → audio features → Hz.
 * Slower path; use recalibrateCarrierFromTrackId when you already have an ID.
 */
export async function recalibrateCarrierFromTrack(
  title: string,
  artist: string,
  baseCarrierHz: number,
): Promise<MatchResult | null> {
  const track = await searchTrack(title, artist);
  if (!track) return null;
  return recalibrateCarrierFromTrackId(track.id, baseCarrierHz);
}

/**
 * Fast path used by the music poller once we have a stable Spotify track ID.
 * Returns null when key detection fails (Spotify key === −1) or API is unreachable.
 */
export async function recalibrateCarrierFromTrackId(
  trackId: string,
  baseCarrierHz: number,
): Promise<MatchResult | null> {
  const features = await getAudioFeatures(trackId);
  if (!features || features.key === -1) return null;

  const carrierHz             = carrierHzForSpotifyKey(features.key, features.mode, baseCarrierHz);
  const { keyLabel, camelotKey } = buildKeyLabel(features.key, features.mode);

  return {
    carrierHz,
    keyLabel,
    camelotKey,
    pitchClass: features.key,
    tempo:      Math.round(features.tempo),
  };
}

// ── Legacy stubs (kept for backward compat) ───────────────────────────────────

const KEY_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

export function carrierHzForKey(key: string, baseCarrier = 200): number {
  const semitone = KEY_SEMITONE[key.replace(/m$/i, '').trim()] ?? 0;
  return baseCarrier * Math.pow(2, semitone / 12);
}

export async function fetchTrackMetadata(
  _title: string,
  _artist: string,
): Promise<TrackMetadata | null> {
  return null;
}

export async function recalibrateCarrierFromSpotify(
  onFrequency: (hz: number) => void,
  metadata: TrackMetadata,
): Promise<void> {
  if (!metadata.key) return;
  onFrequency(carrierHzForKey(metadata.key));
}

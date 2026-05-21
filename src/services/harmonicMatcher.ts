/**
 * Phase 4: Spotify key detection + carrier frequency matrix.
 * Metadata fetched via external APIs (SoundNet / RapidAPI / ACRCloud) — not deprecated Spotify endpoints.
 */

const KEY_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

export type TrackMetadata = {
  title: string;
  artist: string;
  key?: string;
  tempo?: number;
};

export function carrierHzForKey(key: string, baseCarrier = 200): number {
  const normalized = key.replace('m', '').trim();
  const semitone = KEY_TO_SEMITONE[normalized] ?? 0;
  return baseCarrier * Math.pow(2, semitone / 12);
}

export async function fetchTrackMetadata(
  _title: string,
  _artist: string,
): Promise<TrackMetadata | null> {
  // Wire to SoundNet / RapidAPI / ACRCloud in Phase 4 integration.
  return null;
}

export async function recalibrateCarrierFromSpotify(
  onFrequency: (hz: number) => void,
  metadata: TrackMetadata,
): Promise<void> {
  if (!metadata.key) return;
  const hz = carrierHzForKey(metadata.key);
  onFrequency(hz);
}

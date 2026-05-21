/**
 * Spotify Web API client for Phase 4 harmonic matching.
 *
 * Client Credentials (no user login) — covers: track search, audio-features.
 * User Bearer token — additionally covers: /me/player/currently-playing.
 *
 * Required env vars (add to .env and app.config.js):
 *   EXPO_PUBLIC_SPOTIFY_CLIENT_ID
 *   EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET
 */

const ACCOUNTS = 'https://accounts.spotify.com';
const API      = 'https://api.spotify.com/v1';

// ── Public types ─────────────────────────────────────────────────────────────

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string[];
  durationMs: number;
};

export type AudioFeatures = {
  /** Pitch class 0–11 (C=0 … B=11). −1 means Spotify could not detect a key. */
  key: number;
  /** 0 = minor, 1 = major */
  mode: number;
  /** Beats per minute */
  tempo: number;
  energy: number;
  valence: number;
};

export type CurrentlyPlaying = {
  track: SpotifyTrack;
  isPlaying: boolean;
  progressMs: number;
};

// ── Client Credentials token cache (never expires within a session) ───────────

const CC_CLIENT_ID     = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID     ?? '';
const CC_CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET ?? '';

let ccToken  = '';
let ccExpiry = 0;

async function clientCredentialsToken(): Promise<string | null> {
  if (!CC_CLIENT_ID || !CC_CLIENT_SECRET) return null;
  if (ccToken && Date.now() < ccExpiry) return ccToken;

  try {
    const credentials = btoa(`${CC_CLIENT_ID}:${CC_CLIENT_SECRET}`);
    const res = await fetch(`${ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    ccToken  = data.access_token;
    ccExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s safety margin
    return ccToken;
  } catch {
    return null;
  }
}

// ── User Bearer token (set after PKCE OAuth completes) ───────────────────────

let userToken = '';

export function setUserToken(token: string): void {
  userToken = token.trim();
}

export function getUserToken(): string {
  return userToken;
}

export function hasUserToken(): boolean {
  return userToken.length > 0;
}

export function clearUserToken(): void {
  userToken = '';
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function spotifyGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return null;
    if (!res.ok) {
      console.warn(`[Dialed] Spotify GET ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[Dialed] Spotify fetch error:', err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search for a track. Uses Client Credentials — no user login required.
 * Returns the top result or null if nothing matches / credentials not set.
 */
export async function searchTrack(title: string, artist: string): Promise<SpotifyTrack | null> {
  const token = await clientCredentialsToken();
  if (!token) return null;

  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const data = await spotifyGet<{ tracks: { items: RawTrack[] } }>(
    `/search?q=${q}&type=track&limit=1`,
    token,
  );
  const item = data?.tracks?.items?.[0];
  if (!item) return null;
  return rawToTrack(item);
}

/**
 * Fetch audio features (key, mode, tempo, energy, valence) for a known track ID.
 * Uses Client Credentials — no user login required.
 */
export async function getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
  const token = await clientCredentialsToken();
  if (!token) return null;

  const data = await spotifyGet<RawAudioFeatures>(`/audio-features/${trackId}`, token);
  if (!data) return null;
  return {
    key:     data.key,
    mode:    data.mode,
    tempo:   data.tempo,
    energy:  data.energy,
    valence: data.valence,
  };
}

/**
 * Fetch the user's currently-playing track.
 * Requires a User Bearer token (set via setUserToken after OAuth).
 * Returns null when nothing is playing or no token is available.
 */
export async function getCurrentlyPlaying(): Promise<CurrentlyPlaying | null> {
  if (!userToken) return null;
  const data = await spotifyGet<RawCurrentlyPlaying>('/me/player/currently-playing', userToken);
  if (!data?.item) return null;
  return {
    track:      rawToTrack(data.item),
    isPlaying:  data.is_playing,
    progressMs: data.progress_ms ?? 0,
  };
}

// ── Raw Spotify response shapes (only fields we use) ─────────────────────────

type RawTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
};

type RawAudioFeatures = {
  key: number;
  mode: number;
  tempo: number;
  energy: number;
  valence: number;
};

type RawCurrentlyPlaying = {
  is_playing: boolean;
  progress_ms: number | null;
  item: RawTrack | null;
};

function rawToTrack(r: RawTrack): SpotifyTrack {
  return {
    id:         r.id,
    name:       r.name,
    artists:    r.artists.map((a) => a.name),
    durationMs: r.duration_ms,
  };
}

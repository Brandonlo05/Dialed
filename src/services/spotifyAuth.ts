/**
 * Spotify PKCE OAuth flow.
 *
 * 1. initiateSpotifyAuth() — builds the authorization URL and opens it in Safari.
 *    Requires EXPO_PUBLIC_SPOTIFY_CLIENT_ID to be set.
 *
 * 2. handleSpotifyCallback(url) — call this from a Linking listener when the
 *    app receives the redirect back to dialed://spotify-callback.
 *    Returns true on success (token is stored via setUserToken).
 *
 * The app scheme "dialed" is already registered in app.json.
 * Register dialed://spotify-callback as the Redirect URI in your Spotify
 * Developer Dashboard (https://developer.spotify.com/dashboard).
 */

import { Linking } from 'react-native';

import { setUserToken } from './spotifyClient';

const CLIENT_ID    = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
const REDIRECT_URI = 'dialed://spotify-callback';
const SCOPES       = 'user-read-currently-playing user-read-playback-state';

// Held in memory for the duration of the auth round-trip
let pendingVerifier = '';

// ── PKCE helpers (crypto.subtle is available in Hermes / New Architecture) ───

function generateVerifier(length = 64): string {
  const chars   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randBytes = new Uint8Array(length);
  crypto.getRandomValues(randBytes);
  return Array.from(randBytes, (b) => chars[b % chars.length]).join('');
}

async function verifierToChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  // BASE64URL-encode the 32-byte digest
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open the Spotify authorization page in the system browser.
 * The user approves, Spotify redirects to dialed://spotify-callback?code=…
 */
export async function initiateSpotifyAuth(): Promise<void> {
  if (!CLIENT_ID) {
    console.warn('[Dialed] EXPO_PUBLIC_SPOTIFY_CLIENT_ID is not set.');
    return;
  }

  pendingVerifier    = generateVerifier();
  const challenge    = await verifierToChallenge(pendingVerifier);

  const params = new URLSearchParams({
    client_id:              CLIENT_ID,
    response_type:          'code',
    redirect_uri:           REDIRECT_URI,
    scope:                  SCOPES,
    code_challenge_method:  'S256',
    code_challenge:         challenge,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  await Linking.openURL(authUrl);
}

/**
 * Call this when Linking fires a URL that starts with dialed://spotify-callback.
 * Exchanges the authorization code for an access token and stores it.
 *
 * @returns true if the token was successfully obtained, false otherwise.
 */
export async function handleSpotifyCallback(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const code   = parsed.searchParams.get('code');
    const error  = parsed.searchParams.get('error');

    if (error) {
      console.warn('[Dialed] Spotify OAuth error:', error);
      pendingVerifier = '';
      return false;
    }

    if (!code || !pendingVerifier) return false;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        code_verifier: pendingVerifier,
      }).toString(),
    });

    if (!res.ok) {
      console.warn('[Dialed] Spotify token exchange failed:', res.status);
      pendingVerifier = '';
      return false;
    }

    const data = (await res.json()) as { access_token: string; refresh_token?: string };
    setUserToken(data.access_token);
    pendingVerifier = '';
    return true;
  } catch (err) {
    console.warn('[Dialed] Spotify callback handler error:', err);
    pendingVerifier = '';
    return false;
  }
}

export const SPOTIFY_CALLBACK_SCHEME = 'dialed://spotify-callback';

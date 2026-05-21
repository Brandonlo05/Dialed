import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setPollerEnabled } from '../../src/services/musicPoller';
import {
  handleSpotifyCallback,
  initiateSpotifyAuth,
  SPOTIFY_CALLBACK_SCHEME,
} from '../../src/services/spotifyAuth';
import { clearUserToken, hasUserToken } from '../../src/services/spotifyClient';

// ── Reusable toggle row ───────────────────────────────────────────────────────

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.025)']}
        className="px-4 py-4"
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-4">
            <Text className="font-semibold text-dialed-stat">{title}</Text>
            <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">{description}</Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7c5cff' }}
            thumbColor={value ? '#e8e6f3' : '#4a4558'}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [brownNoise,     setBrownNoise]     = useState(true);
  const [parallelAudio,  setParallelAudio]  = useState(true);
  const [harmonicMatch,  setHarmonicMatch_] = useState(true);
  const [watchSync,      setWatchSync]      = useState(false);
  const [spotifyLinked,  setSpotifyLinked]  = useState(hasUserToken());
  const [authPending,    setAuthPending]    = useState(false);

  // ── Wire harmonic toggle to the live poller ───────────────────────────────

  function setHarmonicMatch(v: boolean) {
    setHarmonicMatch_(v);
    setPollerEnabled(v);
  }

  // ── Spotify OAuth deep-link listener ─────────────────────────────────────

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!url.startsWith(SPOTIFY_CALLBACK_SCHEME)) return;
      const ok = await handleSpotifyCallback(url);
      setSpotifyLinked(ok);
      setAuthPending(false);
    });
    return () => sub.remove();
  }, []);

  async function connectSpotify() {
    setAuthPending(true);
    await initiateSpotifyAuth();
    // setAuthPending(false) is called in the Linking listener above
  }

  function disconnectSpotify() {
    clearUserToken();
    setSpotifyLinked(false);
    setPollerEnabled(false);
    setHarmonicMatch_(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View className="mb-7 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Configuration
          </Text>
          <Text className="mt-0.5 text-[28px] font-black tracking-tight text-dialed-stat">
            Settings
          </Text>
        </View>

        {/* ── Spotify Connect ───────────────────────────────────────────────── */}
        <Text className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Harmonic Intelligence
        </Text>

        <View
          className="mb-3 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: spotifyLinked ? 'rgba(94,234,212,0.25)' : 'rgba(255,255,255,0.09)' }}
        >
          <LinearGradient
            colors={
              spotifyLinked
                ? ['rgba(94,234,212,0.1)', 'rgba(10,10,16,0.97)']
                : ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.025)']
            }
            className="p-4"
          >
            <View className="flex-row items-center" style={{ gap: 10 }}>
              {/* Spotify logo stand-in */}
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: spotifyLinked ? 'rgba(30,215,96,0.2)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text allowFontScaling={false} style={{ fontSize: 16 }}>
                  {spotifyLinked ? '✓' : '♫'}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="font-semibold text-dialed-stat">
                  {spotifyLinked ? 'Spotify Connected' : 'Connect Spotify'}
                </Text>
                <Text className="mt-0.5 text-xs leading-[16px] text-dialed-muted">
                  {spotifyLinked
                    ? 'Harmonic matching active — key detected within 3s'
                    : 'Required for live key detection and carrier recalibration'}
                </Text>
              </View>

              <Pressable
                onPress={spotifyLinked ? disconnectSpotify : connectSpotify}
                className="rounded-xl px-3 py-2"
                style={{
                  backgroundColor: spotifyLinked
                    ? 'rgba(255,80,80,0.15)'
                    : 'rgba(124,92,255,0.25)',
                  borderWidth: 1,
                  borderColor: spotifyLinked
                    ? 'rgba(255,80,80,0.3)'
                    : 'rgba(124,92,255,0.45)',
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: spotifyLinked ? '#f87171' : '#a78bfa' }}
                >
                  {authPending ? 'Waiting…' : spotifyLinked ? 'Unlink' : 'Connect'}
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <SettingRow
          title="Spotify Harmonic Match"
          description="Recalibrate carrier tones to current song key within 3 seconds"
          value={harmonicMatch}
          onChange={setHarmonicMatch}
        />

        {/* ── Audio Engine ─────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Audio Engine
        </Text>
        <SettingRow
          title="ADHD Brownian Noise"
          description="Broadband noise layer underneath binaural tones for attention anchoring"
          value={brownNoise}
          onChange={setBrownNoise}
        />
        <SettingRow
          title="Parallel Audio"
          description="Mixes entrainment with Spotify without ducking or interruption"
          value={parallelAudio}
          onChange={setParallelAudio}
        />

        {/* ── Phase 3 ──────────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Biometrics
        </Text>
        <SettingRow
          title="Apple Watch Sync"
          description="Adaptive mode switching based on HRV and biometric data (Phase 3)"
          value={watchSync}
          onChange={setWatchSync}
        />

        {/* ── Build note ───────────────────────────────────────────────────── */}
        <View
          className="mt-6 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.015)']}
            className="p-4"
          >
            <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
              Setup
            </Text>
            <Text className="text-xs leading-[18px] text-dialed-muted">
              Add your Spotify app credentials to{' '}
              <Text className="font-mono text-dialed-stat">.env</Text>:{'\n'}
              <Text className="font-mono text-dialed-stat">EXPO_PUBLIC_SPOTIFY_CLIENT_ID</Text>
              {'\n'}
              <Text className="font-mono text-dialed-stat">EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET</Text>
              {'\n\n'}
              Register{' '}
              <Text className="font-mono text-dialed-stat">dialed://spotify-callback</Text>
              {' '}as a Redirect URI in your{'\n'}Spotify Developer Dashboard.
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

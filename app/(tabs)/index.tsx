import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { StatBox } from '../../src/components/StatBox';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import { startAudioSession, stopAudioSession } from '../../src/services/audioEngine';
import type { MatchResult } from '../../src/services/harmonicMatcher';
import {
  startMusicPoller,
  stopMusicPoller,
  updatePollerBaseCarrier,
} from '../../src/services/musicPoller';
import { hasUserToken } from '../../src/services/spotifyClient';

export default function DashboardScreen() {
  const [activeMode, setActiveMode]   = useState<FocusModeId | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [detecting, setDetecting]     = useState(false);

  const activeModeData = FOCUS_MODES.find((m) => m.id === activeMode);

  const toggleMode = useCallback(
    async (modeId: FocusModeId) => {
      const mode = FOCUS_MODES.find((m) => m.id === modeId);
      if (!mode) return;

      // ── Stop current session ──────────────────────────────────────────────
      if (activeMode === modeId && isPlaying) {
        await stopAudioSession();
        stopMusicPoller();
        setIsPlaying(false);
        setActiveMode(null);
        setMatchResult(null);
        setDetecting(false);
        return;
      }

      // ── Start new session ─────────────────────────────────────────────────
      setActiveMode(modeId);
      setMatchResult(null);
      setDetecting(hasUserToken());

      await startAudioSession({
        carrierHz:          mode.carrierHz,
        beatHz:             mode.beatHz,
        brownNoiseEnabled:  modeId === 'standard-focus',
      });

      if (hasUserToken()) {
        startMusicPoller({
          baseCarrierHz: mode.carrierHz,
          onRecalibrate: (result) => {
            setMatchResult(result);
            setDetecting(false);
          },
        });
      }

      setIsPlaying(true);
    },
    [activeMode, isPlaying],
  );

  // If the user connects Spotify in Settings then switches back, re-start poller
  useEffect(() => {
    if (isPlaying && activeModeData && hasUserToken() && !matchResult) {
      updatePollerBaseCarrier(activeModeData.carrierHz);
      setDetecting(true);
    }
  }, [isPlaying, activeModeData, matchResult]);

  // Clean up on unmount (tab switch)
  useEffect(() => () => { stopMusicPoller(); }, []);

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="mb-8 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Binaural Focus
          </Text>
          <Text className="mt-0.5 text-[34px] font-black tracking-tight text-dialed-stat">
            Dialed
          </Text>

          {/* Session status row */}
          <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: isPlaying ? '#4ade80' : 'rgba(255,255,255,0.18)',
              }}
            />
            <Text className="text-xs text-dialed-muted">
              {isPlaying && activeModeData
                ? `${activeModeData.title} · ${activeModeData.beatHz} Hz · Active`
                : 'Select a mode to begin entrainment'}
            </Text>
          </View>

          {/* Harmonic match badge — shown once a key is confirmed */}
          {isPlaying && matchResult && (
            <View
              className="mt-2 self-start flex-row items-center rounded-full px-3 py-1"
              style={{
                backgroundColor: 'rgba(124,92,255,0.14)',
                borderWidth:     1,
                borderColor:     'rgba(124,92,255,0.35)',
                gap:             6,
              }}
            >
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#a78bfa' }}
              />
              <Text className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>
                {matchResult.keyLabel}
              </Text>
              <Text className="text-[11px] text-dialed-muted">
                {Math.round(matchResult.carrierHz)} Hz · {matchResult.camelotKey} · {matchResult.tempo} BPM
              </Text>
            </View>
          )}

          {/* Detecting state — shown while waiting for first poll result */}
          {isPlaying && detecting && !matchResult && (
            <View className="mt-2 flex-row items-center" style={{ gap: 5 }}>
              <Text className="text-[11px] text-dialed-muted">◌  Detecting key…</Text>
            </View>
          )}
        </View>

        {/* ── Mode Cards ───────────────────────────────────────────────────── */}
        <Text className="mb-3 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Entrainment Modes
        </Text>
        {FOCUS_MODES.map((mode) => (
          <GlassCard
            key={mode.id}
            title={mode.title}
            subtitle={mode.subtitle}
            accent={mode.accent}
            icon={mode.icon}
            selected={activeMode === mode.id}
            onPress={() => toggleMode(mode.id)}
          />
        ))}

        {/* ── Stats Grid ───────────────────────────────────────────────────── */}
        <Text className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Performance Metrics
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {STAT_BOXES.map((stat) => (
            <View key={stat.label} style={{ width: '47.5%' }}>
              <StatBox
                value={stat.value}
                label={stat.label}
                detail={stat.detail}
                accentColor={stat.accentColor}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

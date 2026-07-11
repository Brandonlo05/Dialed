import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FocusRing } from '../../src/components/FocusRing';
import { GlassCard } from '../../src/components/GlassCard';
import { SessionSummary } from '../../src/components/SessionSummary';
import { StatBox } from '../../src/components/StatBox';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import {
  setVolume,
  startAudioSession,
  stopAudioSession,
} from '../../src/services/audioEngine';
import { recordSession, type SessionSummaryData } from '../../src/services/gamification';
import { tapConfirm } from '../../src/services/haptics';
import { calibrate, getCachedProfile, recommendedModeId } from '../../src/services/userProfile';

export default function DashboardScreen() {
  const [activeMode, setActiveMode] = useState<FocusModeId | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [summary, setSummary]       = useState<SessionSummaryData | null>(null);

  const sessionStartRef = useRef<number | null>(null);

  const profile = getCachedProfile();
  const recommendedId = profile ? recommendedModeId(profile.goal) : null;
  const activeModeData = FOCUS_MODES.find((m) => m.id === activeMode);
  const activeCalibration = activeModeData ? calibrate(activeModeData, profile) : null;

  // ── Session clock (wall-clock based — immune to JS timer drift) ────────────
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (sessionStartRef.current !== null) {
        setElapsedSec(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const toggleMode = useCallback(
    async (modeId: FocusModeId) => {
      const mode = FOCUS_MODES.find((m) => m.id === modeId);
      if (!mode) return;

      // ── Stop current session → record XP + show reward card ───────────────
      if (activeMode === modeId && isPlaying) {
        await stopAudioSession();
        const startedAt = sessionStartRef.current;
        sessionStartRef.current = null;
        setIsPlaying(false);
        setActiveMode(null);
        setElapsedSec(0);

        const minutes = startedAt ? (Date.now() - startedAt) / 60_000 : 0;
        if (minutes >= 1) {
          setSummary(await recordSession(minutes, profile?.goal ?? null));
        }
        return;
      }

      // ── Start (or hot-swap) a session with calibrated parameters ──────────
      tapConfirm();
      const cal = calibrate(mode, profile);
      setActiveMode(modeId);

      await startAudioSession({
        carrierHz:         cal.carrierHz,
        beatHz:            cal.beatHz,
        brownNoiseEnabled: cal.brownNoise,
      });
      void setVolume(cal.volume);

      // Hot-swapping modes keeps the clock running; a fresh start resets it
      if (!isPlaying) {
        sessionStartRef.current = Date.now();
        setElapsedSec(0);
      }
      setIsPlaying(true);
    },
    [activeMode, isPlaying, profile],
  );

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="mb-6 mt-4">
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
              {isPlaying && activeModeData && activeCalibration
                ? `${activeModeData.title} · ${Math.round(activeCalibration.carrierHz)} Hz carrier · ${activeCalibration.beatHz} Hz beat`
                : 'Select a mode to begin entrainment'}
            </Text>
          </View>
        </View>

        {/* ── Live focus ring ─────────────────────────────────────────────── */}
        {isPlaying && activeCalibration && (
          <FocusRing elapsedSec={elapsedSec} beatHz={activeCalibration.beatHz} />
        )}

        {/* ── Mode Cards ───────────────────────────────────────────────────── */}
        <Text className="mb-3 mt-2 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
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
            badge={mode.id === recommendedId ? 'Calibrated' : undefined}
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

      {/* ── Micro-reward splash ─────────────────────────────────────────────── */}
      <SessionSummary summary={summary} onClose={() => setSummary(null)} />
    </SafeAreaView>
  );
}

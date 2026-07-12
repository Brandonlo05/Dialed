import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommandSheet, type SheetProgram } from '../../src/components/CommandSheet';
import { FocusRing } from '../../src/components/FocusRing';
import { GlassCard } from '../../src/components/GlassCard';
import { SessionSummary } from '../../src/components/SessionSummary';
import { StatBox } from '../../src/components/StatBox';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import { PRESET_UX_DATA, type ProgramId } from '../../src/constants/presetUx';
import {
  setVolume,
  startAudioSession,
  stopAudioSession,
} from '../../src/services/audioEngine';
import {
  NEURO_PRESETS,
  startNeuroPreset,
  stopNeuroPreset,
  type BurnoutTick,
  type NeuroPresetId,
} from '../../src/services/audioPresets';
import { recordSession, type SessionSummaryData } from '../../src/services/gamification';
import { celebrate, engagePreset, tapConfirm, tapSelect } from '../../src/services/haptics';
import { calibrate, getCachedProfile, recommendedModeId } from '../../src/services/userProfile';

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const [activeMode, setActiveMode]     = useState<FocusModeId | null>(null);
  const [activePreset, setActivePreset] = useState<NeuroPresetId | null>(null);
  const [burnoutTick, setBurnoutTick]   = useState<BurnoutTick | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [elapsedSec, setElapsedSec]     = useState(0);
  const [summary, setSummary]           = useState<SessionSummaryData | null>(null);
  const [sheetProgram, setSheetProgram] = useState<ProgramId | null>(null);

  const sessionStartRef = useRef<number | null>(null);

  const profile = getCachedProfile();
  const recommendedId = profile ? recommendedModeId(profile.goal) : null;
  const activeModeData = FOCUS_MODES.find((m) => m.id === activeMode);
  const activeCalibration = activeModeData ? calibrate(activeModeData, profile) : null;
  const activePresetData = NEURO_PRESETS.find((p) => p.id === activePreset);

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

  // ── Unified teardown: audio off, sweep clock cleared, XP recorded ─────────
  const finishSession = useCallback(async () => {
    stopNeuroPreset();
    await stopAudioSession();
    const startedAt = sessionStartRef.current;
    sessionStartRef.current = null;
    setIsPlaying(false);
    setActiveMode(null);
    setActivePreset(null);
    setBurnoutTick(null);
    setElapsedSec(0);

    const minutes = startedAt ? (Date.now() - startedAt) / 60_000 : 0;
    if (minutes >= 1) {
      setSummary(await recordSession(minutes, profile?.goal ?? null));
    }
  }, [profile]);

  // Fresh reference for async preset callbacks (avoids stale closures)
  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;

  // Clear the sweep clock if the dashboard ever unmounts mid-session
  useEffect(() => () => { stopNeuroPreset(); }, []);

  // ── Session starters (fired by the Command Sheet's ENGAGE button) ─────────
  const startMode = useCallback(
    async (modeId: FocusModeId) => {
      const mode = FOCUS_MODES.find((m) => m.id === modeId);
      if (!mode) return;

      tapConfirm();
      stopNeuroPreset();
      const cal = calibrate(mode, profile);
      setActiveMode(modeId);
      setActivePreset(null);
      setBurnoutTick(null);

      await startAudioSession({
        carrierHz:         cal.carrierHz,
        beatHz:            cal.beatHz,
        brownNoiseEnabled: cal.brownNoise,
        asymmetricSMR:     cal.asymmetricSMR,
        smrHz:             cal.smrHz,
        smrDepth:          cal.smrDepth,
      });
      void setVolume(cal.volume);

      // Deep confirmation bloom once the asymmetric L-ear alignment is live —
      // startAudioSession resolves only after the native engine has started.
      if (cal.asymmetricSMR) celebrate();

      if (!isPlaying) {
        sessionStartRef.current = Date.now();
        setElapsedSec(0);
      }
      setIsPlaying(true);
    },
    [isPlaying, profile],
  );

  const startPreset = useCallback(
    async (presetId: NeuroPresetId) => {
      engagePreset(); // distinct two-stage notification pattern
      setActiveMode(null);
      setActivePreset(presetId);
      setBurnoutTick(null);

      await startNeuroPreset(presetId, {
        onBurnoutTick: setBurnoutTick,
        onComplete: () => { void finishRef.current(); },
      });

      if (!isPlaying) {
        sessionStartRef.current = Date.now();
        setElapsedSec(0);
      }
      setIsPlaying(true);
    },
    [isPlaying],
  );

  // ── Card presses: active card stops; anything else opens the Command Sheet ─
  const onModeCardPress = useCallback(
    (modeId: FocusModeId) => {
      if (activeMode === modeId && isPlaying) {
        void finishSession();
        return;
      }
      tapSelect();
      setSheetProgram(modeId);
    },
    [activeMode, isPlaying, finishSession],
  );

  const onPresetCardPress = useCallback(
    (presetId: NeuroPresetId) => {
      if (activePreset === presetId && isPlaying) {
        void finishSession();
        return;
      }
      tapSelect();
      setSheetProgram(presetId);
    },
    [activePreset, isPlaying, finishSession],
  );

  const engageFromSheet = useCallback(() => {
    const id = sheetProgram;
    setSheetProgram(null);
    if (!id) return;
    if (NEURO_PRESETS.some((p) => p.id === id)) {
      void startPreset(id as NeuroPresetId);
    } else {
      void startMode(id as FocusModeId);
    }
  }, [sheetProgram, startMode, startPreset]);

  // Sheet metadata for whichever program is being previewed
  const sheetMeta: SheetProgram | null = (() => {
    if (!sheetProgram) return null;
    const preset = NEURO_PRESETS.find((p) => p.id === sheetProgram);
    if (preset) {
      return {
        id: sheetProgram,
        title: preset.title,
        subtitle: preset.subtitle,
        icon: preset.icon,
        beatHz: preset.displayHz,
      };
    }
    const mode = FOCUS_MODES.find((m) => m.id === sheetProgram);
    if (!mode) return null;
    return {
      id: sheetProgram,
      title: mode.title,
      subtitle: mode.subtitle,
      icon: mode.icon,
      beatHz: PRESET_UX_DATA[sheetProgram].targetHz,
    };
  })();

  // ── Ring pulse rate: live sweep value for Burnout, fixed rate otherwise ───
  const ringHz = activePresetData
    ? activePreset === 'burnout'
      ? burnoutTick?.beatHz ?? 18
      : activePresetData.displayHz
    : activeCalibration?.beatHz ?? 10;

  const statusText = (() => {
    if (!isPlaying) return 'Select a mode to begin entrainment';
    if (activePreset === 'burnout') {
      return `Burnout Mode · ${(burnoutTick?.beatHz ?? 18).toFixed(1)} Hz · deceleration sweep`;
    }
    if (activePreset === 'screen-fog') {
      return 'Screen Fog Cleanser · 400 Hz · 40 Hz gamma ASSR · pink noise';
    }
    if (activePreset === 'pre-exam') {
      return 'Pre-Exam Reset · L 13 Hz SMR · R 10 Hz alpha';
    }
    if (activeModeData && activeCalibration) {
      return activeCalibration.asymmetricSMR
        ? `${activeModeData.title} · ${Math.round(activeCalibration.carrierHz)} Hz carrier · SMR ${activeCalibration.smrHz} Hz · L-ear lock`
        : `${activeModeData.title} · ${Math.round(activeCalibration.carrierHz)} Hz carrier · ${activeCalibration.beatHz} Hz beat`;
    }
    return 'Session active';
  })();

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
            <Text className="text-xs text-dialed-muted">{statusText}</Text>
          </View>

          {/* Burnout phase countdown — tracks the sweep through its 3 phases */}
          {isPlaying && activePreset === 'burnout' && burnoutTick && (
            <View
              className="mt-2 self-start flex-row items-center rounded-full px-3 py-1"
              style={{
                backgroundColor: 'rgba(251,146,60,0.13)',
                borderWidth: 1,
                borderColor: 'rgba(251,146,60,0.4)',
                gap: 6,
              }}
            >
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#fb923c' }} />
              <Text className="text-[11px] font-semibold" style={{ color: '#fb923c' }}>
                {burnoutTick.phaseLabel}
              </Text>
              <Text
                className="text-[11px] text-dialed-muted"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCountdown(burnoutTick.remainingSec)} remaining
              </Text>
            </View>
          )}
        </View>

        {/* ── Live focus ring ─────────────────────────────────────────────── */}
        {isPlaying && <FocusRing elapsedSec={elapsedSec} beatHz={ringHz} />}

        {/* ── Clinical neuro-presets ──────────────────────────────────────── */}
        <Text className="mb-3 mt-2 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Clinical Neuro-Presets
        </Text>
        {NEURO_PRESETS.map((preset) => (
          <GlassCard
            key={preset.id}
            title={preset.title}
            subtitle={preset.subtitle}
            accent={preset.accent}
            icon={preset.icon}
            selected={activePreset === preset.id}
            badge={preset.badge}
            onPress={() => onPresetCardPress(preset.id)}
          />
        ))}

        {/* ── Mode Cards ───────────────────────────────────────────────────── */}
        <Text className="mb-3 mt-4 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
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
            onPress={() => onModeCardPress(mode.id)}
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

      {/* ── Command Center bottom sheet ─────────────────────────────────────── */}
      <CommandSheet
        program={sheetMeta}
        onEngage={engageFromSheet}
        onClose={() => setSheetProgram(null)}
      />
    </SafeAreaView>
  );
}

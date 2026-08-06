import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveProtocolEngine } from '../../src/components/ActiveProtocolEngine';
import { CommandSheet, type SheetProgram } from '../../src/components/CommandSheet';
import { DailyRep } from '../../src/components/DailyRep';
import { GlassCard } from '../../src/components/GlassCard';
import { ManualTuner } from '../../src/components/ManualTuner';
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
import { getTailoredCardConfig } from '../../src/services/tailoredCopy';
import {
  calibrate,
  consumePendingRecommendation,
  getCachedProfile,
  recommendedModeId,
} from '../../src/services/userProfile';

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

  // Re-read the cached profile every time this tab gains focus, so a
  // recalibration in Settings live-morphs all tailored copy — no restart.
  const [, setProfileTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setProfileTick((t) => t + 1);
    }, []),
  );

  const profile = getCachedProfile();
  const tailored = getTailoredCardConfig(profile);
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

  // Fresh from the Neural Diagnostic: pop the recommended program's
  // Command Sheet once the dashboard has settled.
  useEffect(() => {
    const recommended = consumePendingRecommendation();
    if (!recommended) return;
    const timer = setTimeout(() => setSheetProgram(recommended), 500);
    return () => clearTimeout(timer);
  }, []);

  // Self-contained modules (Daily Rep, Manual Tuner) call this before
  // taking the engine, so a running program session ends cleanly and its
  // XP is banked instead of being silently torn down natively.
  const yieldAudio = useCallback(async () => {
    if (isPlaying) await finishSession();
  }, [isPlaying, finishSession]);

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

  // Sheet metadata for whichever program is being previewed — the user's
  // tailored program carries its personalized title and copy everywhere.
  const sheetMeta: SheetProgram | null = (() => {
    if (!sheetProgram) return null;
    let meta: SheetProgram | null = null;
    const preset = NEURO_PRESETS.find((p) => p.id === sheetProgram);
    if (preset) {
      meta = {
        id: sheetProgram,
        title: preset.title,
        subtitle: preset.subtitle,
        icon: preset.icon,
        beatHz: preset.displayHz,
      };
    } else {
      const mode = FOCUS_MODES.find((m) => m.id === sheetProgram);
      if (mode) {
        meta = {
          id: sheetProgram,
          title: mode.title,
          subtitle: mode.subtitle,
          icon: mode.icon,
          beatHz: PRESET_UX_DATA[sheetProgram].targetHz,
        };
      }
    }
    if (meta && meta.id === tailored.programId) {
      meta = { ...meta, title: tailored.title, subtitle: tailored.cardSubtitle };
    }
    return meta;
  })();

  // ── Hero waveform parameters ──────────────────────────────────────────────
  // Live sweep value for Burnout, fixed rate otherwise; falls back to the
  // tailored protocol's target when idle so the hero always has a signature.
  const ringHz = activePresetData
    ? activePreset === 'burnout'
      ? burnoutTick?.beatHz ?? 18
      : activePresetData.displayHz
    : activeCalibration?.beatHz ?? tailored.targetHz;

  const heroCarrierHz = activePresetData
    ? activePresetData.carrierHz
    : activeCalibration?.carrierHz ?? 220;

  const heroOvertones = activePreset === 'golden-432';

  // Identity shown by the hero: the live program when engaged, otherwise the
  // user's tailored protocol.
  const heroTitle = isPlaying
    ? activePresetData?.title ?? activeModeData?.title ?? tailored.title
    : tailored.title;
  const heroSubtitle = isPlaying
    ? activePresetData?.subtitle ?? activeModeData?.subtitle ?? tailored.cardSubtitle
    : tailored.subtitle;
  const heroAccent = isPlaying
    ? activePresetData?.accent ?? activeModeData?.accent ?? tailored.accent
    : tailored.accent;

  const heroStatusLine =
    isPlaying && activePreset === 'burnout' && burnoutTick
      ? `${burnoutTick.phaseLabel} · ${formatCountdown(burnoutTick.remainingSec)} remaining`
      : null;

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

          {/* Engine telemetry — full signal-path detail lives here; the
              Active Protocol Engine hero owns state and identity. */}
          <Text className="mt-2 font-mono text-[10px] text-dialed-muted">{statusText}</Text>
        </View>

        {/* ── ACTIVE PROTOCOL ENGINE — single dominant surface ────────────── */}
        <ActiveProtocolEngine
          title={heroTitle}
          subtitle={heroSubtitle}
          accent={heroAccent}
          targetHz={ringHz}
          carrierHz={heroCarrierHz}
          overtones={heroOvertones}
          isPlaying={isPlaying}
          elapsedSec={elapsedSec}
          statusLine={heroStatusLine}
          onEngage={() => { tapSelect(); setSheetProgram(tailored.programId); }}
          onStop={() => { void finishSession(); }}
        />

        {/* ── Daily Cognitive Rep — top-priority mission ──────────────────── */}
        <DailyRep onBeforeStart={yieldAudio} />

        {/* ── Clinical neuro-presets ──────────────────────────────────────── */}
        <Text className="mb-3 mt-2 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Clinical Neuro-Presets
        </Text>
        {NEURO_PRESETS.map((preset) => {
          const isTailored = preset.id === tailored.programId;
          return (
            <GlassCard
              key={preset.id}
              title={isTailored ? tailored.title : preset.title}
              subtitle={isTailored ? tailored.cardSubtitle : preset.subtitle}
              accent={preset.accent}
              icon={preset.icon}
              selected={activePreset === preset.id}
              badge={isTailored ? 'Yours' : preset.badge}
              onPress={() => onPresetCardPress(preset.id)}
            />
          );
        })}

        {/* ── Mode Cards ───────────────────────────────────────────────────── */}
        <Text className="mb-3 mt-4 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Entrainment Modes
        </Text>
        {FOCUS_MODES.map((mode) => {
          const isTailored = mode.id === tailored.programId;
          return (
            <GlassCard
              key={mode.id}
              title={isTailored ? tailored.title : mode.title}
              subtitle={isTailored ? tailored.cardSubtitle : mode.subtitle}
              accent={mode.accent}
              icon={mode.icon}
              selected={activeMode === mode.id}
              badge={isTailored ? 'Yours' : mode.id === recommendedId ? 'Calibrated' : undefined}
              onPress={() => onModeCardPress(mode.id)}
            />
          );
        })}

        {/* ── Manual Tuner — freeform 1–100 Hz synthesizer ─────────────────── */}
        <ManualTuner onBeforeStart={yieldAudio} externalSessionActive={isPlaying} />

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

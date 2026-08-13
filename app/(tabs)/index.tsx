/**
 * Dashboard — four surfaces, in priority order:
 *
 *   1. ACTIVE PROTOCOL ENGINE  (hero: identity, telemetry, live waveform, ring)
 *   2. Daily Cognitive Rep     (today's mission)
 *   3. Browse Protocols        (one row → segmented library drawer)
 *   4. Performance Metrics     (stat grid)
 *
 * Everything browsable lives one tap away in the library drawer rather than
 * competing for attention in a flat scroll. Session orchestration lives here;
 * clocks and profile refresh are extracted to /hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveProtocolEngine } from '../../src/components/ActiveProtocolEngine';
import { CommandSheet, type SheetProgram } from '../../src/components/CommandSheet';
import { DailyRep } from '../../src/components/DailyRep';
import {
  ProtocolLibrary,
  ProtocolLibraryRow,
  type LibrarySegment,
} from '../../src/components/ProtocolLibrary';
import { SessionSummary } from '../../src/components/SessionSummary';
import { StatBox } from '../../src/components/ui/StatBox';
import { breathForProgram } from '../../src/constants/breathwork';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import { PRESET_UX_DATA, type ProgramId } from '../../src/constants/presetUx';
import { useProfileRefresh } from '../../src/hooks/useProfileRefresh';
import { useSessionClock } from '../../src/hooks/useSessionClock';
import { setVolume, startAudioSession, stopAudioSession } from '../../src/services/audioEngine';
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
} from '../../src/services/userProfile';

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LIBRARY_COUNT = NEURO_PRESETS.length + FOCUS_MODES.length + 1; // +1 = Manual Tuner

export default function DashboardScreen() {
  const [activeMode, setActiveMode]     = useState<FocusModeId | null>(null);
  const [activePreset, setActivePreset] = useState<NeuroPresetId | null>(null);
  const [burnoutTick, setBurnoutTick]   = useState<BurnoutTick | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [summary, setSummary]           = useState<SessionSummaryData | null>(null);
  const [sheetProgram, setSheetProgram] = useState<ProgramId | null>(null);
  const [libraryOpen, setLibraryOpen]   = useState(false);
  const [segment, setSegment]           = useState<LibrarySegment>('presets');

  const sessionStartRef = useRef<number | null>(null);

  useProfileRefresh(); // recalibration in Settings live-morphs tailored copy
  const elapsedSec = useSessionClock(isPlaying, sessionStartRef);

  const profile = getCachedProfile();
  const tailored = getTailoredCardConfig(profile);
  const activeModeData = FOCUS_MODES.find((m) => m.id === activeMode);
  const activeCalibration = activeModeData ? calibrate(activeModeData, profile) : null;
  const activePresetData = NEURO_PRESETS.find((p) => p.id === activePreset);

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

    const minutes = startedAt ? (Date.now() - startedAt) / 60_000 : 0;
    if (minutes >= 1) {
      setSummary(await recordSession(minutes, profile?.goal ?? null));
    }
  }, [profile]);

  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;

  useEffect(() => () => { stopNeuroPreset(); }, []);

  // Fresh from the Neural Diagnostic: pop the recommended program's sheet
  useEffect(() => {
    const recommended = consumePendingRecommendation();
    if (!recommended) return;
    const timer = setTimeout(() => setSheetProgram(recommended), 500);
    return () => clearTimeout(timer);
  }, []);

  // Self-contained modules take the engine only after a clean handoff
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

      // startAudioSession resolves only once the native engine is running
      if (cal.asymmetricSMR) celebrate();

      if (!isPlaying) sessionStartRef.current = Date.now();
      setIsPlaying(true);
    },
    [isPlaying, profile],
  );

  const startPreset = useCallback(
    async (presetId: NeuroPresetId) => {
      engagePreset();
      setActiveMode(null);
      setActivePreset(presetId);
      setBurnoutTick(null);

      await startNeuroPreset(presetId, {
        onBurnoutTick: setBurnoutTick,
        onComplete: () => { void finishRef.current(); },
      });

      if (!isPlaying) sessionStartRef.current = Date.now();
      setIsPlaying(true);
    },
    [isPlaying],
  );

  // ── Library → Command Sheet → engine ──────────────────────────────────────
  const onLibrarySelect = useCallback((id: ProgramId) => {
    setLibraryOpen(false);
    setSheetProgram(id);
  }, []);

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

  // ── Hero parameters ───────────────────────────────────────────────────────
  const activeProgramId: ProgramId | null =
    (activePreset as ProgramId | null) ?? (activeMode as ProgramId | null);

  const ringHz = activePresetData
    ? activePreset === 'burnout'
      ? burnoutTick?.beatHz ?? 18
      : activePresetData.displayHz
    : activeCalibration?.beatHz ?? tailored.targetHz;

  const heroCarrierHz = activePresetData
    ? activePresetData.carrierHz
    : activeCalibration?.carrierHz ?? 220;

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

  const runningLabel = isPlaying
    ? activePresetData?.title ?? activeModeData?.title ?? null
    : null;

  // Sheet metadata — the tailored program carries its personalized voice
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

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="mb-5 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Binaural Focus
          </Text>
          <Text className="mt-0.5 text-[34px] font-black tracking-tight text-dialed-stat">
            Dialed
          </Text>
        </View>

        {/* ── 1 · ACTIVE PROTOCOL ENGINE ──────────────────────────────────── */}
        <ActiveProtocolEngine
          title={heroTitle}
          subtitle={heroSubtitle}
          accent={heroAccent}
          targetHz={ringHz}
          carrierHz={heroCarrierHz}
          overtones={activePreset === 'golden-432'}
          isPlaying={isPlaying}
          elapsedSec={elapsedSec}
          breathPattern={activeProgramId ? breathForProgram(activeProgramId) : null}
          statusLine={heroStatusLine}
          onEngage={() => { tapSelect(); setSheetProgram(tailored.programId); }}
          onStop={() => { void finishSession(); }}
        />

        {/* ── 2 · Daily Cognitive Rep ─────────────────────────────────────── */}
        <DailyRep onBeforeStart={yieldAudio} />

        {/* ── 3 · Browse Protocols ────────────────────────────────────────── */}
        <ProtocolLibraryRow
          count={LIBRARY_COUNT}
          activeLabel={runningLabel}
          onPress={() => { tapSelect(); setLibraryOpen(true); }}
        />

        {/* ── 4 · Performance Metrics ─────────────────────────────────────── */}
        <Text className="mb-3 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
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

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      <ProtocolLibrary
        visible={libraryOpen}
        segment={segment}
        onSegmentChange={setSegment}
        activeProgram={activeProgramId}
        tailoredProgramId={tailored.programId}
        tailoredTitle={tailored.title}
        tailoredSubtitle={tailored.cardSubtitle}
        onSelect={onLibrarySelect}
        onClose={() => setLibraryOpen(false)}
        onTunerBeforeStart={yieldAudio}
        externalSessionActive={isPlaying}
      />

      <SessionSummary summary={summary} onClose={() => setSummary(null)} />

      <CommandSheet
        program={sheetMeta}
        onEngage={engageFromSheet}
        onClose={() => setSheetProgram(null)}
      />
    </SafeAreaView>
  );
}

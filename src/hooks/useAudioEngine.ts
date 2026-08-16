/**
 * useAudioEngine — the single entry point for starting and stopping audio.
 *
 * Every surface in the app (NeuroHack grid, Library, Daily Rep, Tuner, the
 * mini-player) funnels through `playProtocolAndNavigate`. One function owns the
 * teardown→start→navigate sequence, so there is no way for two protocols to
 * race the engine or for a screen to navigate without actually starting audio.
 *
 * ── ORDERING: WHY NAVIGATION HAPPENS BEFORE AUDIO ──────────────────────────
 * `startAudioSession` resolves only once AVAudioEngine is actually running,
 * which is not instant. Awaiting it before navigating would leave the user
 * staring at the card they tapped for a beat or two — the exact "did that
 * work?" hesitation the 5-tab restructure is meant to remove.
 *
 * So the store update and the tab switch are synchronous, and audio is kicked
 * off immediately after. Now Playing renders from store state, which is already
 * correct, so it paints complete on first frame. If the engine then fails, we
 * roll the session back rather than leaving a screen that claims to be playing
 * silence.
 *
 * ── NAVIGATION: `navigate`, NOT `push` ─────────────────────────────────────
 * `router.push('/now-playing')` grows the history stack every time a protocol
 * is started. Start four protocols in a session and the back gesture walks
 * back through four dead Now Playing entries. `router.navigate` switches to the
 * tab and reuses the existing screen, which is what a tab bar is supposed to do
 * and what keeps the active-tab indicator in sync.
 */

import { router } from 'expo-router';
import { useCallback } from 'react';

import { breathForProgram, BREATH_PATTERNS } from '../constants/breathwork';
import { isNeuroHackId, neuroHackById } from '../constants/neurohack';
import { FOCUS_MODES, type FocusModeId } from '../constants/modes';
import type { ProgramId } from '../constants/presetUx';
import {
  setBeatGlide,
  setBreathEnvelope,
  setVolume,
  startAudioSession,
  stopAudioSession,
} from '../services/audioEngine';
import {
  NEURO_PRESETS,
  startNeuroPreset,
  stopNeuroPreset,
  type BurnoutTick,
  type NeuroPresetId,
} from '../services/audioPresets';
import { completeDailyRep, REP_DURATION_SEC } from '../services/dailyRep';
import { recordSession, type SessionSummaryData } from '../services/gamification';
import { celebrate, engagePreset, tapConfirm } from '../services/haptics';
import {
  beginSession,
  endSession,
  getSession,
  publishSummary,
  updateSession,
} from '../services/sessionStore';
import { getTailoredCardConfig } from '../services/tailoredCopy';
import { calibrate, getCachedProfile } from '../services/userProfile';

/** Any id the router can be handed from any screen. */
export type PlayableId = ProgramId | string;

type Options = {
  /** Fired with XP payload when a session ends with ≥1 minute logged. */
  onSummary?: (s: SessionSummaryData) => void;
};

export function useAudioEngine(options: Options = {}) {
  const { onSummary } = options;

  /** Full teardown. Safe to call when nothing is playing. */
  const stop = useCallback(async () => {
    const prev = getSession();
    stopNeuroPreset();
    await stopAudioSession();
    const minutes = endSession();
    if (!prev.isPlaying) return;

    // The Daily Rep only counts toward the streak if the user actually sat
    // through it. Checked here rather than in the card, because the session
    // can be ended from Now Playing or the mini-player on any other tab.
    if (prev.kind === 'daily-rep' && minutes * 60 >= REP_DURATION_SEC) {
      await completeDailyRep();
    }

    if (minutes >= 1) {
      const profile = getCachedProfile();
      const summary = await recordSession(minutes, profile?.goal ?? null);
      // Published to the store, not returned — the modal lives in the tab
      // layout, and the stop may have come from any tab's mini-player.
      publishSummary(summary);
      onSummary?.(summary);
    }
  }, [onSummary]);

  const playProtocolAndNavigate = useCallback(
    async (protocolId: PlayableId) => {
      const profile = getCachedProfile();

      // ── 1 · NeuroHack micro-states ────────────────────────────────────────
      if (isNeuroHackId(protocolId)) {
        const hack = neuroHackById(protocolId);
        if (!hack) return;
        tapConfirm();

        const breath = BREATH_PATTERNS[hack.breath];
        beginSession({
          protocolId: hack.id,
          kind: 'neurohack',
          title: hack.label,
          subtitle: hack.name,
          accent: hack.accent,
          beatHz: hack.payload.beatHz || hack.payload.amLeftHz || 10,
          carrierHz: hack.payload.carrierHz,
          breath,
          statusLine: null,
        });
        router.navigate('/now-playing');

        stopNeuroPreset();
        const p = hack.payload;
        try {
          await startAudioSession({
            carrierHz: p.carrierHz,
            beatHz: p.beatHz,
            brownNoiseEnabled: !!p.noise,
            noiseColor: p.noise,
            amLeftHz: p.amLeftHz,
            amLeftDepth: p.amLeftDepth,
            amRightHz: p.amRightHz,
            amRightDepth: p.amRightDepth,
          });
        } catch {
          await stop();
          return;
        }
        void setBreathEnvelope(breath.cycle);
        // Long descents run natively — a JS timer would stall on backgrounding
        // and strand the user at the starting frequency.
        if (p.glide) {
          const rate = Math.abs(p.glide.toHz - p.beatHz) / Math.max(1, p.glide.seconds);
          void setBeatGlide(p.glide.toHz, rate);
        }
        return;
      }

      // ── 2 · Clinical presets (self-driving phase machines) ────────────────
      const preset = NEURO_PRESETS.find((x) => x.id === protocolId);
      if (preset) {
        engagePreset();
        const breath = breathForProgram(preset.id as ProgramId);
        beginSession({
          protocolId: preset.id as ProgramId,
          kind: 'preset',
          title: preset.title,
          subtitle: preset.subtitle,
          accent: preset.accent,
          beatHz: preset.displayHz,
          carrierHz: preset.carrierHz,
          breath,
          statusLine: null,
        });
        router.navigate('/now-playing');

        await startNeuroPreset(preset.id as NeuroPresetId, {
          // Burnout sweeps through phases; mirror them into the store so the
          // Now Playing status line and mini-player stay truthful.
          onBurnoutTick: (tick: BurnoutTick) => {
            updateSession({
              beatHz: tick.beatHz,
              statusLine: `${tick.phaseLabel} · ${formatCountdown(tick.remainingSec)} remaining`,
            });
          },
          onComplete: () => { void stop(); },
        });
        void setBreathEnvelope(breath.cycle);
        return;
      }

      // ── 3 · Entrainment modes (calibrated to the user's profile) ──────────
      const mode = FOCUS_MODES.find((m) => m.id === protocolId);
      if (mode) {
        tapConfirm();
        const cal = calibrate(mode, profile);
        const breath = breathForProgram(mode.id as ProgramId);
        beginSession({
          protocolId: mode.id as ProgramId,
          kind: 'mode',
          title: mode.title,
          subtitle: mode.subtitle,
          accent: mode.accent,
          beatHz: cal.beatHz,
          carrierHz: cal.carrierHz,
          breath,
          statusLine: null,
        });
        router.navigate('/now-playing');

        stopNeuroPreset();
        try {
          await startAudioSession({
            carrierHz:         cal.carrierHz,
            beatHz:            cal.beatHz,
            brownNoiseEnabled: cal.brownNoise,
            asymmetricSMR:     cal.asymmetricSMR,
            smrHz:             cal.smrHz,
            smrDepth:          cal.smrDepth,
          });
        } catch {
          await stop();
          return;
        }
        void setVolume(cal.volume);
        void setBreathEnvelope(breath.cycle);
        if (cal.asymmetricSMR) celebrate();
        return;
      }
    },
    [stop],
  );

  /** Start the user's tailored recommendation — the idle Now Playing CTA. */
  const playTailored = useCallback(async () => {
    const tailored = getTailoredCardConfig(getCachedProfile());
    await playProtocolAndNavigate(tailored.programId);
  }, [playProtocolAndNavigate]);

  /**
   * Today's Daily Rep. Routes through the normal protocol path so it gets the
   * same telemetry, mini-player and Now Playing treatment as anything else —
   * then re-tags the session as 'daily-rep' so `stop` knows to commit the
   * streak if the full duration was served.
   */
  const playDailyRep = useCallback(
    async (programId: ProgramId) => {
      await playProtocolAndNavigate(programId);
      updateSession({ kind: 'daily-rep' });
    },
    [playProtocolAndNavigate],
  );

  return { playProtocolAndNavigate, playTailored, playDailyRep, stop };
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Legacy id for the tuner's engine claim. */
export const TUNER_SESSION_ID = 'tuner' as const;
export type { FocusModeId };

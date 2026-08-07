/**
 * Gym Mode — tri-phasic Anabolic Drive Protocol.
 *
 * Three discrete phases, each a distinct synthesis configuration. Frequency
 * sweeps are driven by the NATIVE block-level glide (setBeatGlide), not by
 * JS timers, so the ramp is sample-accurate and immune to JS-thread jitter.
 * JS only issues one call per phase transition.
 *
 * Phase I   CNS Priming     18 → 40 Hz linear over 120 s, carrier 300 Hz
 * Phase II  Peak Drive      40 Hz binaural (carrier 250 Hz)
 *                           + 40 Hz isochronic square, 1000 Hz carrier
 * Phase III Inter-Set Rest  10 → 4 Hz exponential decay, carrier 136.1 Hz
 *
 * Phase II/III are user-driven (set start / set complete), so their
 * durations are elapsed counters rather than fixed programs; only Phase I
 * and the rest countdown have nominal targets.
 */

import {
  setBeatGlide,
  setDuckExternalAudio,
  setIsochronic,
  setVolume,
  startAudioSession,
  stopAudioSession,
} from './audioEngine';

export type GymPhase = 'idle' | 'priming' | 'drive' | 'recovery';

export const PRIMING_SEC = 120;
export const REST_SEC = 180;

/** Nominal phase parameters (comments carry the physiological rationale). */
export const PHASE_SPEC = {
  priming: { carrierHz: 300,   fromHz: 18, toHz: 40, seconds: PRIMING_SEC },
  drive:   { carrierHz: 250,   beatHz: 40, isoCarrierHz: 1000, isoRateHz: 40 },
  recovery:{ carrierHz: 136.1, fromHz: 10, toHz: 4,  seconds: REST_SEC },
} as const;

// ── Phase engagement ─────────────────────────────────────────────────────────

/**
 * Enter a phase. Every call fully specifies the synthesis state, so phases
 * can be entered in any order and rapid tapping cannot leave a stale layer
 * running (e.g. the isochronic layer is explicitly zeroed outside Phase II).
 */
export async function enterPhase(phase: GymPhase): Promise<void> {
  if (phase === 'idle') {
    await stopAudioSession();
    return;
  }

  if (phase === 'priming') {
    const s = PHASE_SPEC.priming;
    await startAudioSession({ carrierHz: s.carrierHz, beatHz: s.fromHz });
    // Linear climb: (40 − 18) Hz over 120 s = 0.1833 Hz/s
    void setBeatGlide(s.toHz, (s.toHz - s.fromHz) / s.seconds, 0);
    void setIsochronic(0);
    void setDuckExternalAudio(false);
    void setVolume(0.26);
    return;
  }

  if (phase === 'drive') {
    const s = PHASE_SPEC.drive;
    await startAudioSession({ carrierHz: s.carrierHz, beatHz: s.beatHz });
    void setBeatGlide(s.beatHz, 0, 0); // hold — no glide
    // Isochronic layer sits under the binaural pair so the pulse is felt
    // without swamping the interaural difference.
    void setIsochronic(0.35, s.isoCarrierHz, s.isoRateHz, 1);
    void setDuckExternalAudio(true); // pull background media down under the set
    void setVolume(0.32);
    return;
  }

  // recovery
  const s = PHASE_SPEC.recovery;
  await startAudioSession({ carrierHz: s.carrierHz, beatHz: s.fromHz });
  // Exponential settle: tau = duration / 3 lands ~95% of the way to target
  void setBeatGlide(s.toHz, 0, s.seconds / 3);
  void setIsochronic(0);
  void setDuckExternalAudio(false); // hand the music back for the rest period
  void setVolume(0.24);
}

/** Full teardown — always safe, idempotent. */
export async function stopGym(): Promise<void> {
  void setIsochronic(0);
  void setBeatGlide(10, 0, 0);
  void setDuckExternalAudio(false);
  await stopAudioSession();
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** Instantaneous target frequency for a phase at elapsed time (display only). */
export function phaseFrequencyAt(phase: GymPhase, elapsedSec: number): number {
  if (phase === 'priming') {
    const s = PHASE_SPEC.priming;
    const t = Math.min(1, elapsedSec / s.seconds);
    return s.fromHz + (s.toHz - s.fromHz) * t;
  }
  if (phase === 'drive') return PHASE_SPEC.drive.beatHz;
  if (phase === 'recovery') {
    const s = PHASE_SPEC.recovery;
    const tau = s.seconds / 3;
    return s.toHz + (s.fromHz - s.toHz) * Math.exp(-elapsedSec / tau);
  }
  return 0;
}

export function phaseCarrier(phase: GymPhase): number {
  if (phase === 'priming') return PHASE_SPEC.priming.carrierHz;
  if (phase === 'drive') return PHASE_SPEC.drive.carrierHz;
  if (phase === 'recovery') return PHASE_SPEC.recovery.carrierHz;
  return 0;
}

/**
 * Dynamic Copywriting Matrix — hyper-personalized card copy.
 *
 * Every dashboard surface that names the user's protocol runs through
 * getTailoredCardConfig(). An athlete never sees "Pre-Exam Reset"; a
 * founder never sees crowd-noise copy.
 *
 * The full 3 arenas × 4 bottlenecks × 2 stress signatures × 2 operating
 * profiles = 48 output combinations are composed deterministically from
 * exhaustive dictionaries (TypeScript Records enforce completeness at
 * compile time — a missing combination is a build error, not a runtime
 * fallback):
 *   - 12 role×bottleneck cores (title + mechanism line)
 *   - 8 bottleneck×signature emphasis clauses
 *   - 2 operating-profile scaffolding clauses
 *
 * Legacy profiles (pre-refactor diagnostic shapes) are normalized so no
 * stored profile ever crashes or shows blank copy.
 */

import type {
  Bottleneck,
  CoreArena,
  DiagnosticAnswers,
  OperatingProfile,
  StressSignature,
} from '../constants/diagnostic';
import { PRESET_UX_DATA, type ProgramId } from '../constants/presetUx';
import type { UserProfile } from './userProfile';
import { recommendedProgramId } from './userProfile';

// ── Output shape ─────────────────────────────────────────────────────────────

export type TailoredCardConfig = {
  programId: ProgramId;
  title: string;
  /** Full composed subtitle: mechanism + stress emphasis + scaffolding. */
  subtitle: string;
  /** Mechanism-only line, for compact program-card rows. */
  cardSubtitle: string;
  targetHz: number;
  accent: string;
};

// ── Core matrix: role × bottleneck (12 hand-written entries) ────────────────

type CoreEntry = { title: string; mechanism: string };

const CORE_MATRIX: Record<Bottleneck, Record<CoreArena, CoreEntry>> = {
  anxiety: {
    athlete: {
      title: 'Pre-Match Anchor',
      mechanism: 'Left SMR gates somatic pre-game jitters. Right Alpha silences crowd noise.',
    },
    student: {
      title: 'Pre-Exam Reset',
      mechanism: 'Left SMR gates physical test anxiety. Right Alpha suppresses racing thoughts.',
    },
    'creator-founder': {
      title: 'Pressure-State Reset',
      mechanism: 'Left SMR calms execution panic. Right Alpha stabilizes cognitive overload.',
    },
  },
  fog: {
    athlete: {
      title: 'Tactical Clarity',
      mechanism: 'Bilateral 40 Hz Gamma sweeps visual-spatial networks for split-second reactions.',
    },
    student: {
      title: 'Lecturer Fog Cleanser',
      mechanism: '40 Hz ASSR clears screen exhaustion. Restores acetylcholine for maximum absorption.',
    },
    'creator-founder': {
      title: 'Deep Code Cleanse',
      mechanism: '40 Hz Gamma synchronization clears digital fatigue. Restores analytical focus.',
    },
  },
  sluggish: {
    athlete: {
      title: 'Ignition Sprint',
      mechanism: '20 Hz High-Beta burst fires the alerting network — from flat to explosive in minutes.',
    },
    student: {
      title: 'Morning Launch Protocol',
      mechanism: '20 Hz High-Beta lifts noradrenergic tone to break procrastination inertia.',
    },
    'creator-founder': {
      title: 'Cold-Start Override',
      mechanism: '20 Hz High-Beta boots the dopaminergic drive loop — zero caffeine crash.',
    },
  },
  burnout: {
    athlete: {
      title: 'Post-Comp Decompression',
      mechanism: '18→2 Hz deceleration glide downshifts an overtrained nervous system into recovery.',
    },
    student: {
      title: 'All-Nighter Recovery',
      mechanism: '18→2 Hz glide unwinds study overdrive into deep restorative delta.',
    },
    'creator-founder': {
      title: 'Founder Shutdown Sequence',
      mechanism: '18→2 Hz glide powers down sympathetic overdrive after the ship-day grind.',
    },
  },
};

// ── Stress-signature emphasis: bottleneck × signature (8 entries) ───────────

const STRESS_CLAUSE: Record<Bottleneck, Record<StressSignature, string>> = {
  anxiety: {
    somatic:   'Tuned for somatic discharge — steadying hands, jaw, and heart rate first.',
    cognitive: 'Tuned for cognitive quieting — collapsing thought loops before they cascade.',
  },
  fog: {
    somatic:   'Weighted toward body re-energization — heavy eyes and slack posture lift first.',
    cognitive: 'Weighted toward mental de-hazing — working memory clears before anything else.',
  },
  sluggish: {
    somatic:   'Biased to physical activation — priming movement before motivation.',
    cognitive: 'Biased to ideation ignition — thought velocity rises before the body follows.',
  },
  burnout: {
    somatic:   'Sequenced for muscular release — chest and shoulder tension melts through the glide.',
    cognitive: 'Sequenced for mental stand-down — rumination decays with each frequency step.',
  },
};

// ── Sensory scaffolding clause: operating profile (2 entries) ───────────────

const SCAFFOLD_CLAUSE: Record<OperatingProfile, string> = {
  neurodivergent:
    'Cyberpunk Interest Scaffolding keeps your focus anchored with a constant high-valence texture floor.',
  neurotypical:
    'Minimalist Alpha Drones eliminate distracting ambient noise with a clean, low-stimulus field.',
};

// ── Legacy-shape normalization ───────────────────────────────────────────────

/**
 * Accepts the current diagnostic shape, any legacy stored shape, or nothing,
 * and always returns a valid axis set. Defaults are the statistically safest
 * generic voice (neurotypical creator with cognitive-first fog).
 */
export function normalizeDiagnostic(raw: unknown): Pick<
  DiagnosticAnswers,
  'operatingProfile' | 'coreArena' | 'bottleneck' | 'stressSignature'
> {
  const d = (raw ?? {}) as Record<string, unknown>;

  const opRaw = d.operatingProfile ?? d.cognitiveOs;
  const operatingProfile: OperatingProfile =
    opRaw === 'neurodivergent' ? 'neurodivergent' : 'neurotypical';

  const arenaRaw = d.coreArena ?? d.arena;
  const coreArena: CoreArena =
    arenaRaw === 'athlete' || arenaRaw === 'athlete-gamer' ? 'athlete'
    : arenaRaw === 'student' ? 'student'
    : 'creator-founder'; // covers 'creator-founder', legacy 'engineer-creator' / 'professional'

  const bRaw = d.bottleneck;
  const bottleneck: Bottleneck =
    bRaw === 'anxiety' || bRaw === 'high-pressure-anxiety' ? 'anxiety'
    : bRaw === 'sluggish' ? 'sluggish'
    : bRaw === 'burnout' || bRaw === 'total-burnout' ? 'burnout'
    : 'fog'; // covers 'fog', legacy 'mid-day-fog', and missing

  const sRaw = d.stressSignature ?? d.stressResponse;
  const stressSignature: StressSignature =
    sRaw === 'somatic' || sRaw === 'anxious-restless' ? 'somatic' : 'cognitive';

  return { operatingProfile, coreArena, bottleneck, stressSignature };
}

// ── The utility ──────────────────────────────────────────────────────────────

export function getTailoredCardConfig(profile: UserProfile | null): TailoredCardConfig {
  const axes = normalizeDiagnostic(profile?.diagnostic);
  const core = CORE_MATRIX[axes.bottleneck][axes.coreArena];
  const programId = recommendedProgramId(axes.bottleneck);
  const ux = PRESET_UX_DATA[programId];

  return {
    programId,
    title: core.title,
    subtitle: [
      core.mechanism,
      STRESS_CLAUSE[axes.bottleneck][axes.stressSignature],
      SCAFFOLD_CLAUSE[axes.operatingProfile],
    ].join(' '),
    cardSubtitle: core.mechanism,
    targetHz: ux.targetHz,
    accent: ux.glow,
  };
}

/**
 * Dialed neon design tokens — pitch-black cyberpunk system.
 * Tailwind handles layout classes; these are for inline accent styling,
 * matching the existing pattern of inline style colors across the app.
 */

export const NEON = {
  bg:      '#000000',
  surface: 'rgba(255,255,255,0.045)',
  border:  'rgba(255,255,255,0.09)',
  text:    '#e8e6f3',
  muted:   '#8b8798',

  violet:  '#7c5cff',
  violetSoft: '#a78bfa',
  cyan:    '#22d3ee',
  teal:    '#5eead4',
  green:   '#4ade80',
  amber:   '#f59e0b',
  orange:  '#fb923c',
  pink:    '#f472b6',
  red:     '#f87171',
} as const;

// ── Cockpit surface system ───────────────────────────────────────────────────
// One source of truth for glass, borders and rules. Components must pull from
// here rather than re-typing rgba() values, or the system drifts card by card.

export const SURFACE = {
  /** Absolute black — OLED pixels are physically off, giving true contrast. */
  bg: '#000000',
  /** Primary card fill, sits over BlurView. */
  glass: 'rgba(18,18,22,0.75)',
  /** Recessed wells (telemetry strips, slider tracks). */
  glassDeep: 'rgba(10,10,13,0.85)',
  /** Raised elements inside a card. */
  glassRaised: 'rgba(28,28,34,0.72)',
  /** Razor-thin hairline — reads as sub-1px on 3x displays. */
  hairline: 'rgba(255,255,255,0.08)',
  /** Slightly brighter hairline for the focused/active card. */
  hairlineBright: 'rgba(255,255,255,0.14)',
  blurIntensity: 28,
} as const;

export const TYPE = {
  /** Tracked-out uppercase eyebrow. */
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 3.5 },
  /** Monospace telemetry. */
  telemetry: { fontSize: 10.5, letterSpacing: 0.6 },
} as const;

// ── Mode-specific neon accents, keyed by frequency band ──────────────────────

export const BAND_ACCENT = {
  /** SMR · Pre-Exam · Pre-Match — 12–15 Hz */
  smr: '#FFD700',      // Golden Amber
  /** Gamma 40 Hz ASSR · Screen Fog — 30 Hz+ */
  gamma: '#00E5FF',    // Cyber Cyan
  /** Beta · Energy · Training Drive — 15–30 Hz */
  beta: '#FF3B30',     // Kinetic Red
  /** Alpha · Standard Focus — 8–12 Hz */
  alpha: '#00E676',    // Emerald Field
  /** Theta · Recovery · Burnout — below 8 Hz */
  theta: '#9D00FF',    // Deep Amethyst
} as const;

export type BandKey = keyof typeof BAND_ACCENT;

/** Resolve an entrainment rate to its band. */
export function bandFor(hz: number): BandKey {
  if (hz < 8) return 'theta';
  if (hz < 12) return 'alpha';
  if (hz < 15) return 'smr';
  if (hz < 30) return 'beta';
  return 'gamma';
}

/** Resolve an entrainment rate to its accent colour. */
export function accentFor(hz: number): string {
  return BAND_ACCENT[bandFor(hz)];
}

export const BAND_LABEL: Record<BandKey, string> = {
  theta: 'THETA',
  alpha: 'ALPHA',
  smr: 'SMR',
  beta: 'BETA',
  gamma: 'GAMMA',
};

/** Alpha-suffix helper — keeps `${c}22` string math out of components. */
export function alpha(hex: string, a: number): string {
  const v = Math.max(0, Math.min(255, Math.round(a * 255)))
    .toString(16)
    .padStart(2, '0');
  return `${hex}${v}`;
}

/** Focus milestone stages — ring color evolves as the session deepens. */
export type MilestoneStage = {
  /** Seconds into the session at which this stage begins. */
  atSec: number;
  color: string;
  label: string;
};

export const MILESTONE_STAGES: MilestoneStage[] = [
  { atSec: 0,        color: NEON.amber,      label: 'Ignition' },
  { atSec: 15 * 60,  color: NEON.cyan,       label: 'Locked In' },
  { atSec: 30 * 60,  color: NEON.violetSoft, label: 'Deep Circuit' },
  { atSec: 45 * 60,  color: NEON.green,      label: 'Flow State' },
];

export function milestoneStage(elapsedSec: number): MilestoneStage {
  let stage = MILESTONE_STAGES[0];
  for (const s of MILESTONE_STAGES) {
    if (elapsedSec >= s.atSec) stage = s;
  }
  return stage;
}

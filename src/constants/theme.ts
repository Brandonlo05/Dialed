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

/**
 * Breathwork registry.
 *
 * Every program pairs its entrainment frequency with a respiratory pattern
 * chosen for the state that program is trying to reach — the breath and the
 * audio pull in the same direction instead of fighting each other.
 *
 * The governing principle is the inhale:exhale ratio.
 *   exhale LONGER than inhale  → settling, down-regulating
 *   inhale LONGER than exhale  → rousing, up-regulating
 *   inhale EQUAL to exhale     → steadying, neither
 * Holds add retention, which increases the intensity of whichever direction
 * the ratio is already pointing.
 *
 * Cycles are [inhale, inhale-hold, exhale, empty-hold] in seconds; a 0 stage
 * is skipped entirely by the pacer.
 *
 * User-facing `summary` strings use plain structure-function language. The
 * physiological reasoning lives in `rationale`, which is never rendered.
 */

import type { ProgramId } from './presetUx';

export type BreathPatternId =
  | 'coherent'
  | 'resonant'
  | 'box'
  | 'sustain'
  | 'extended-exhale'
  | 'relaxing-478'
  | 'brisk-even'
  | 'activating';

export type BreathPattern = {
  id: BreathPatternId;
  name: string;
  /** [inhale, inhale-hold, exhale, empty-hold] seconds. */
  cycle: [number, number, number, number];
  /** Shown to the user. Plain language, no clinical claims. */
  summary: string;
  /** Never rendered — the reasoning behind the ratio. */
  rationale: string;
};

export const BREATH_PATTERNS: Record<BreathPatternId, BreathPattern> = {
  coherent: {
    id: 'coherent',
    name: 'Coherent 5·5',
    cycle: [5, 0, 5, 0],
    summary: 'Even in, even out — six breaths a minute. Steadies without pushing you up or down.',
    rationale: 'Classic ~0.1 Hz coherence pacing; balanced ratio, no retention. Neutral baseline.',
  },
  resonant: {
    id: 'resonant',
    name: 'Resonant 6·6',
    cycle: [6, 0, 6, 0],
    summary: 'Slow and symmetrical. Settles attention into a long, still hold.',
    rationale: 'Five breaths/min — slower than coherent, deepens the same balanced ratio.',
  },
  box: {
    id: 'box',
    name: 'Box 4·4·4·4',
    cycle: [4, 4, 4, 4],
    summary: 'Equal count on every side. Holds you steady when the pressure is on.',
    rationale: 'Tactical breathing. Balanced ratio plus symmetric retention — alert but not escalating.',
  },
  sustain: {
    id: 'sustain',
    name: 'Sustain 5·2·5',
    cycle: [5, 2, 5, 0],
    summary: 'Even breathing with a brief hold at the top. Built for long stretches of work.',
    rationale: 'Balanced ratio with a light inhale-hold; sustains alertness across long sessions.',
  },
  'extended-exhale': {
    id: 'extended-exhale',
    name: 'Extended Exhale 4·2·8·2',
    cycle: [4, 2, 8, 2],
    summary: 'A long, slow exhale — twice the length of the inhale. The fastest way down.',
    rationale: 'Exhale 2× inhale. Strongest down-regulating ratio in the set; the wind-down default.',
  },
  'relaxing-478': {
    id: 'relaxing-478',
    name: 'Relaxing 4·7·8',
    cycle: [4, 7, 8, 0],
    summary: 'Short in, long hold, longer out. For when the nerves are already firing.',
    rationale: 'Long retention plus 2× exhale — the canonical pattern for acute pre-performance nerves.',
  },
  'brisk-even': {
    id: 'brisk-even',
    name: 'Brisk Even 4·4',
    cycle: [4, 0, 4, 0],
    summary: 'Quick and even, no holds. Clears the head without winding you down.',
    rationale: 'Balanced but faster than coherent; alerting without retention or hyperventilation.',
  },
  activating: {
    id: 'activating',
    name: 'Activating 6·2',
    cycle: [6, 0, 2, 0],
    summary: 'Long draw in, short push out. Lifts energy when you are flat.',
    rationale: 'Inhale 3× exhale — inverts the settling ratio to rouse rather than calm.',
  },
};

/**
 * Program → pattern. Exhaustive by type: adding a program without choosing a
 * breath pattern is a compile error, not a silent gap.
 */
export const PROGRAM_BREATH: Record<ProgramId, BreathPatternId> = {
  // ── Entrainment modes ──
  'standard-focus': 'coherent',      // sustained attention — steady, neutral
  'deep-lockdown':  'sustain',       // long deep-work stretches, stays alert
  'caffeine-rush':  'activating',    // flat → energised, inverted ratio
  'clutch-mode':    'box',           // pressure performance — tactical breathing

  // ── Clinical presets ──
  burnout:      'extended-exhale',   // wired-and-tired → strongest settle
  'screen-fog': 'brisk-even',        // clearing, must not sedate
  'pre-exam':   'relaxing-478',      // acute nerves → retention + long exhale
  'golden-432': 'resonant',          // slow harmonic hold
};

export function breathForProgram(id: ProgramId): BreathPattern {
  return BREATH_PATTERNS[PROGRAM_BREATH[id]];
}

/**
 * Manual Tuner has no fixed program, so its pattern is derived from the
 * chosen frequency: slower bands get settling ratios, faster bands get
 * rousing ones, mid-band gets steady.
 */
export function breathForFrequency(hz: number): BreathPattern {
  if (hz <= 4) return BREATH_PATTERNS['extended-exhale']; // delta
  if (hz <= 8) return BREATH_PATTERNS.resonant;           // theta
  if (hz <= 12) return BREATH_PATTERNS.coherent;          // alpha
  if (hz <= 15) return BREATH_PATTERNS.box;               // SMR
  if (hz <= 30) return BREATH_PATTERNS['brisk-even'];     // beta
  return BREATH_PATTERNS.activating;                      // gamma
}

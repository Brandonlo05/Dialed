/**
 * State check-in — the 2-second before/after read.
 *
 * WHY ONE AXIS, NOT A MOOD CLOUD
 * Mood has at least two dimensions (valence and arousal), but a check-in that
 * takes longer than a breath cycle will not get taken. So this is a single
 * ordered axis — cognitive readiness — which is what Dialed actually targets
 * and, critically, what can be SUBTRACTED. A before/after pair on one scale
 * yields a signed delta; a pair drawn from two different word clouds yields a
 * story you can only tell in one direction.
 *
 * WHY THE SCALE IS HONEST BOTH WAYS
 * The delta is reported as it lands, including zero and negative. An app that
 * can only ever show improvement is a mood ring, and users work that out fast.
 * A protocol that reliably shows +1 for a given user is worth far more than
 * one that always claims +3 — and the negative cases are the signal that tells
 * you which protocols to fix.
 *
 * The act of labelling a feeling is itself the most evidence-backed thing in
 * this file: affect labelling measurably reduces the intensity of a state.
 * The check-in is not just instrumentation — it is part of the intervention.
 */

export type CheckInLevel = 1 | 2 | 3 | 4 | 5;

export type CheckInOption = {
  level: CheckInLevel;
  label: string;
  icon: string;
  /** Accent for the chip when selected. */
  color: string;
};

/**
 * Ordered low → high. Words are deliberately plain and body-referenced rather
 * than clinical; "Depleted" is something a person recognises about themselves,
 * "hypoarousal" is not.
 */
export const CHECK_IN_SCALE: CheckInOption[] = [
  { level: 1, label: 'Depleted', icon: '🪫', color: '#FF3B30' },
  { level: 2, label: 'Foggy',    icon: '🌫️', color: '#fb923c' },
  { level: 3, label: 'Neutral',  icon: '•',  color: '#8b849c' },
  { level: 4, label: 'Clear',    icon: '◇',  color: '#00E676' },
  { level: 5, label: 'Sharp',    icon: '◆',  color: '#00E5FF' },
];

export function levelLabel(level: CheckInLevel | null): string {
  if (level == null) return '—';
  return CHECK_IN_SCALE.find((o) => o.level === level)?.label ?? '—';
}

export function levelColor(level: CheckInLevel | null): string {
  if (level == null) return '#8b849c';
  return CHECK_IN_SCALE.find((o) => o.level === level)?.color ?? '#8b849c';
}

/**
 * Plain-language read on the shift. Deliberately understated: a single session
 * moving someone one step is a genuinely good outcome, and overselling it here
 * is exactly the failure mode the descriptive-copy pass removed everywhere else.
 */
export function deltaSummary(before: CheckInLevel, after: CheckInLevel): string {
  const d = after - before;
  if (d >= 3) return 'Big shift.';
  if (d === 2) return 'Solid shift.';
  if (d === 1) return 'Moved a step.';
  if (d === 0) return 'Held steady.';
  if (d === -1) return 'Slipped a step.';
  return 'Went the other way.';
}

/** Signed delta, for streak stats and per-protocol effectiveness over time. */
export function delta(before: CheckInLevel, after: CheckInLevel): number {
  return after - before;
}

/**
 * Centralized haptic vocabulary — one place to tune how Dialed feels.
 * Every call is failure-tolerant: haptics must never break a flow state.
 *
 * RATE LIMITING (Taptic Engine protection)
 * ----------------------------------------
 * The Taptic Engine serializes requests. A fast slider drag can emit
 * detents far faster than the motor can render them, so the queue backs
 * up and haptics arrive *after* the thumb has moved on — the interaction
 * feels mushy and laggy, which is worse than no haptics at all.
 *
 * Continuous-gesture feedback (`tick`, `notch`) is therefore throttled to
 * a leading-edge minimum interval: the first call in a burst fires
 * immediately (so the gesture feels instant) and subsequent calls inside
 * the window are dropped, never queued. Discrete one-shot events
 * (selection, confirm, celebrate) are not throttled — they are already
 * paced by human interaction and each one carries meaning.
 */

import * as Haptics from 'expo-haptics';

// ── Leading-edge throttle ────────────────────────────────────────────────────

/** ~30 Hz ceiling: at the edge of perceptual discreteness, well under motor limits. */
const TICK_MIN_MS = 32;
/** Threshold crossings are semantically rare; guard only against double-fire. */
const NOTCH_MIN_MS = 80;

let lastTickAt = 0;
let lastNotchAt = 0;

// ── Continuous-gesture feedback (throttled) ─────────────────────────────────

/**
 * Mechanical detent tick — fired per slider increment (impactLight).
 * Throttled to TICK_MIN_MS; excess calls during a fast drag are dropped
 * rather than queued.
 */
export function tick(): void {
  const now = Date.now();
  if (now - lastTickAt < TICK_MIN_MS) return;
  lastTickAt = now;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Boundary notch — a firmer medium impact for crossing a marked threshold
 * (e.g. the 70% hearing-safety line, or a brainwave-band boundary).
 * Throttled to NOTCH_MIN_MS so a thumb hovering exactly on the boundary
 * cannot machine-gun the motor.
 */
export function notch(): void {
  const now = Date.now();
  if (now - lastNotchAt < NOTCH_MIN_MS) return;
  lastNotchAt = now;
  // A notch is the more meaningful event: let it reset the tick window so
  // a light detent cannot immediately blur the boundary cue.
  lastTickAt = now;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

// ── Discrete one-shot events (not throttled — human-paced, each meaningful) ──

/** Light tick for selecting an option / toggling. */
export function tapSelect(): void {
  Haptics.selectionAsync().catch(() => {});
}

/**
 * Rigid frequency-lock confirmation — hard, precise impact used when the
 * engine locks onto an exact-tuning state (e.g. the 432.0 Hz fundamental).
 */
export function rigidLock(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
}

/** Medium thump for confirming a step or starting a session. */
export function tapConfirm(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success bloom for session completion / level-ups. */
export function celebrate(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/**
 * Neuro-preset engagement — a distinct two-stage pattern: notification bloom
 * followed by a heavy mechanical thunk 150 ms later. Deliberate and premium.
 */
export function engagePreset(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  setTimeout(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, 150);
}

/**
 * Centralized haptic vocabulary — one place to tune how Dialed feels.
 * Every call is failure-tolerant: haptics must never break a flow state.
 */

import * as Haptics from 'expo-haptics';

/** Light tick for selecting an option / toggling. */
export function tapSelect(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Mechanical detent tick — fired per slider increment (impactLight). */
export function tick(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

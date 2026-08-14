/**
 * Entitlement layer.
 *
 * Everything in the app asks THIS module whether a feature is available —
 * never a payment SDK directly. Today it is backed by MockSubscriptionService
 * (everything unlocked, no network, no accounts). Swapping to live RevenueCat
 * is a single-file change: implement SubscriptionProvider against
 * `react-native-purchases` and reassign `subscription` at the bottom. No call
 * site changes.
 *
 * Deliberately synchronous for reads. Gating decisions happen during render,
 * and an async check there would flash unlocked content before hiding it —
 * the worst possible failure mode for a paywall. Providers cache state and
 * refresh out of band.
 */

// ── Feature surface ──────────────────────────────────────────────────────────

export type FeatureId =
  | 'core-programs'    // the tailored protocol + the free program
  | 'full-library'     // all 8 modes/presets
  | 'manual-tuner'     // freeform 1–100 Hz synthesizer
  | 'training-mode'    // tri-phasic training protocol
  | 'neuro-lab'        // diagnostic panel
  | 'breath-haptics'   // eyes-closed somatic pacing
  | 'streak-history'   // gamification history + sound vault
  | 'watch-biometrics'; // live HR/HRV adaptive audio

export const ALL_FEATURES: readonly FeatureId[] = [
  'core-programs',
  'full-library',
  'manual-tuner',
  'training-mode',
  'neuro-lab',
  'breath-haptics',
  'streak-history',
  'watch-biometrics',
] as const;

export type EntitlementState = {
  isSubscribed: boolean;
  unlockedFeatures: readonly FeatureId[];
  /** Identifier of the active plan, or null when unsubscribed. */
  planId: string | null;
  /** Provider name — surfaced in diagnostics so the source is never ambiguous. */
  source: string;
};

export interface SubscriptionProvider {
  /** Cached, synchronous — safe to call during render. */
  getState(): EntitlementState;
  isSubscribed(): boolean;
  has(feature: FeatureId): boolean;
  /** Re-fetch from the backing store. No-op for the mock. */
  refresh(): Promise<EntitlementState>;
  /** Present the paywall. No-op for the mock. */
  presentPaywall(): Promise<boolean>;
  /** Restore prior purchases. No-op for the mock. */
  restore(): Promise<EntitlementState>;
  subscribe(listener: (s: EntitlementState) => void): () => void;
}

// ── Mock provider ────────────────────────────────────────────────────────────

/**
 * Local provider used while live IAP is deferred. Everything is unlocked so
 * the full product can be evaluated without Apple accounts, agreements, or
 * network. `setOverride` exists so the paywall path can still be exercised
 * during development without shipping a real purchase flow.
 */
class MockSubscriptionService implements SubscriptionProvider {
  private state: EntitlementState = {
    isSubscribed: true,
    unlockedFeatures: ALL_FEATURES,
    planId: 'mock-unlimited',
    source: 'MockSubscriptionService',
  };

  private listeners: ((s: EntitlementState) => void)[] = [];

  getState(): EntitlementState {
    return this.state;
  }

  isSubscribed(): boolean {
    return this.state.isSubscribed;
  }

  has(feature: FeatureId): boolean {
    return this.state.unlockedFeatures.includes(feature);
  }

  async refresh(): Promise<EntitlementState> {
    return this.state;
  }

  async presentPaywall(): Promise<boolean> {
    // Nothing to present — the mock is always entitled.
    return true;
  }

  async restore(): Promise<EntitlementState> {
    return this.state;
  }

  subscribe(listener: (s: EntitlementState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Dev-only: simulate a locked account to exercise gating paths.
   * Not reachable from product UI.
   */
  setOverride(next: Partial<EntitlementState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l(this.state);
  }
}

export const mockSubscription = new MockSubscriptionService();

// ── Active provider ──────────────────────────────────────────────────────────
// SWAP POINT: replace this one line with a RevenueCatSubscriptionService
// instance to go live. Nothing else in the app needs to change.
export const subscription: SubscriptionProvider = mockSubscription;

/** Convenience for call sites that only need a boolean. */
export function hasFeature(feature: FeatureId): boolean {
  return subscription.has(feature);
}

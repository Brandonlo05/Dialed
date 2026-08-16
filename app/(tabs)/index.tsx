/**
 * `/` → NeuroHack.
 *
 * Kept as a real route (rather than deleted) so existing deep links, the
 * onboarding hand-off and any saved shortcuts still resolve instead of 404ing
 * into an empty stack. Hidden from the tab bar via `href: null` in the layout.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/neurohack" />;
}

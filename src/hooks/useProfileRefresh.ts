/**
 * Re-reads the cached calibration profile whenever the screen regains
 * focus, so recalibrating in Settings live-morphs all tailored copy on
 * return — no app restart required.
 *
 * Returns a monotonically increasing tick purely to force the re-render;
 * callers read the profile itself via `getCachedProfile()`.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useProfileRefresh(): number {
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  return tick;
}

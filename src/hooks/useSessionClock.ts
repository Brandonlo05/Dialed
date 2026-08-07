/**
 * Wall-clock session timer.
 *
 * Ticks once per second off `Date.now()` rather than accumulating interval
 * counts, so the displayed elapsed time cannot drift when the JS thread is
 * busy or the app is backgrounded. One `setState` per second — never per
 * frame — so this never competes with the UI-thread visualizer worklets.
 */

import { useEffect, useState, type RefObject } from 'react';

export function useSessionClock(isPlaying: boolean, startedAtRef: RefObject<number | null>): number {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setElapsedSec(0);
      return;
    }
    // Fire immediately so the clock never shows a stale 00:00 for a full second
    const tickNow = () => {
      if (startedAtRef.current !== null) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    tickNow();
    const interval = setInterval(tickNow, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, startedAtRef]);

  return elapsedSec;
}

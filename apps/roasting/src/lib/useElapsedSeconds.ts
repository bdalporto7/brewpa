"use client";

import { useEffect, useState } from "react";

/**
 * Recomputes from `Date.now() - startMs` on every tick rather than
 * incrementing a running counter, so a backgrounded or throttled tab
 * (where `setInterval` can silently slow way down) snaps back to the
 * correct elapsed time on its next tick instead of quietly drifting
 * behind wall-clock time.
 */
export function useElapsedSeconds(startedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const [elapsed, setElapsed] = useState(() => Math.max(0, (Date.now() - startMs) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, (Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return elapsed;
}

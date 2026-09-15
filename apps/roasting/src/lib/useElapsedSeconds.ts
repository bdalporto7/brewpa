"use client";

import { useEffect, useState } from "react";

/**
 * Recomputes from `Date.now() - startMs` on every tick rather than
 * incrementing a running counter, so a backgrounded or throttled tab
 * (where `setInterval` can silently slow way down) snaps back to the
 * correct elapsed time on its next tick instead of quietly drifting
 * behind wall-clock time.
 *
 * Confirmed live: a `Date.now()`-based lazy initializer here
 * hydration-mismatches — SSR evaluates it at request time, the client's
 * first render evaluates it again at load time, and on an active live
 * roast those two moments are far enough apart that the rendered MM:SS
 * text can actually differ. Starting at 0 and correcting from an
 * immediate mount-time effect is the same fix as everywhere else in this
 * app that's hit this: SSR and the client's first paint both render 0,
 * then this ticks to the real value a moment after mount — a normal
 * post-hydration update, not a mismatch.
 */
export function useElapsedSeconds(startedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, (Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return elapsed;
}

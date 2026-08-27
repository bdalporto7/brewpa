"use client";

import { useState } from "react";

/**
 * Local state that resets to `serverValue` whenever it changes — for a
 * value with more than one client-side control writing to the same server
 * field (e.g. LiveTimerBar's pinned fan/heat steppers and EventLogPanel's,
 * both against the same RoastEvent stream), so a change made in one place
 * shows up in the other once the server revalidates and passes down a new
 * prop, rather than each control drifting from its own frozen initial
 * value. Adjusts during render (React's documented pattern for this,
 * https://react.dev/learn/you-might-not-need-an-effect) rather than in a
 * useEffect, which would double-render and trip the
 * react-hooks/set-state-in-effect lint rule.
 */
export function useServerSyncedState<T>(serverValue: T): [T, (next: T) => void] {
  const [prevServerValue, setPrevServerValue] = useState(serverValue);
  const [value, setValue] = useState(serverValue);
  if (serverValue !== prevServerValue) {
    setPrevServerValue(serverValue);
    setValue(serverValue);
  }
  return [value, setValue];
}

"use client";

import { useEffect, useState } from "react";

export interface ProbeReading {
  id: string;
  tempFahrenheit: number;
  atSeconds: number | null;
  recordedAt: string;
  probeType: string;
}

const POLL_MS = 5000;

/**
 * Polls /api/roasts/[id]/temperature every 5s while a roast is pending or
 * live. Shared by LiveProbePanel (latest reading + connection status) and
 * LiveTipsPanel (needs the whole series to compute RoR) — both want the
 * same feed, so one poll rather than two independent ones hitting the same
 * endpoint from the same page.
 *
 * Briefly dropped to 2s alongside LiveRoastPoller's own interval — reverted
 * back for the same reason (see that component's comment): real incident,
 * 2026-09-17, database connection contention under real load. This one's
 * own query is cheap (just this session's own readings), but reverted too
 * as a conservative precaution while that incident was live.
 */
export function useProbeReadings(roastSessionId: string): ProbeReading[] | null {
  const [readings, setReadings] = useState<ProbeReading[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/roasts/${roastSessionId}/temperature`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setReadings(data.readings);
      } catch {
        // Network hiccup — next poll will retry.
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roastSessionId]);

  return readings;
}

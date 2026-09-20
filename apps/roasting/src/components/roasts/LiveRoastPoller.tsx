"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 30000;

/**
 * A slow background refresh of the page's server data while a roast is
 * live — a safety net, not how the chart stays live. The curve, forecast
 * and probe panels are driven client-side by the shared probe feed
 * (useProbeReadings, ~1s, incremental); events logged on THIS device
 * refresh the page on their own via their Server Action's revalidatePath.
 * What this catches is state changed elsewhere — an event logged from a
 * second device, say — which is worth seeing within half a minute, not
 * worth re-running the whole page (including the heavy historical-baseline
 * query) every few seconds for.
 *
 * Real incident, 2026-09-17: this used to refresh every 7s (briefly 2s),
 * and that plus several tabs and denser probe data exhausted Turso's
 * connection/transaction pool mid-roast — live fan/heat adjustments failed
 * with Prisma P2028. Pauses while the tab is hidden for the same reason:
 * background tabs shouldn't add load.
 *
 * Renders nothing — router.refresh() re-runs the page's server component
 * with fresh data without losing client-side UI state.
 */
export default function LiveRoastPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}

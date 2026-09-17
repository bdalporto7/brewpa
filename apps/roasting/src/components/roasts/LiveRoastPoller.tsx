"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 7000;

/**
 * Refreshes the page's server data every 7s while a roast is live. Without
 * this, the chart (and anything else built from `session.events`/
 * `session.temperatureReadings`) only updates when a Server Action runs —
 * i.e. only when the roaster happens to log an event — even though the
 * probe is posting new readings the whole time. LiveTipsPanel already
 * polls its own probe feed client-side (useProbeReadings) so it doesn't
 * have this problem; the chart, built server-side from page props, does.
 * Renders nothing — a router.refresh() re-runs the page's server
 * component with fresh data without losing client-side UI state.
 *
 * Real incident, 2026-09-17: this was briefly dropped to 2s so the curve
 * felt more real-time, but this page's own render does an expensive query
 * on every hit (up to 50 past completed roasts' full events +
 * temperature history, for the forecast baseline — see the isLive branch
 * above) — at 2s, combined with probe readings now landing every 1s
 * (~5x denser per roast than before) and more than one browser tab open
 * on the app at once, that was enough concurrent load to exhaust Turso's
 * connection/transaction pool mid-roast: unrelated requests (a live
 * fan/heat adjustment) started failing with Prisma P2028 ("unable to
 * start a transaction in the given time"), rendering the live controls
 * unusable. Reverted back to 7s as an immediate mitigation. If the
 * real-time feel is worth pursuing again, that baseline query needs to
 * get cheaper/less frequent first (cache it, or stop recomputing it on
 * every single poll) — not just polling faster and hoping the database
 * keeps up.
 */
export default function LiveRoastPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}

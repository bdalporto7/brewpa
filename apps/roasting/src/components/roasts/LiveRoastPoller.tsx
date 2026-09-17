"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 2000;

/**
 * Refreshes the page's server data every 2s while a roast is live. Without
 * this, the chart (and anything else built from `session.events`/
 * `session.temperatureReadings`) only updates when a Server Action runs —
 * i.e. only when the roaster happens to log an event — even though the
 * probe is posting new readings the whole time. LiveTipsPanel already
 * polls its own probe feed client-side (useProbeReadings) so it doesn't
 * have this problem; the chart, built server-side from page props, does.
 * Renders nothing — a router.refresh() re-runs the page's server
 * component with fresh data without losing client-side UI state.
 *
 * 2s (down from an original 7s) so the curve — including the live RoR
 * forecast, which has to stay anchored to the same server-fetched
 * temperature readings the drawn curve itself uses — visibly updates
 * close to as fast as the probe can actually deliver new points (1s by
 * default; see probe_bridge.py's PROBE_POST_INTERVAL). Deliberately still
 * a server round-trip rather than a client-side poll of just the readings
 * feed (the way useProbeReadings does for LiveTipsPanel): splitting the
 * chart's curve onto a faster, independent client feed while the forecast
 * stays computed server-side from a slower one would let the curve visibly
 * outrun the point the forecast ray starts from.
 */
export default function LiveRoastPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}

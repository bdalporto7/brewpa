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
 */
export default function LiveRoastPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}

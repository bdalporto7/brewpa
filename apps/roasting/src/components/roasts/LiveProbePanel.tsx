"use client";

import { useEffect, useState } from "react";
import { Thermometer } from "lucide-react";
import { useProbeReadings } from "@/lib/useProbeReadings";
import Card from "@/components/ui/Card";

const STALE_AFTER_SECONDS = 30;
const NOW_TICK_MS = 5000;

/**
 * No manual "connect a probe" step — connection is inferred entirely from
 * whether readings are actually arriving, polled (via useProbeReadings)
 * from /api/roasts/[id]/temperature. Works during setup (before startedAt
 * is set) and while live, since the ingest endpoint accepts readings
 * either way. If nothing ever shows up, this quietly stays in its empty
 * state — logging temps by hand in the panel below still works exactly as
 * before.
 */
export default function LiveProbePanel({ roastSessionId }: { roastSessionId: string }) {
  const readings = useProbeReadings(roastSessionId);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!readings || readings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted">
        <Thermometer className="h-3.5 w-3.5" />
        No probe connected — log temps by hand below, or connect one and readings will show up here
        automatically.
      </div>
    );
  }

  const latest = readings[readings.length - 1];
  const secondsSinceReading = (now - new Date(latest.recordedAt).getTime()) / 1000;
  const isLive = secondsSinceReading < STALE_AFTER_SECONDS;

  return (
    <Card interactive={false} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2">
        <Thermometer className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono text-lg font-semibold">{Math.round(latest.tempFahrenheit)}°F</span>
        <span className="text-xs text-muted">from probe · {readings.length} readings</span>
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${isLive ? "text-accent" : "text-muted"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-accent" : "bg-muted"}`} />
        {isLive ? "Connected" : "Probe quiet"}
      </span>
    </Card>
  );
}

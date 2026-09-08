"use client";

import { useEffect, useState } from "react";
import { Thermometer } from "lucide-react";
import { useProbeReadings } from "@/lib/useProbeReadings";
import Card from "@/components/ui/Card";

const STALE_AFTER_SECONDS = 30;
const NOW_TICK_MS = 5000;

/**
 * No manual "connect a probe" step for the bridge-script/bearer-token
 * path — connection is inferred entirely from whether readings are
 * actually arriving, polled (via useProbeReadings) from
 * /api/roasts/[id]/temperature. Works during setup (before startedAt is
 * set) and while live, since the ingest endpoint accepts readings either
 * way. If nothing ever shows up, this quietly stays in its empty state —
 * logging temps by hand in the panel below still works exactly as before.
 *
 * WebSerialProbeConnector (the in-browser connect button) is deliberately
 * NOT nested inside this component — confirmed live that the two return
 * branches below swap parent element types (a bare div vs a Card) the
 * instant readings.length crosses from 0 to 1, which unmounts and
 * remounts anything nested inside at exactly the moment a connection
 * starts succeeding, killing it. It's rendered once, by the roast page
 * itself, in a spot that's stable across this component's own before/
 * after states and across the pending-to-live transition.
 */
export default function LiveProbePanel({ roastSessionId }: { roastSessionId: string }) {
  const readings = useProbeReadings(roastSessionId);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Bean-only for the primary readout — a roaster with a second probe
  // channel (e.g. a Modbus-connected SF-6's environment probe, see
  // ModbusProbeConnector) posts those under a different probeType, and a
  // misconfigured ET-only feed shouldn't get mistaken for "the bean probe
  // is connected." The secondary line just below reads from every other
  // probeType in the full, unfiltered feed instead.
  const beanReadings = (readings ?? []).filter((r) => r.probeType === "bean");
  if (beanReadings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted">
        <Thermometer className="h-3.5 w-3.5" />
        No probe connected — log temps by hand below, run the bridge script, or connect one below.
      </div>
    );
  }

  const latest = beanReadings[beanReadings.length - 1];
  const secondsSinceReading = (now - new Date(latest.recordedAt).getTime()) / 1000;
  const isLive = secondsSinceReading < STALE_AFTER_SECONDS;

  // Only bean+environment exist today (see SF6_PROBES in roasters.ts), so
  // "latest of any other probeType" reduces to "latest environment
  // reading" — this doesn't bucket per-type or show more than one
  // secondary line, which is fine until a third probe type exists.
  const otherReadings = (readings ?? []).filter((r) => r.probeType !== "bean");
  const latestOther = otherReadings.length > 0 ? otherReadings[otherReadings.length - 1] : null;

  return (
    <Card interactive={false} className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Thermometer className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-lg font-semibold">{Math.round(latest.tempFahrenheit)}°F</span>
          <span className="text-xs text-muted">from probe · {beanReadings.length} readings</span>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${isLive ? "text-accent" : "text-muted"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-accent" : "bg-muted"}`} />
          {isLive ? "Connected" : "Probe quiet"}
        </span>
      </div>
      {latestOther && (
        <p className="text-xs text-muted">
          {Math.round(latestOther.tempFahrenheit)}°F {latestOther.probeType}
        </p>
      )}
    </Card>
  );
}

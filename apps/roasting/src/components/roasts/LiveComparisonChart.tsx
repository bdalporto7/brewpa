"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildLiveComparisonSvg,
  getCurveReadings,
  nearestCurveReading,
  getMilestoneEvents,
  getDialChangeEvents,
  CHART_WIDTH,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import { EVENT_LABELS } from "@/lib/constants";
import type { RoastEvent, TemperatureReading } from "@prisma/client";

export default function LiveComparisonChart({
  currentEvents,
  currentLabel,
  currentElapsedSeconds,
  comparisonEvents,
  comparisonLabel,
  comparisonTotalSeconds,
  currentProbeReadings = [],
}: {
  currentEvents: RoastEvent[];
  currentLabel: string;
  currentElapsedSeconds: number;
  comparisonEvents: RoastEvent[];
  comparisonLabel: string;
  comparisonTotalSeconds: number;
  currentProbeReadings?: TemperatureReading[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSeconds, setHoveredSeconds] = useState<number | null>(null);

  const svg = useMemo(
    () =>
      buildLiveComparisonSvg(
        currentEvents,
        currentLabel,
        currentElapsedSeconds,
        comparisonEvents,
        comparisonLabel,
        comparisonTotalSeconds,
        currentProbeReadings
      ),
    [currentEvents, currentLabel, currentElapsedSeconds, comparisonEvents, comparisonLabel, comparisonTotalSeconds, currentProbeReadings]
  );
  const readingsA = useMemo(
    () => getCurveReadings(currentEvents, currentProbeReadings),
    [currentEvents, currentProbeReadings]
  );
  const readingsB = useMemo(() => getCurveReadings(comparisonEvents), [comparisonEvents]);
  const duration = Math.max(currentElapsedSeconds, comparisonTotalSeconds, 1);

  // The chart's dashed "ghost" markers show *where* the comparison roast's
  // milestones fell, and its fan/heat dial is fixed history rather than a
  // live-changing value — both read better as plain numbers than as a
  // second set of lines squeezed into the chart, so buildLiveComparisonSvg
  // only draws the current roast's own fan/heat strip and leaves these two
  // as tables instead.
  const comparisonMilestones = useMemo(() => getMilestoneEvents(comparisonEvents), [comparisonEvents]);
  // Fan and heat in their own columns, not one merged list — two roughly
  // half-length lists side by side read faster and take less vertical room
  // than one list twice as long.
  const comparisonDialChanges = useMemo(() => getDialChangeEvents(comparisonEvents), [comparisonEvents]);
  const comparisonFanChanges = useMemo(() => comparisonDialChanges.filter((d) => d.type === "FAN"), [comparisonDialChanges]);
  const comparisonHeatChanges = useMemo(() => comparisonDialChanges.filter((d) => d.type === "HEAT"), [comparisonDialChanges]);

  if (!svg) return null;

  function updateHoverFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * CHART_WIDTH;
    const chartLeft = 44;
    const chartRight = CHART_WIDTH - 38;
    const seconds = ((svgX - chartLeft) / (chartRight - chartLeft)) * duration;
    setHoveredSeconds(Math.max(0, Math.min(duration, seconds)));
  }

  const hoveredA = hoveredSeconds != null ? nearestCurveReading(readingsA, hoveredSeconds) : null;
  const hoveredB = hoveredSeconds != null ? nearestCurveReading(readingsB, hoveredSeconds) : null;

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        onMouseMove={(e) => updateHoverFromClientX(e.clientX)}
        onMouseLeave={() => setHoveredSeconds(null)}
        onTouchStart={(e) => updateHoverFromClientX(e.touches[0].clientX)}
        onTouchMove={(e) => updateHoverFromClientX(e.touches[0].clientX)}
        onTouchEnd={() => setHoveredSeconds(null)}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {hoveredSeconds != null && (
          <div className="pointer-events-none absolute top-1 left-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md">
            <p className="font-mono font-semibold">{formatMMSS(hoveredSeconds)}</p>
            {hoveredA && (
              <p className="font-mono" style={{ color: "var(--accent)" }}>
                {Math.round(hoveredA.temp)}°F
              </p>
            )}
            {hoveredB && (
              <p className="font-mono" style={{ color: "var(--ror)" }}>
                {Math.round(hoveredB.temp)}°F
              </p>
            )}
          </div>
        )}
      </div>
      {(comparisonMilestones.length > 0 || comparisonFanChanges.length > 0 || comparisonHeatChanges.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-border pt-3 sm:grid-cols-3">
          {comparisonMilestones.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">{comparisonLabel} — milestones</p>
              <table className="text-xs">
                <tbody>
                  {comparisonMilestones.map((m) => (
                    <tr key={m.type}>
                      <td className="py-0.5 pr-4">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: m.color }}
                        />
                        {EVENT_LABELS[m.type]}
                      </td>
                      <td className="py-0.5 text-right font-mono text-muted">{formatMMSS(m.atSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {comparisonFanChanges.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">{comparisonLabel} — fan</p>
              <table className="text-xs">
                <tbody>
                  {comparisonFanChanges.map((d, i) => (
                    <tr key={`fan-${d.atSeconds}-${i}`}>
                      <td className="py-0.5 pr-4">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: "var(--ror)" }}
                        />
                        → {d.level}
                      </td>
                      <td className="py-0.5 text-right font-mono text-muted">{formatMMSS(d.atSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {comparisonHeatChanges.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">{comparisonLabel} — heat</p>
              <table className="text-xs">
                <tbody>
                  {comparisonHeatChanges.map((d, i) => (
                    <tr key={`heat-${d.atSeconds}-${i}`}>
                      <td className="py-0.5 pr-4">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: "var(--foreground)" }}
                        />
                        → {d.level}
                      </td>
                      <td className="py-0.5 text-right font-mono text-muted">{formatMMSS(d.atSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

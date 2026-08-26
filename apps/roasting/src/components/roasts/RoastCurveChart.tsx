"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildRoastCurveSvg,
  getCurveReadings,
  getChartLayout,
  nearestCurveReading,
  CHART_WIDTH,
  CHART_HEIGHT,
  type CurveReading,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import type { RoastEvent, TemperatureReading } from "@prisma/client";

export default function RoastCurveChart({
  events,
  totalSeconds,
  probeReadings = [],
}: {
  events: RoastEvent[];
  totalSeconds: number;
  probeReadings?: TemperatureReading[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<CurveReading | null>(null);
  const [showRor, setShowRor] = useState(false);

  const svg = useMemo(
    () => buildRoastCurveSvg(events, totalSeconds, { showRor, probeReadings }),
    [events, totalSeconds, showRor, probeReadings]
  );
  const readings = useMemo(() => getCurveReadings(events, probeReadings), [events, probeReadings]);
  const layout = useMemo(
    () => (readings.length > 0 ? getChartLayout(readings, totalSeconds) : null),
    [readings, totalSeconds]
  );

  if (!svg || !layout) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Log at least two temperature readings during a roast to see its curve here.
      </p>
    );
  }

  function updateHoverFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el || !layout) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * CHART_WIDTH;
    const seconds = ((svgX - layout.chartLeft) / (layout.chartRight - layout.chartLeft)) * layout.duration;
    setHovered(nearestCurveReading(readings, seconds));
  }

  const crosshairX = hovered ? layout.x(hovered.atSeconds) : 0;
  const leftPct = hovered ? (crosshairX / CHART_WIDTH) * 100 : 0;
  const anchor = leftPct < 15 ? "left" : leftPct > 85 ? "right" : "center";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowRor((v) => !v)}
          aria-pressed={showRor}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
          style={
            showRor
              ? {
                  borderColor: "var(--ror)",
                  color: "var(--ror)",
                  background: "color-mix(in srgb, var(--ror) 14%, transparent)",
                }
              : { borderColor: "var(--border)", color: "var(--muted)" }
          }
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ror)" }} />
          Rate of rise
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onMouseMove={(e) => updateHoverFromClientX(e.clientX)}
          onMouseLeave={() => setHovered(null)}
          onTouchStart={(e) => updateHoverFromClientX(e.touches[0].clientX)}
          onTouchMove={(e) => updateHoverFromClientX(e.touches[0].clientX)}
          onTouchEnd={() => setHovered(null)}
        >
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {hovered && (
            <>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="roast-curve-svg pointer-events-none absolute inset-0"
              >
                <line
                  x1={crosshairX}
                  x2={crosshairX}
                  y1={layout.tempChartTop}
                  y2={layout.stripBottom}
                  style={{ stroke: "var(--foreground)" }}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle
                  cx={crosshairX}
                  cy={layout.yTemp(hovered.temp)}
                  r={4.5}
                  style={{ fill: "var(--accent)", stroke: "var(--surface)" }}
                  strokeWidth={1.5}
                />
                {showRor && hovered.rorPerMin != null && (
                  <circle
                    cx={crosshairX}
                    cy={layout.yRor(hovered.rorPerMin)}
                    r={4.5}
                    style={{ fill: "var(--ror)", stroke: "var(--surface)" }}
                    strokeWidth={1.5}
                  />
                )}
              </svg>
              <div
                className="pointer-events-none absolute top-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
                style={{
                  left: `${leftPct}%`,
                  transform:
                    anchor === "center" ? "translateX(-50%)" : anchor === "right" ? "translateX(-100%)" : undefined,
                }}
              >
                <p className="font-mono font-semibold">{formatMMSS(hovered.atSeconds)}</p>
                <p className="font-mono text-muted">{Math.round(hovered.temp)}°F</p>
                {showRor && (
                  <p className="font-mono" style={{ color: "var(--ror)" }}>
                    {hovered.rorPerMin != null ? `${Math.round(hovered.rorPerMin)}°F/min` : "—"}
                  </p>
                )}
                <p className="text-muted">
                  Fan {hovered.fanLevel ?? "—"} · Heat {hovered.heatLevel ?? "—"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

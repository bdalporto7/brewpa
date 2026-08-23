"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildRoastCurveSvg,
  getCurveReadings,
  getChartLayout,
  CHART_WIDTH,
  CHART_HEIGHT,
  type CurveReading,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import type { RoastEvent } from "@prisma/client";

function nearestReading(readings: CurveReading[], atSeconds: number): CurveReading {
  let best = readings[0];
  let bestDist = Math.abs(best.atSeconds - atSeconds);
  for (const r of readings) {
    const d = Math.abs(r.atSeconds - atSeconds);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
}

export default function RoastCurveChart({
  events,
  totalSeconds,
}: {
  events: RoastEvent[];
  totalSeconds: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<CurveReading | null>(null);

  const svg = useMemo(() => buildRoastCurveSvg(events, totalSeconds), [events, totalSeconds]);
  const readings = useMemo(() => getCurveReadings(events), [events]);
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
    setHovered(nearestReading(readings, seconds));
  }

  const crosshairX = hovered ? layout.x(hovered.atSeconds) : 0;
  const leftPct = hovered ? (crosshairX / CHART_WIDTH) * 100 : 0;
  const anchor = leftPct < 15 ? "left" : leftPct > 85 ? "right" : "center";

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
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
              <p className="text-muted">
                Fan {hovered.fanLevel ?? "—"} · Heat {hovered.heatLevel ?? "—"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

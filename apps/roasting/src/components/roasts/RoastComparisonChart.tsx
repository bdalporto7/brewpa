"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildComparisonCurveSvg,
  getChartLayout,
  nearestCurveReading,
  CHART_WIDTH,
  CHART_HEIGHT,
  type CurveReading,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";

/**
 * The curve markup itself comes back as a raw SVG string from
 * `buildComparisonCurveSvg` and is injected via `dangerouslySetInnerHTML`,
 * so the interactive crosshair/tooltip can't live inside that same SVG tree
 * — it's a second, absolutely-positioned `<svg>` stacked on top. It only
 * lines up with the injected markup because it recomputes the exact same
 * `getChartLayout`/`CHART_WIDTH`/`CHART_HEIGHT` coordinates the string
 * builder used; if that layout math ever changes, both sides need to change
 * together.
 */
export default function RoastComparisonChart({
  readingsA,
  labelA,
  readingsB,
  labelB,
}: {
  readingsA: CurveReading[];
  labelA: string;
  readingsB: CurveReading[];
  labelB: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSeconds, setHoveredSeconds] = useState<number | null>(null);

  const svg = useMemo(
    () => buildComparisonCurveSvg(readingsA, labelA, readingsB, labelB),
    [readingsA, labelA, readingsB, labelB]
  );
  const totalSeconds = useMemo(
    () => Math.max(readingsA[readingsA.length - 1]?.atSeconds ?? 0, readingsB[readingsB.length - 1]?.atSeconds ?? 0),
    [readingsA, readingsB]
  );
  const layout = useMemo(
    () => getChartLayout([...readingsA, ...readingsB], totalSeconds),
    [readingsA, readingsB, totalSeconds]
  );

  if (!svg) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        One of these roasts doesn&apos;t have enough logged temperature readings to chart.
      </p>
    );
  }

  function updateHoverFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * CHART_WIDTH;
    const seconds = ((svgX - layout.chartLeft) / (layout.chartRight - layout.chartLeft)) * layout.duration;
    setHoveredSeconds(Math.max(0, Math.min(layout.duration, seconds)));
  }

  const hoveredA = hoveredSeconds != null ? nearestCurveReading(readingsA, hoveredSeconds) : null;
  const hoveredB = hoveredSeconds != null ? nearestCurveReading(readingsB, hoveredSeconds) : null;
  const crosshairX = hoveredSeconds != null ? layout.x(hoveredSeconds) : 0;
  const leftPct = hoveredSeconds != null ? (crosshairX / CHART_WIDTH) * 100 : 0;
  const anchor = leftPct < 15 ? "left" : leftPct > 85 ? "right" : "center";

  return (
    <Card interactive={false} className="overflow-x-auto p-4">
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
          <>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="roast-curve-svg pointer-events-none absolute inset-0">
              <line
                x1={crosshairX}
                x2={crosshairX}
                y1={layout.tempChartTop}
                y2={layout.tempChartBottom}
                style={{ stroke: "var(--foreground)" }}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              {hoveredA && (
                <circle
                  cx={layout.x(hoveredA.atSeconds)}
                  cy={layout.yTemp(hoveredA.temp)}
                  r={4.5}
                  style={{ fill: "var(--accent)", stroke: "var(--surface)" }}
                  strokeWidth={1.5}
                />
              )}
              {hoveredB && (
                <circle
                  cx={layout.x(hoveredB.atSeconds)}
                  cy={layout.yTemp(hoveredB.temp)}
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
                transform: anchor === "center" ? "translateX(-50%)" : anchor === "right" ? "translateX(-100%)" : undefined,
              }}
            >
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
          </>
        )}
      </div>
    </Card>
  );
}

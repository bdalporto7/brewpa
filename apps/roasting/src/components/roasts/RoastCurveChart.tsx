"use client";

import { useMemo, useRef, useState } from "react";
import { LineChart, ChevronDown } from "lucide-react";
import {
  buildRoastCurveSvg,
  getCurveReadings,
  getChartLayout,
  nearestCurveReading,
  CHART_WIDTH,
  CHART_HEIGHT,
  type CurveReading,
  type RoastCurveTargets,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import type { RoastEvent, TemperatureReading } from "@prisma/client";

export default function RoastCurveChart({
  events,
  totalSeconds,
  probeReadings = [],
  targets,
  title,
  collapsible = false,
  defaultCollapsed = false,
}: {
  events: RoastEvent[];
  totalSeconds: number;
  probeReadings?: TemperatureReading[];
  /** Accepted AI-plan targets (AiSuggestionPanel) — rendered as ghosted
   * dashed reference lines alongside the actual curve. Only meaningful for
   * the live view; a completed roast doesn't pass this. */
  targets?: RoastCurveTargets;
  /** When given, renders a labeled header INSIDE the chart's own bordered
   * box (completed-roast view) instead of leaving the "Rate of rise"
   * toggle floating in its own unboxed row above it (the live view's
   * existing look, unchanged when this is omitted). Also the signal this
   * component uses to draw the curve in on mount rather than showing it
   * complete — see the animateIn comment on buildRoastCurveSvg for why
   * that's scoped away from the live view specifically. */
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<CurveReading | null>(null);
  const [showRor, setShowRor] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  const svg = useMemo(
    // animateIn tracks `title`: the same signal RoastCurveChart's own
    // callers already use to mean "this is the completed-roast view," not
    // the live one — see this component's `title` doc comment above.
    () => buildRoastCurveSvg(events, totalSeconds, { showRor, probeReadings, targets, animateIn: !!title }),
    [events, totalSeconds, showRor, probeReadings, targets, title]
  );
  const readings = useMemo(() => getCurveReadings(events, probeReadings), [events, probeReadings]);
  const layout = useMemo(
    () => (readings.length > 0 ? getChartLayout(readings, totalSeconds) : null),
    [readings, totalSeconds]
  );

  const rorToggle = (
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
  );

  const titleHeader = title && (
    <div className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={() => collapsible && setCollapsed((v) => !v)}
        disabled={!collapsible}
        className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
      >
        <LineChart className="h-3.5 w-3.5" />
        {title}
        {collapsible && (
          <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        )}
      </button>
      {!collapsed && rorToggle}
    </div>
  );

  if (!svg || !layout) {
    const emptyState = (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Log at least two temperature readings during a roast to see its curve here.
      </p>
    );
    if (!title) return emptyState;
    return (
      <Card interactive={false} className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <LineChart className="h-3.5 w-3.5" />
          {title}
        </div>
        <div className="mt-3">{emptyState}</div>
      </Card>
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

  const chartContent = (
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
              y2={layout.tempChartBottom}
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
  );

  if (title) {
    return (
      <Card interactive={false} className="p-4">
        {titleHeader}
        {!collapsed && <div className="overflow-x-auto">{chartContent}</div>}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">{rorToggle}</div>
      <Card interactive={false} className="overflow-x-auto p-4">
        {chartContent}
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { LineChart, ChevronDown } from "lucide-react";
import {
  buildRoastCurveSvg,
  getCurveReadings,
  getEnvTempPoints,
  getChartLayout,
  nearestCurveReading,
  phaseClassifier,
  PHASE_STYLES,
  CHART_WIDTH,
  type CurveReading,
  type RorLayout,
  type RoastCurveTargets,
  type RoastCurveForecast,
  type ProbePoint,
} from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import type { RoasterControl } from "@/lib/roasters";
import type { RoastEvent } from "@prisma/client";

export default function RoastCurveChart({
  events,
  totalSeconds,
  controls,
  probeReadings = [],
  envProbeReadings = [],
  targets,
  forecast,
  title,
  collapsible = false,
  defaultCollapsed = false,
}: {
  events: RoastEvent[];
  totalSeconds: number;
  controls: RoasterControl[];
  probeReadings?: ProbePoint[];
  /** Exhaust/environment probe readings (Artisan's "ET") — drawn as a
   * second, thinner line on the same temp axis when there are at least
   * two. Only ever populated today by an Artisan import; empty for a
   * hand-logged or single-probe live roast. */
  envProbeReadings?: ProbePoint[];
  /** Accepted AI-plan targets (AiSuggestionPanel) — rendered as ghosted
   * dashed reference lines alongside the actual curve. Only meaningful for
   * the live view; a completed roast doesn't pass this. */
  targets?: RoastCurveTargets;
  /** Live RoR-extrapolated forecast (src/lib/tips.ts's computeLiveForecast)
   * — only meaningful for the live view; a completed roast doesn't pass
   * this (no live RoR left to project from). No toggle, unlike RoR: it's
   * already self-limiting (absent whenever the same guards that gate the
   * underlying projection aren't satisfied), so there's nothing to hide. */
  forecast?: RoastCurveForecast;
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
  // Two panels by default; some viewers prefer RoR drawn over the temp curve.
  // Remembered per browser (a viewer convenience, not shared state).
  // Read in the initializer: RoR starts off, so nothing rendered on first
  // paint depends on this and server/client markup still match.
  const [rorLayout, setRorLayout] = useState<RorLayout>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("roastCurveRorLayout") === "overlay"
        ? "overlay"
        : "panel";
    } catch {
      return "panel";
    }
  });
  function chooseRorLayout(next: RorLayout) {
    setRorLayout(next);
    try {
      localStorage.setItem("roastCurveRorLayout", next);
    } catch {}
  }
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  const svg = useMemo(
    // animateIn tracks `title`: the same signal RoastCurveChart's own
    // callers already use to mean "this is the completed-roast view," not
    // the live one — see this component's `title` doc comment above.
    () =>
      buildRoastCurveSvg(events, totalSeconds, controls, {
        showRor,
        probeReadings,
        envProbeReadings,
        targets,
        forecast,
        animateIn: !!title,
        rorLayout,
      }),
    [events, totalSeconds, controls, showRor, probeReadings, envProbeReadings, targets, forecast, title, rorLayout]
  );
  const readings = useMemo(() => getCurveReadings(events, probeReadings, controls), [events, probeReadings, controls]);
  const envTempPoints = useMemo(
    () => getEnvTempPoints(envProbeReadings, events.find((e) => e.type === "DROP")?.atSeconds),
    [envProbeReadings, events]
  );
  const layout = useMemo(
    () =>
      readings.length > 0
        ? getChartLayout(
            readings,
            totalSeconds,
            envTempPoints.map((p) => p.temp),
            showRor && rorLayout === "panel"
          )
        : null,
    [readings, totalSeconds, envTempPoints, showRor, rorLayout]
  );

  // Same phase boundaries the curve itself is colored by (null until
  // DRY_END is logged — the curve stays one plain color then, so there's
  // nothing to label either).
  const classifyPhase = useMemo(() => phaseClassifier(events), [events]);
  const phaseLegend = useMemo(() => {
    if (!classifyPhase) return [];
    const present = new Set(readings.map((r) => classifyPhase(r.atSeconds)));
    return PHASE_STYLES.filter((s) => present.has(s.key));
  }, [classifyPhase, readings]);
  const hoveredPhase =
    hovered && classifyPhase ? PHASE_STYLES.find((s) => s.key === classifyPhase(hovered.atSeconds)) : undefined;

  const phaseKey =
    phaseLegend.length > 0 || envTempPoints.length >= 2 ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {phaseLegend.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-4 rounded-sm border"
              style={{ background: `color-mix(in srgb, ${s.color} 30%, transparent)`, borderColor: s.color }}
            />
            {s.label}
          </span>
        ))}
        {envTempPoints.length >= 2 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: "var(--mark-dry-end)" }} />
            Exhaust temp
          </span>
        )}
      </div>
    ) : null;

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

  const rorControls = (
    <div className="flex items-center gap-2">
      {showRor && (
        <div role="group" aria-label="Rate of rise layout" className="inline-flex overflow-hidden rounded-full border border-border text-xs font-medium">
          {(
            [
              ["panel", "Separate"],
              ["overlay", "Overlay"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseRorLayout(value)}
              aria-pressed={rorLayout === value}
              className="px-2.5 py-1 transition"
              style={
                rorLayout === value
                  ? { background: "color-mix(in srgb, var(--ror) 14%, transparent)", color: "var(--ror)" }
                  : { color: "var(--muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {rorToggle}
    </div>
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
      {!collapsed && rorControls}
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

  // Nearest exhaust-temp reading to the hovered instant, if there's an ET
  // series at all — same snap-to-nearest rule as the bean-temp tooltip.
  let hoveredEnvTemp: number | null = null;
  if (hovered && envTempPoints.length > 0) {
    let best = envTempPoints[0];
    for (const p of envTempPoints) {
      if (Math.abs(p.atSeconds - hovered.atSeconds) < Math.abs(best.atSeconds - hovered.atSeconds)) best = p;
    }
    hoveredEnvTemp = best.temp;
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
            viewBox={`0 0 ${CHART_WIDTH} ${layout.height}`}
            className="roast-curve-svg pointer-events-none absolute inset-0"
          >
            {[
              [layout.tempChartTop, layout.tempChartBottom],
              ...(layout.rorPanelTop != null && layout.rorPanelBottom != null
                ? [[layout.rorPanelTop, layout.rorPanelBottom]]
                : []),
            ].map(([top, bottom]) => (
              <line
                key={top}
                x1={crosshairX}
                x2={crosshairX}
                y1={top}
                y2={bottom}
                style={{ stroke: "var(--foreground)" }}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            ))}
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
            {hoveredPhase && (
              <p className="font-medium" style={{ color: hoveredPhase.color }}>
                {hoveredPhase.label}
              </p>
            )}
            <p className="font-mono text-muted">
              {hoveredEnvTemp != null ? "BT " : ""}
              {Math.round(hovered.temp)}°F
            </p>
            {hoveredEnvTemp != null && (
              <p className="font-mono text-muted">ET {Math.round(hoveredEnvTemp)}°F</p>
            )}
            {showRor && (
              <p className="font-mono" style={{ color: "var(--ror)" }}>
                {hovered.rorPerMin != null ? `${Math.round(hovered.rorPerMin)}°F/min` : "—"}
              </p>
            )}
            <p className="text-muted">
              {controls.map((c) => `${c.label} ${hovered.controlLevels[c.key] ?? "—"}`).join(" · ")}
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
        {!collapsed && phaseKey && <div className="mb-2">{phaseKey}</div>}
        {!collapsed && <div className="overflow-x-auto">{chartContent}</div>}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {phaseKey ?? <span />}
        {rorControls}
      </div>
      <Card interactive={false} className="overflow-x-auto p-4">
        {chartContent}
      </Card>
    </div>
  );
}

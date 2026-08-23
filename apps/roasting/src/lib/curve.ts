import { formatMMSS } from "@/lib/format";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, type EventType } from "@/lib/constants";
import type { RoastEvent } from "@prisma/client";

export const CHART_WIDTH = 760;
export const CHART_HEIGHT = 380;
export const CHART_MARGIN_LEFT = 44;
// Wide enough for the rate-of-rise axis's tick labels, kept constant whether
// or not RoR is currently toggled on so showing/hiding it never reflows the
// chart.
const MARGIN_RIGHT = 38;
const MARGIN_TOP = 20;
const AXIS_HEIGHT = 24;
const STRIP_HEIGHT = 48;
const STRIP_GAP = 16;

const MILESTONE_MARKERS: { type: EventType; label: string; color: string }[] = [
  { type: "DRY_END", label: "DE", color: "var(--mark-dry-end)" },
  { type: "YELLOWING_END", label: "YE", color: "var(--mark-yellowing-end)" },
  { type: "FIRST_CRACK_START", label: "1C", color: "var(--mark-first-crack)" },
  { type: "FIRST_CRACK_END", label: "1C end", color: "var(--mark-first-crack)" },
  { type: "SECOND_CRACK_START", label: "2C", color: "var(--mark-second-crack)" },
  { type: "SECOND_CRACK_END", label: "2C end", color: "var(--mark-second-crack)" },
];

export interface CurveReading {
  atSeconds: number;
  temp: number;
  fanLevel: number | null;
  heatLevel: number | null;
  /** °F/min since the previous reading; null for the first (no prior point to measure from). */
  rorPerMin: number | null;
}

function levelAt(points: { atSeconds: number; level: number }[], atSeconds: number): number | null {
  let level: number | null = null;
  for (const p of points) {
    if (p.atSeconds > atSeconds) break;
    level = p.level;
  }
  return level;
}

/**
 * Real logged temperature readings (never interpolated), each paired with
 * whichever fan/heat level was active at that same instant. This is both
 * what buildRoastCurveSvg plots and what the live chart's hover tooltip
 * snaps to — one function, so hovering can never show a value the curve
 * itself didn't draw. Empty (rather than a single point) below two
 * readings, matching the ">= 2 to draw a curve" gate everywhere else.
 */
export function getCurveReadings(events: RoastEvent[]): CurveReading[] {
  const tempPoints = events
    .filter((e) => e.type === "TEMP" && e.tempFahrenheit != null)
    .map((e) => ({ atSeconds: e.atSeconds, temp: e.tempFahrenheit as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  if (tempPoints.length < 2) return [];

  const fanPoints = events
    .filter((e) => e.type === "FAN" && e.fanLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.fanLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  const heatPoints = events
    .filter((e) => e.type === "HEAT" && e.heatLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.heatLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  return tempPoints.map((p, i) => {
    let rorPerMin: number | null = null;
    if (i > 0) {
      const prev = tempPoints[i - 1];
      const minutesElapsed = (p.atSeconds - prev.atSeconds) / 60;
      if (minutesElapsed > 0) rorPerMin = (p.temp - prev.temp) / minutesElapsed;
    }
    return {
      atSeconds: p.atSeconds,
      temp: p.temp,
      fanLevel: levelAt(fanPoints, p.atSeconds),
      heatLevel: levelAt(heatPoints, p.atSeconds),
      rorPerMin,
    };
  });
}

export interface ChartLayout {
  chartLeft: number;
  chartRight: number;
  tempChartTop: number;
  tempChartBottom: number;
  stripTop: number;
  stripBottom: number;
  minTemp: number;
  maxTemp: number;
  minRor: number;
  maxRor: number;
  duration: number;
  x: (seconds: number) => number;
  yTemp: (temp: number) => number;
  yLevel: (level: number) => number;
  yRor: (rorPerMin: number) => number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function rorPercentileRange(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  return [percentile(sorted, 0.05), percentile(sorted, 0.95)];
}

/**
 * All the pixel-mapping math buildRoastCurveSvg uses to draw, exposed so
 * the live chart's hover overlay (RoastCurveChart.tsx) can compute the same
 * coordinates without duplicating — and risking drift from — this logic.
 */
export function getChartLayout(readings: CurveReading[], totalSeconds: number): ChartLayout {
  const duration = readings.length === 0 ? Math.max(totalSeconds, 1) : Math.max(totalSeconds, readings[readings.length - 1].atSeconds, 1);

  const rawMin = Math.min(...readings.map((p) => p.temp));
  const rawMax = Math.max(...readings.map((p) => p.temp));
  const minTemp = Math.floor((rawMin - 15) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + 15) / 25) * 25;

  // Percentile, not true min/max: two readings logged close together (most
  // often the first couple, before intervals settle into a rhythm) can spike
  // to a RoR far outside the rest of the roast and, using a true max, drag
  // the whole axis out with it — one point that reads as "off the chart"
  // would otherwise squash every other point into a sliver at the bottom.
  // The point itself still plots (and clips at the frame if it's still off
  // this trimmed range); it just doesn't get to set the scale everyone else
  // has to live in.
  const rorValues = readings.map((p) => p.rorPerMin).filter((v): v is number => v != null);
  const [rawMinRor, rawMaxRor] = rorPercentileRange(rorValues);
  const minRor = Math.floor((rawMinRor - 5) / 10) * 10;
  const maxRor = Math.ceil((rawMaxRor + 5) / 10) * 10;

  const chartLeft = CHART_MARGIN_LEFT;
  const chartRight = CHART_WIDTH - MARGIN_RIGHT;
  const chartWidth = chartRight - chartLeft;
  const tempChartTop = MARGIN_TOP;
  const tempChartHeight = CHART_HEIGHT - MARGIN_TOP - AXIS_HEIGHT - STRIP_HEIGHT - STRIP_GAP;
  const tempChartBottom = tempChartTop + tempChartHeight;
  const stripTop = tempChartBottom + STRIP_GAP;
  const stripBottom = stripTop + STRIP_HEIGHT;

  const x = (seconds: number) => chartLeft + (seconds / duration) * chartWidth;
  const yTemp = (temp: number) =>
    tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * tempChartHeight;
  const yLevel = (level: number) =>
    stripTop + (1 - (level - SR800_LEVEL_MIN) / (SR800_LEVEL_MAX - SR800_LEVEL_MIN)) * STRIP_HEIGHT;
  const yRor = (rorPerMin: number) =>
    tempChartTop + (1 - (rorPerMin - minRor) / (maxRor - minRor)) * tempChartHeight;

  return {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    stripTop,
    stripBottom,
    minTemp,
    maxTemp,
    minRor,
    maxRor,
    duration,
    x,
    yTemp,
    yLevel,
    yRor,
  };
}

function buildStepPath(
  points: { atSeconds: number; level: number }[],
  totalSeconds: number,
  x: (s: number) => number,
  y: (level: number) => number
): string {
  if (points.length === 0) return "";
  let path = `M ${x(points[0].atSeconds)} ${y(points[0].level)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${x(points[i].atSeconds)} ${y(points[i - 1].level)} L ${x(points[i].atSeconds)} ${y(points[i].level)}`;
  }
  path += ` L ${x(totalSeconds)} ${y(points[points.length - 1].level)}`;
  return path;
}

/**
 * Renders the roasting curve as a raw SVG markup string — shared by the live
 * React chart (via dangerouslySetInnerHTML) and the static published page,
 * so both stay pixel-identical. Colors reference the app's CSS custom
 * properties by name; the caller must define them (globals.css does this in
 * the app, the static page inlines its own copy).
 */
export function buildRoastCurveSvg(
  events: RoastEvent[],
  totalSeconds: number,
  options: { showRor?: boolean } = {}
): string | null {
  const readings = getCurveReadings(events);
  if (readings.length < 2) return null;

  const layout = getChartLayout(readings, totalSeconds);
  const {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    stripTop,
    stripBottom,
    minTemp,
    maxTemp,
    minRor,
    maxRor,
    duration,
    x,
    yTemp,
    yLevel,
    yRor,
  } = layout;

  const tempLine = readings.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");

  const tempTicks = [minTemp, (minTemp + maxTemp) / 2, maxTemp];
  const timeTickCount = duration > 600 ? 6 : 4;
  const timeTicks = Array.from({ length: timeTickCount + 1 }, (_, i) => (duration / timeTickCount) * i);

  const fanPoints = events
    .filter((e) => e.type === "FAN" && e.fanLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.fanLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  const heatPoints = events
    .filter((e) => e.type === "HEAT" && e.heatLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.heatLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  const markers = MILESTONE_MARKERS.map((m) => ({
    ...m,
    event: events.find((e) => e.type === m.type),
  })).filter((m) => m.event);
  const dropEvent = events.find((e) => e.type === "DROP");

  const parts: string[] = [];

  parts.push(
    `<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" class="roast-curve-svg" role="img" aria-label="Roasting curve">`
  );

  for (const t of tempTicks) {
    parts.push(
      `<line x1="${chartLeft}" x2="${chartRight}" y1="${yTemp(t)}" y2="${yTemp(t)}" style="stroke:var(--border)" stroke-width="1" />`,
      `<text x="${chartLeft - 8}" y="${yTemp(t)}" text-anchor="end" dominant-baseline="middle" style="fill:var(--muted)" class="mono-10">${Math.round(t)}°</text>`
    );
  }

  for (const t of timeTicks) {
    parts.push(
      `<text x="${x(t)}" y="${tempChartBottom + AXIS_HEIGHT + STRIP_HEIGHT + STRIP_GAP - 6}" text-anchor="middle" style="fill:var(--muted)" class="mono-10">${formatMMSS(t)}</text>`
    );
  }

  for (const m of markers) {
    if (!m.event) continue;
    parts.push(
      `<line x1="${x(m.event.atSeconds)}" x2="${x(m.event.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${m.color}" stroke-width="1.5" stroke-dasharray="3 3" />`,
      `<text x="${x(m.event.atSeconds)}" y="${tempChartTop - 6}" text-anchor="middle" style="fill:${m.color}" class="marker-label">${m.label}</text>`
    );
  }

  if (dropEvent) {
    parts.push(
      `<line x1="${x(dropEvent.atSeconds)}" x2="${x(dropEvent.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:var(--mark-drop)" stroke-width="1.5" />`
    );
  }

  parts.push(
    `<polyline points="${tempLine}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" />`
  );
  for (const p of readings) {
    parts.push(`<circle cx="${x(p.atSeconds)}" cy="${yTemp(p.temp)}" r="2.5" style="fill:var(--accent)" />`);
  }

  if (options.showRor) {
    const rorTicks = [minRor, (minRor + maxRor) / 2, maxRor];
    for (const t of rorTicks) {
      parts.push(
        `<text x="${chartRight + 8}" y="${yRor(t)}" text-anchor="start" dominant-baseline="middle" style="fill:var(--ror)" class="mono-10">${Math.round(t)}</text>`
      );
    }
    parts.push(
      `<text x="${chartRight}" y="${tempChartTop - 6}" text-anchor="end" style="fill:var(--ror)" class="marker-label">°F/min</text>`
    );
    if (minRor < 0 && maxRor > 0) {
      parts.push(
        `<line x1="${chartLeft}" x2="${chartRight}" y1="${yRor(0)}" y2="${yRor(0)}" style="stroke:var(--ror)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4" />`
      );
    }
    const rorPoints = readings.filter((p): p is CurveReading & { rorPerMin: number } => p.rorPerMin != null);
    const rorLine = rorPoints.map((p) => `${x(p.atSeconds)},${yRor(p.rorPerMin)}`).join(" ");
    parts.push(
      `<polyline points="${rorLine}" fill="none" style="stroke:var(--ror)" stroke-width="1.75" stroke-linejoin="round" />`
    );
  }

  parts.push(
    `<text x="${chartLeft}" y="${stripTop - 6}" style="fill:var(--muted)" class="marker-label">Fan</text>`,
    `<text x="${chartLeft + 28}" y="${stripTop - 6}" style="fill:var(--foreground);opacity:0.6" class="marker-label">Heat</text>`
  );
  if (fanPoints.length > 0) {
    parts.push(
      `<path d="${buildStepPath(fanPoints, duration, x, yLevel)}" fill="none" style="stroke:var(--accent);opacity:0.7" stroke-width="1.5" />`
    );
  }
  if (heatPoints.length > 0) {
    parts.push(
      `<path d="${buildStepPath(heatPoints, duration, x, yLevel)}" fill="none" style="stroke:var(--foreground);opacity:0.35" stroke-width="1.5" />`
    );
  }
  parts.push(
    `<line x1="${chartLeft}" x2="${chartRight}" y1="${stripBottom}" y2="${stripBottom}" style="stroke:var(--border)" stroke-width="1" />`
  );

  parts.push("</svg>");

  return parts.join("");
}

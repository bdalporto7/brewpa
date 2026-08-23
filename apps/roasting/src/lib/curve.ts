import { formatMMSS } from "@/lib/format";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, type EventType } from "@/lib/constants";
import type { RoastEvent } from "@prisma/client";

const WIDTH = 760;
const HEIGHT = 380;
const MARGIN_LEFT = 44;
const MARGIN_RIGHT = 16;
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
export function buildRoastCurveSvg(events: RoastEvent[], totalSeconds: number): string | null {
  const tempPoints = events
    .filter((e) => e.type === "TEMP" && e.tempFahrenheit != null)
    .map((e) => ({ atSeconds: e.atSeconds, temp: e.tempFahrenheit as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  if (tempPoints.length < 2) return null;

  const duration = Math.max(totalSeconds, tempPoints[tempPoints.length - 1].atSeconds, 1);

  const rawMin = Math.min(...tempPoints.map((p) => p.temp));
  const rawMax = Math.max(...tempPoints.map((p) => p.temp));
  const minTemp = Math.floor((rawMin - 15) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + 15) / 25) * 25;

  const chartLeft = MARGIN_LEFT;
  const chartRight = WIDTH - MARGIN_RIGHT;
  const chartWidth = chartRight - chartLeft;
  const tempChartTop = MARGIN_TOP;
  const tempChartHeight = HEIGHT - MARGIN_TOP - AXIS_HEIGHT - STRIP_HEIGHT - STRIP_GAP;
  const tempChartBottom = tempChartTop + tempChartHeight;
  const stripTop = tempChartBottom + STRIP_GAP;
  const stripBottom = stripTop + STRIP_HEIGHT;

  const x = (seconds: number) => chartLeft + (seconds / duration) * chartWidth;
  const yTemp = (temp: number) =>
    tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * tempChartHeight;
  const yLevel = (level: number) =>
    stripTop + (1 - (level - SR800_LEVEL_MIN) / (SR800_LEVEL_MAX - SR800_LEVEL_MIN)) * STRIP_HEIGHT;

  const tempLine = tempPoints.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");

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
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="roast-curve-svg" role="img" aria-label="Roasting curve">`
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
  for (const p of tempPoints) {
    parts.push(`<circle cx="${x(p.atSeconds)}" cy="${yTemp(p.temp)}" r="2.5" style="fill:var(--accent)" />`);
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

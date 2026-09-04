import { formatMMSS } from "@/lib/format";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, type EventType } from "@/lib/constants";
import type { RoastEvent, TemperatureReading } from "@prisma/client";

export const CHART_WIDTH = 760;
export const CHART_HEIGHT = 380;
export const CHART_MARGIN_LEFT = 44;
// Wide enough for the rate-of-rise axis's tick labels, kept constant whether
// or not RoR is currently toggled on so showing/hiding it never reflows the
// chart.
const MARGIN_RIGHT = 38;
// 20 was enough room for one row of milestone labels above the chart; a
// live roast with an accepted AI plan can now stack a second "target" row
// above the actual-milestone row at the same x position (see
// buildRoastCurveSvg's targets handling) when the two land close in time —
// bumped for all charts rather than adding a second margin constant, since
// 10px more headroom is a negligible, safe change everywhere else too.
const MARGIN_TOP = 30;
const AXIS_HEIGHT = 24;

export const MILESTONE_MARKERS: { type: EventType; label: string; color: string }[] = [
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
 *
 * probeReadings (from a connected temperature probe, TemperatureReading
 * rows) take over the temp/RoR line entirely once there are at least two
 * of them — a probe logs every few seconds, so it's always denser and
 * more accurate than hand-logged TEMP events, and mixing the two would
 * produce a jagged, doubled-up line. Fan/heat/milestones stay event-
 * sourced regardless, since a bean-temp probe doesn't know about those.
 */
// A fluid-bed roaster's probe reads a blend of true bean temp and the
// hot airflow that's tumbling the beans past it — every fan/heat change
// shows up in the reading almost immediately, faster than a bean's real
// thermal mass could actually respond, which shows up as noisy point-to-
// point jitter in raw RoR. Smoothing over a short trailing window (not a
// fixed point-count — see below) damps that jitter the way a physically
// thicker BT probe would, without needing different hardware. This never
// touches the *displayed* temp (still the raw reading), only the values
// RoR is computed from.
const ROR_SMOOTHING_WINDOW_SECONDS = 15;

/** Time-windowed, not count-windowed: dense probe data (~5s cadence) gets a
 * real 3ish-point average, while sparse hand-logged points spaced further
 * apart than the window naturally fall back to using just that one point —
 * averaging across widely-spaced manual readings would blend unrelated
 * moments together, not smooth noise. */
function smoothedTempAt(points: { atSeconds: number; temp: number }[], i: number): number {
  const windowStart = points[i].atSeconds - ROR_SMOOTHING_WINDOW_SECONDS;
  let sum = 0;
  let count = 0;
  for (let j = i; j >= 0 && points[j].atSeconds > windowStart; j--) {
    sum += points[j].temp;
    count++;
  }
  return count > 0 ? sum / count : points[i].temp;
}

export function getCurveReadings(
  events: RoastEvent[],
  probeReadings: Pick<TemperatureReading, "atSeconds" | "tempFahrenheit">[] = []
): CurveReading[] {
  const probePoints = probeReadings
    .filter((r): r is typeof r & { atSeconds: number } => r.atSeconds != null)
    .map((r) => ({ atSeconds: r.atSeconds, temp: r.tempFahrenheit }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  const tempPoints =
    probePoints.length >= 2
      ? probePoints
      : events
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
      if (minutesElapsed > 0) {
        rorPerMin = (smoothedTempAt(tempPoints, i) - smoothedTempAt(tempPoints, i - 1)) / minutesElapsed;
      }
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

/**
 * The nearest real reading to a given elapsed time — shared by the hover
 * tooltip (RoastCurveChart.tsx) and the live golden-roast comparison
 * (tips.ts), so both "closest logged point to right now" lookups use the
 * same rule. Callers guarantee readings is non-empty.
 */
export function nearestCurveReading(readings: CurveReading[], atSeconds: number): CurveReading {
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

export interface ChartLayout {
  chartLeft: number;
  chartRight: number;
  tempChartTop: number;
  tempChartBottom: number;
  minTemp: number;
  maxTemp: number;
  minRor: number;
  maxRor: number;
  duration: number;
  x: (seconds: number) => number;
  yTemp: (temp: number) => number;
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
  const tempChartHeight = CHART_HEIGHT - MARGIN_TOP - AXIS_HEIGHT;
  const tempChartBottom = tempChartTop + tempChartHeight;

  const x = (seconds: number) => chartLeft + (seconds / duration) * chartWidth;
  const yTemp = (temp: number) =>
    tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * tempChartHeight;
  const yRor = (rorPerMin: number) =>
    tempChartTop + (1 - (rorPerMin - minRor) / (maxRor - minRor)) * tempChartHeight;

  return {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    minTemp,
    maxTemp,
    minRor,
    maxRor,
    duration,
    x,
    yTemp,
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
 * Renders the roasting curve as a raw SVG markup string rather than JSX —
 * `RoastCurveChart` injects it via dangerouslySetInnerHTML and memoizes it,
 * so the (potentially large) markup only regenerates when the underlying
 * data actually changes, not on every render. Colors reference the app's
 * CSS custom properties by name; globals.css defines them.
 */
/** Accepted-plan target milestones (src/lib/roastAdvisor.ts's RoastPlan,
 * via AiSuggestionPanel's "Accept plan") — same shape as RoastPlanTargets,
 * duplicated here rather than imported to keep curve.ts independent of the
 * AI module (curve.ts is reused in more places than just the AI flow). */
export interface RoastCurveTargets {
  dryEndSeconds?: number;
  yellowingEndSeconds?: number;
  firstCrackSeconds?: number;
  developmentSeconds?: number;
  dropTempF?: number;
}

export function buildRoastCurveSvg(
  events: RoastEvent[],
  totalSeconds: number,
  options: {
    showRor?: boolean;
    probeReadings?: TemperatureReading[];
    targets?: RoastCurveTargets;
    /** Draws the temp line in on mount instead of appearing complete —
     * scoped to the completed-roast view only (RoastCurveChart passes this
     * when it renders with `title`). The live view's chart regenerates on
     * every polled event, and replaying a multi-second draw-in on each
     * poll would be distracting rather than delightful, so it's opt-in
     * rather than the default. */
    animateIn?: boolean;
  } = {}
): string | null {
  const readings = getCurveReadings(events, options.probeReadings);
  if (readings.length < 2) return null;

  // Extend the axis to cover the furthest target time too — otherwise a
  // live chart's x-axis only spans elapsed-time-so-far, and every upcoming
  // target milestone (which is the whole point of showing them) sits
  // off-screen to the right until the actual roast catches up to it.
  const t = options.targets;
  const latestTarget = t
    ? Math.max(
        t.dryEndSeconds ?? 0,
        t.yellowingEndSeconds ?? 0,
        t.firstCrackSeconds ?? 0,
        t.firstCrackSeconds != null && t.developmentSeconds != null
          ? t.firstCrackSeconds + t.developmentSeconds
          : 0
      )
    : 0;
  const layout = getChartLayout(readings, Math.max(totalSeconds, latestTarget));
  const {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    minTemp,
    maxTemp,
    minRor,
    maxRor,
    duration,
    x,
    yTemp,
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
      `<text x="${x(t)}" y="${tempChartBottom + AXIS_HEIGHT - 6}" text-anchor="middle" style="fill:var(--muted)" class="mono-10">${formatMMSS(t)}</text>`
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

  // Accepted AI-plan targets — ghosted (low opacity, finer dash) so they
  // read as "aim for here" reference lines rather than competing with the
  // actual, solid-dashed milestones once they're actually logged. Same
  // color per milestone type as the real thing, labeled with a trailing
  // "→" to keep them visually distinct even where a color repeats.
  if (options.targets) {
    const t = options.targets;
    const targetLines: { atSeconds: number | undefined; label: string; color: string }[] = [
      { atSeconds: t.dryEndSeconds, label: "DE→", color: "var(--mark-dry-end)" },
      { atSeconds: t.yellowingEndSeconds, label: "YE→", color: "var(--mark-yellowing-end)" },
      { atSeconds: t.firstCrackSeconds, label: "1C→", color: "var(--mark-first-crack)" },
    ];
    // A one-time legend rather than lengthening every individual label
    // (which at this chart's 9px marker-label size would start colliding
    // with its neighbors) — anchored top-left, a spot no target is ever
    // placed at since none of them land at t=0.
    parts.push(
      `<line x1="${chartLeft}" x2="${chartLeft + 12}" y1="${tempChartTop - 16}" y2="${tempChartTop - 16}" style="stroke:var(--muted)" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.7" />`,
      `<text x="${chartLeft + 16}" y="${tempChartTop - 16}" dominant-baseline="middle" style="fill:var(--muted)" class="mono-10">= AI plan target</text>`
    );
    for (const target of targetLines) {
      if (target.atSeconds == null) continue;
      parts.push(
        `<line x1="${x(target.atSeconds)}" x2="${x(target.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${target.color}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.55" />`,
        // -16 rather than the actual-milestone labels' -6: stacks the
        // "target" label above the "actual" one instead of colliding when
        // the two times land close together, which is exactly the common
        // case early in a roast that's tracking its plan well.
        `<text x="${x(target.atSeconds)}" y="${tempChartTop - 16}" text-anchor="middle" style="fill:${target.color}" class="marker-label" opacity="0.7">${target.label}</text>`
      );
    }
    if (t.firstCrackSeconds != null && t.developmentSeconds != null) {
      const targetDrop = t.firstCrackSeconds + t.developmentSeconds;
      parts.push(
        `<line x1="${x(targetDrop)}" x2="${x(targetDrop)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:var(--mark-drop)" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.55" />`,
        `<text x="${x(targetDrop)}" y="${tempChartTop - 16}" text-anchor="middle" style="fill:var(--mark-drop)" class="marker-label" opacity="0.7">Drop→${t.dropTempF != null ? ` ${t.dropTempF}°` : ""}</text>`
      );
    }
  }

  // filter, not a redrawn path: the sketchy-fine wobble (same filter every
  // other hand-drawn line in the app uses) is a couple px of visual
  // displacement only — the underlying points, and everything that reads
  // them (hover tooltip, hit-testing), are untouched. pathLength="1" is
  // only meaningful with the draw-in animation (globals.css's
  // .curve-draw-in, gated on animateIn) — harmless to always include, and
  // simpler than branching the whole polyline string on it.
  parts.push(
    `<polyline points="${tempLine}" pathLength="1" ${options.animateIn ? 'class="curve-draw-in"' : ""} fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" filter="url(#sketchy-fine)" />`
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

  // Fan/heat changes plotted directly on the temp curve, not as a separate
  // strip below it: a small triangle at the exact time of each change,
  // pointing up for an increase and down for a decrease, colored per dial
  // (fan = accent, heat = muted foreground, matching their old strip
  // colors). Reading the exact dial value at any moment is already covered
  // by the hover tooltip (RoastCurveChart.tsx shows fan/heat for whatever
  // point you're hovering) and by EventTimeline's precise table below the
  // chart — this only needs to answer "when did something change and which
  // way," at a glance, without a whole second scaled axis competing with
  // the temp curve for attention. Fan and heat stack at different offsets
  // (10px vs 18px above the curve) so a simultaneous change on both dials
  // shows as two distinct marks instead of one hiding the other.
  function dialChangeMarkers(
    points: { atSeconds: number; level: number }[],
    color: string,
    opacity: number,
    offset: number,
    label: string
  ): void {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      if (cur.level === prev.level) continue;
      const cx = x(cur.atSeconds);
      const cy = yTemp(nearestCurveReading(readings, cur.atSeconds).temp) - offset;
      const up = cur.level > prev.level;
      const trianglePoints = up
        ? `${cx},${cy - 4} ${cx - 4},${cy + 4} ${cx + 4},${cy + 4}`
        : `${cx - 4},${cy - 4} ${cx + 4},${cy - 4} ${cx},${cy + 4}`;
      parts.push(
        `<polygon points="${trianglePoints}" style="fill:${color}" opacity="${opacity}"><title>${label} ${prev.level}→${cur.level} at ${formatMMSS(cur.atSeconds)}</title></polygon>`
      );
    }
  }
  dialChangeMarkers(fanPoints, "var(--accent)", 1, 10, "Fan");
  dialChangeMarkers(heatPoints, "var(--foreground)", 0.7, 18, "Heat");

  parts.push("</svg>");

  return parts.join("");
}

/** Bean names/labels are user text embedded straight into an SVG string rendered via dangerouslySetInnerHTML — the one place in this file that needed it, since every other label here is a fixed string or a formatted number. */
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Two roasts' temp curves on one shared axis — reuses getChartLayout by
 * feeding it both readings arrays concatenated (only used there for
 * min/max, so this naturally spans whichever roast ran hotter/longer) and
 * the longer of the two durations. Deliberately narrower than
 * buildRoastCurveSvg: no milestones, no fan/heat strip — two of those
 * overlaid would be unreadable, and "did this one run hotter/faster than
 * that one" is the actual question a comparison is for.
 */
export function buildComparisonCurveSvg(
  readingsA: CurveReading[],
  labelA: string,
  readingsB: CurveReading[],
  labelB: string
): string | null {
  if (readingsA.length < 2 || readingsB.length < 2) return null;

  const totalSeconds = Math.max(readingsA[readingsA.length - 1].atSeconds, readingsB[readingsB.length - 1].atSeconds);
  const layout = getChartLayout([...readingsA, ...readingsB], totalSeconds);
  const { chartLeft, chartRight, tempChartBottom, minTemp, maxTemp, duration, x, yTemp } = layout;

  const lineA = readingsA.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");
  const lineB = readingsB.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");

  const tempTicks = [minTemp, (minTemp + maxTemp) / 2, maxTemp];
  const timeTickCount = duration > 600 ? 6 : 4;
  const timeTicks = Array.from({ length: timeTickCount + 1 }, (_, i) => (duration / timeTickCount) * i);
  const axisY = tempChartBottom + 20;
  const legendY1 = tempChartBottom + 40;
  const legendY2 = tempChartBottom + 56;
  // Two full roast labels (bean + date, sometimes identical bean names for
  // both sides of a same-bean comparison) reliably don't fit side by side —
  // stacked rows plus a hard truncation are both needed, not either alone.
  const truncate = (s: string, max = 50) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

  const parts: string[] = [];
  parts.push(`<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" class="roast-curve-svg" role="img" aria-label="Roast comparison">`);

  for (const t of tempTicks) {
    parts.push(
      `<line x1="${chartLeft}" x2="${chartRight}" y1="${yTemp(t)}" y2="${yTemp(t)}" style="stroke:var(--border)" stroke-width="1" />`,
      `<text x="${chartLeft - 8}" y="${yTemp(t)}" text-anchor="end" dominant-baseline="middle" style="fill:var(--muted)" class="mono-10">${Math.round(t)}°</text>`
    );
  }
  for (const t of timeTicks) {
    parts.push(
      `<text x="${x(t)}" y="${axisY}" text-anchor="middle" style="fill:var(--muted)" class="mono-10">${formatMMSS(t)}</text>`
    );
  }

  // B drawn first, dashed and cooler-toned, so A (the roast being viewed) reads as the primary line on top.
  parts.push(
    `<polyline points="${lineB}" fill="none" style="stroke:var(--ror)" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" />`,
    `<polyline points="${lineA}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" />`
  );

  parts.push(
    `<line x1="${chartLeft}" x2="${chartLeft + 18}" y1="${legendY1}" y2="${legendY1}" style="stroke:var(--accent)" stroke-width="2.5" />`,
    `<text x="${chartLeft + 24}" y="${legendY1}" dominant-baseline="middle" style="fill:var(--foreground)" class="mono-10">${escapeXml(truncate(labelA))}</text>`,
    `<line x1="${chartLeft}" x2="${chartLeft + 18}" y1="${legendY2}" y2="${legendY2}" style="stroke:var(--ror)" stroke-width="2.5" stroke-dasharray="6 4" />`,
    `<text x="${chartLeft + 24}" y="${legendY2}" dominant-baseline="middle" style="fill:var(--foreground)" class="mono-10">${escapeXml(truncate(labelB))}</text>`
  );

  parts.push("</svg>");

  return parts.join("");
}

const LIVE_CMP_HEIGHT = 320;
const LIVE_CMP_MARGIN_TOP = 20;
const LIVE_CMP_TEMP_HEIGHT = 190;
const LIVE_CMP_STRIP_HEIGHT = 32;

function eventPoints(events: RoastEvent[], type: "FAN" | "HEAT") {
  return events
    .filter((e) => e.type === type && (type === "FAN" ? e.fanLevel : e.heatLevel) != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: (type === "FAN" ? e.fanLevel : e.heatLevel) as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
}

/** A roast's milestone events, sorted by time — LiveComparisonChart tables these for the comparison roast instead of drawing a second set of dashed lines on the chart. */
export function getMilestoneEvents(
  events: RoastEvent[]
): { type: EventType; label: string; color: string; atSeconds: number }[] {
  return MILESTONE_MARKERS.flatMap((m) => {
    const event = events.find((e) => e.type === m.type);
    return event ? [{ ...m, atSeconds: event.atSeconds }] : [];
  }).sort((a, b) => a.atSeconds - b.atSeconds);
}

/** A roast's fan/heat dial changes, sorted by time — same reasoning as getMilestoneEvents: "at 2:15, heat -> 7" reads better as a table row than as a second step-line squeezed into a small strip. */
export function getDialChangeEvents(events: RoastEvent[]): { type: "FAN" | "HEAT"; level: number; atSeconds: number }[] {
  return [
    ...eventPoints(events, "FAN").map((p) => ({ type: "FAN" as const, ...p })),
    ...eventPoints(events, "HEAT").map((p) => ({ type: "HEAT" as const, ...p })),
  ].sort((a, b) => a.atSeconds - b.atSeconds);
}

/**
 * Overlays this roast's live curve against a chosen past one — picked
 * during setup (RoastSession.compareToId) — including milestones and the
 * *current* roast's own fan/heat dial (the one still changing, worth a
 * live step-line). The comparison roast's fan/heat and milestones are
 * fixed, already-known history, and read better as plain numbers than as a
 * second step-line squeezed into a small strip (tried first, and a step
 * chart doesn't answer "what time exactly" at a glance) — LiveComparisonChart
 * renders those as tables from getMilestoneEvents/getDialChangeEvents
 * instead of drawing them here.
 */
export function buildLiveComparisonSvg(
  currentEvents: RoastEvent[],
  currentLabel: string,
  currentElapsedSeconds: number,
  comparisonEvents: RoastEvent[],
  comparisonLabel: string,
  comparisonTotalSeconds: number,
  currentProbeReadings: TemperatureReading[] = []
): string | null {
  const readingsA = getCurveReadings(currentEvents, currentProbeReadings);
  const readingsB = getCurveReadings(comparisonEvents);
  if (readingsA.length < 2 || readingsB.length < 2) return null;

  const duration = Math.max(currentElapsedSeconds, comparisonTotalSeconds, 1);
  const allTemps = [...readingsA, ...readingsB].map((p) => p.temp);
  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  const minTemp = Math.floor((rawMin - 15) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + 15) / 25) * 25;

  const chartLeft = CHART_MARGIN_LEFT;
  const chartRight = CHART_WIDTH - MARGIN_RIGHT;
  const tempChartTop = LIVE_CMP_MARGIN_TOP;
  const tempChartBottom = tempChartTop + LIVE_CMP_TEMP_HEIGHT;
  const axisY = tempChartBottom + 18;
  // +22 (not the ~10 you'd expect from the strip height alone) because the
  // strip's own "This roast — Fan / Heat" label sits at stripATop - 6, only
  // a few px under the time-axis tick text at axisY — tighter than this and
  // the two text rows overlap (seen live: "0:00" collided with the label).
  const stripATop = axisY + 22;
  const stripABottom = stripATop + LIVE_CMP_STRIP_HEIGHT;
  const legendY1 = stripABottom + 20;
  const legendY2 = legendY1 + 16;

  const x = (seconds: number) => chartLeft + (seconds / duration) * (chartRight - chartLeft);
  const yTemp = (temp: number) => tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * LIVE_CMP_TEMP_HEIGHT;
  const yLevelA = (level: number) =>
    stripATop + (1 - (level - SR800_LEVEL_MIN) / (SR800_LEVEL_MAX - SR800_LEVEL_MIN)) * LIVE_CMP_STRIP_HEIGHT;

  const truncate = (s: string, max = 46) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

  const tempTicks = [minTemp, (minTemp + maxTemp) / 2, maxTemp];
  const timeTickCount = duration > 600 ? 6 : 4;
  const timeTicks = Array.from({ length: timeTickCount + 1 }, (_, i) => (duration / timeTickCount) * i);

  const parts: string[] = [];
  parts.push(`<svg viewBox="0 0 ${CHART_WIDTH} ${LIVE_CMP_HEIGHT}" class="roast-curve-svg" role="img" aria-label="Live roast comparison">`);

  for (const t of tempTicks) {
    parts.push(
      `<line x1="${chartLeft}" x2="${chartRight}" y1="${yTemp(t)}" y2="${yTemp(t)}" style="stroke:var(--border)" stroke-width="1" />`,
      `<text x="${chartLeft - 8}" y="${yTemp(t)}" text-anchor="end" dominant-baseline="middle" style="fill:var(--muted)" class="mono-10">${Math.round(t)}°</text>`
    );
  }
  for (const t of timeTicks) {
    parts.push(
      `<text x="${x(t)}" y="${axisY}" text-anchor="middle" style="fill:var(--muted)" class="mono-10">${formatMMSS(t)}</text>`
    );
  }

  // Comparison roast's milestones: dashed, muted — a ghost of when things happened last time.
  for (const m of MILESTONE_MARKERS) {
    const event = comparisonEvents.find((e) => e.type === m.type);
    if (!event) continue;
    parts.push(
      `<line x1="${x(event.atSeconds)}" x2="${x(event.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${m.color}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.55" />`
    );
  }
  // Current roast's milestones: solid, on top, labeled — the ones that just happened.
  for (const m of MILESTONE_MARKERS) {
    const event = currentEvents.find((e) => e.type === m.type);
    if (!event) continue;
    parts.push(
      `<line x1="${x(event.atSeconds)}" x2="${x(event.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${m.color}" stroke-width="1.5" stroke-dasharray="3 3" />`,
      `<text x="${x(event.atSeconds)}" y="${tempChartTop - 6}" text-anchor="middle" style="fill:${m.color}" class="marker-label">${m.label}</text>`
    );
  }

  const lineA = readingsA.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");
  const lineB = readingsB.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");
  parts.push(
    `<polyline points="${lineB}" fill="none" style="stroke:var(--ror)" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" />`,
    `<polyline points="${lineA}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" />`
  );
  for (const p of readingsA) {
    parts.push(`<circle cx="${x(p.atSeconds)}" cy="${yTemp(p.temp)}" r="2.5" style="fill:var(--accent)" />`);
  }

  parts.push(
    `<text x="${chartLeft}" y="${stripATop - 6}" style="fill:var(--muted)" class="marker-label">Fan</text>`,
    `<text x="${chartLeft + 28}" y="${stripATop - 6}" style="fill:var(--foreground);opacity:0.6" class="marker-label">Heat</text>`
  );
  const fanA = eventPoints(currentEvents, "FAN");
  const heatA = eventPoints(currentEvents, "HEAT");
  if (fanA.length > 0) {
    parts.push(`<path d="${buildStepPath(fanA, currentElapsedSeconds, x, yLevelA)}" fill="none" style="stroke:var(--accent);opacity:0.7" stroke-width="1.5" />`);
  }
  if (heatA.length > 0) {
    parts.push(`<path d="${buildStepPath(heatA, currentElapsedSeconds, x, yLevelA)}" fill="none" style="stroke:var(--foreground);opacity:0.35" stroke-width="1.5" />`);
  }
  parts.push(`<line x1="${chartLeft}" x2="${chartRight}" y1="${stripABottom}" y2="${stripABottom}" style="stroke:var(--border)" stroke-width="1" />`);

  parts.push(
    `<line x1="${chartLeft}" x2="${chartLeft + 18}" y1="${legendY1}" y2="${legendY1}" style="stroke:var(--accent)" stroke-width="2.5" />`,
    `<text x="${chartLeft + 24}" y="${legendY1}" dominant-baseline="middle" style="fill:var(--foreground)" class="mono-10">${escapeXml(truncate(currentLabel))}</text>`,
    `<line x1="${chartLeft}" x2="${chartLeft + 18}" y1="${legendY2}" y2="${legendY2}" style="stroke:var(--ror)" stroke-width="2.5" stroke-dasharray="6 4" />`,
    `<text x="${chartLeft + 24}" y="${legendY2}" dominant-baseline="middle" style="fill:var(--foreground)" class="mono-10">${escapeXml(truncate(comparisonLabel))}</text>`
  );

  parts.push("</svg>");

  return parts.join("");
}

/** One dial-schedule entry, merging a fan and/or heat change that happened
 * at the same instant into a single row — the shape a RoastProfile's saved
 * plan needs (see profile-actions.ts's saveProfileFromCompletedRoast).
 * Deliberately its own literal type here, not imported from
 * RoastPlanSettingChange (roastAdvisor.ts) — same independence reasoning as
 * RoastCurveTargets above. */
export interface PlanSettingChange {
  atSeconds: number;
  fanLevel?: number;
  heatLevel?: number;
}

/** Same duplication reasoning, extending RoastCurveTargets with the one
 * field that isn't a chart axis (weight loss is a plan target, not
 * something buildRoastCurveSvg draws a line for). */
export interface PlanTargets extends RoastCurveTargets {
  targetWeightLossPercent?: number;
}

/**
 * getDialChangeEvents returns one row per dial per change — right for a
 * display table, wrong for a plan, where a fan+heat change made together
 * (e.g. the charge settings at atSeconds 0) needs to be one entry. Merges
 * by exact matching atSeconds.
 */
export function buildSettingChangesFromEvents(events: RoastEvent[]): PlanSettingChange[] {
  const fanPoints = eventPoints(events, "FAN");
  const heatPoints = eventPoints(events, "HEAT");
  const allTimes = [...new Set([...fanPoints.map((p) => p.atSeconds), ...heatPoints.map((p) => p.atSeconds)])].sort(
    (a, b) => a - b
  );

  return allTimes.map((atSeconds) => {
    const fan = fanPoints.find((p) => p.atSeconds === atSeconds);
    const heat = heatPoints.find((p) => p.atSeconds === atSeconds);
    const entry: PlanSettingChange = { atSeconds };
    if (fan) entry.fanLevel = fan.level;
    if (heat) entry.heatLevel = heat.level;
    return entry;
  });
}

/**
 * Per-dial matching between a plan's schedule and what actually happened,
 * used by computeAdjustedPlan below. Two things it deliberately does NOT
 * do: it doesn't require the roaster's actual steps to land on the same
 * index as the plan's (a forward search for the planned *value*, not a
 * positional comparison, so taking smaller/extra intermediate steps than
 * the plan doesn't itself look like a divergence) — and past that, it only
 * flags real divergence when the roast's most recent move on this dial
 * went the opposite direction from where the plan still wants it to go,
 * not merely "hasn't gotten there yet."
 */
function matchDialTrack(
  plannedTrack: { atSeconds: number; level: number }[],
  actualTrack: { atSeconds: number; level: number }[]
): { drift: number | null; driftAtSeconds: number | null; divergedAtSeconds: number | null } {
  if (plannedTrack.length === 0 || actualTrack.length === 0) {
    return { drift: null, driftAtSeconds: null, divergedAtSeconds: null };
  }

  let drift: number | null = null;
  let driftAtSeconds: number | null = null;
  let matchedLevel: number | null = null;
  let searchFrom = 0;
  let nextPlannedIdx = 0;
  let divergedAtSeconds: number | null = null;

  matching: for (; nextPlannedIdx < plannedTrack.length; nextPlannedIdx++) {
    const planned = plannedTrack[nextPlannedIdx];
    const foundIdx = actualTrack.findIndex((a, idx) => idx >= searchFrom && a.level === planned.level);
    if (foundIdx === -1) break; // hasn't reached this planned value yet (or ever) — stop matching further ahead

    // A forward search for the exact planned value (rather than a strict
    // positional comparison) tolerates the roaster taking smaller or extra
    // intermediate steps than the plan — but on its own it can miss a real
    // divergence that later "circles back" to the expected value. This
    // walks whatever actual events got skipped over to land on this match
    // and checks each one didn't move the wrong way first.
    if (matchedLevel != null) {
      const plannedDirection = Math.sign(planned.level - matchedLevel);
      for (let idx = searchFrom; idx < foundIdx; idx++) {
        const actualDirection = Math.sign(actualTrack[idx].level - matchedLevel);
        if (plannedDirection !== 0 && actualDirection !== 0 && actualDirection !== plannedDirection) {
          divergedAtSeconds = actualTrack[idx].atSeconds;
          break matching; // freeze — don't keep matching past a real divergence
        }
      }
    }

    drift = actualTrack[foundIdx].atSeconds - planned.atSeconds;
    driftAtSeconds = actualTrack[foundIdx].atSeconds;
    matchedLevel = planned.level;
    searchFrom = foundIdx + 1;
  }

  // Fallback: no divergence caught above, but the plan's next (never
  // reached) step calls for a direction the most recent actual move
  // already contradicts.
  if (divergedAtSeconds == null) {
    const nextPlanned = plannedTrack[nextPlannedIdx];
    const latestActual = actualTrack[actualTrack.length - 1];
    if (matchedLevel != null && nextPlanned && latestActual.level !== matchedLevel) {
      const plannedDirection = Math.sign(nextPlanned.level - matchedLevel);
      const actualDirection = Math.sign(latestActual.level - matchedLevel);
      if (plannedDirection !== 0 && actualDirection !== 0 && plannedDirection !== actualDirection) {
        divergedAtSeconds = latestActual.atSeconds;
      }
    }
  }

  return { drift, driftAtSeconds, divergedAtSeconds };
}

/**
 * A live-adjusted view of a plan's targets for the chart overlay — the
 * stored plan (RoastSession.aiSuggestionPlan) never changes; this
 * recomputes fresh from it plus the actual events on every call, so it
 * naturally stays current as the live page re-renders after each logged
 * event. Only the two time-based tracks (fan, heat) are compared; a plan's
 * settingChanges list itself is left untouched as the original reference
 * instructions (shown as-is in AiSuggestionPanel) — only the *targets* used
 * for the chart's dashed reference lines get shifted, since that's the
 * thing that actually goes stale.
 *
 * "diverged" means the roaster's most recent move on a dial went the
 * opposite way from what the plan still calls for — timing drift alone
 * (the same move, just earlier/later) never sets it. Once diverged, the
 * drift value simply stops updating rather than resetting to zero — the
 * last known-good adjustment keeps being applied to whatever targets are
 * still ahead, which is a deliberately conservative simplification, not a
 * claim that the rest of the plan is still valid.
 */
export function computeAdjustedPlan(
  plan: { settingChanges: PlanSettingChange[]; targets: PlanTargets },
  actualEvents: RoastEvent[]
): { targets: PlanTargets; diverged: boolean; divergedAtSeconds?: number } {
  const plannedFan = plan.settingChanges
    .filter((c): c is PlanSettingChange & { fanLevel: number } => c.fanLevel != null)
    .map((c) => ({ atSeconds: c.atSeconds, level: c.fanLevel }));
  const plannedHeat = plan.settingChanges
    .filter((c): c is PlanSettingChange & { heatLevel: number } => c.heatLevel != null)
    .map((c) => ({ atSeconds: c.atSeconds, level: c.heatLevel }));

  const fanResult = matchDialTrack(plannedFan, eventPoints(actualEvents, "FAN"));
  const heatResult = matchDialTrack(plannedHeat, eventPoints(actualEvents, "HEAT"));

  // Whichever track's last confirmed match happened more recently (by real
  // elapsed time) wins as the current drift — not just "prefer heat over
  // fan" or vice versa.
  const matches = [
    fanResult.drift != null ? { drift: fanResult.drift, at: fanResult.driftAtSeconds! } : null,
    heatResult.drift != null ? { drift: heatResult.drift, at: heatResult.driftAtSeconds! } : null,
  ].filter((m): m is { drift: number; at: number } => m != null);
  // No confirmed matches yet (e.g. still before the first dial change) —
  // nothing to adjust for, show the plan exactly as suggested.
  const currentDrift = matches.length > 0 ? matches.reduce((a, b) => (b.at > a.at ? b : a)).drift : 0;

  const divergences = [fanResult.divergedAtSeconds, heatResult.divergedAtSeconds].filter(
    (d): d is number => d != null
  );
  const diverged = divergences.length > 0;
  const divergedAtSeconds = diverged ? Math.min(...divergences) : undefined;

  const shift = (seconds: number | undefined) => (seconds != null ? seconds + currentDrift : undefined);

  return {
    targets: {
      dryEndSeconds: shift(plan.targets.dryEndSeconds),
      yellowingEndSeconds: shift(plan.targets.yellowingEndSeconds),
      firstCrackSeconds: shift(plan.targets.firstCrackSeconds),
      developmentSeconds: plan.targets.developmentSeconds, // a duration, not a point in time — unaffected by drift
      dropTempF: plan.targets.dropTempF, // a temperature, not a time
      targetWeightLossPercent: plan.targets.targetWeightLossPercent,
    },
    diverged,
    divergedAtSeconds,
  };
}

import { formatMMSS } from "@/lib/format";
import type { EventType } from "@/lib/constants";
import type { RoasterControl } from "@/lib/roasters";
import type { RoastEvent, TemperatureReading } from "@prisma/client";

/** The two fields the chart actually reads off a temperature reading — so the live feed's lightweight rows and full Prisma rows both fit. */
export type ProbePoint = Pick<TemperatureReading, "atSeconds" | "tempFahrenheit">;

export const CHART_WIDTH = 760;
// The temp/RoR plotting area's own height — named apart from the exported
// CHART_HEIGHT below now that CHART_HEIGHT also has to fit the
// control-change strip beneath the axis row. Bumped from the original 326
// so the live chart — the whole point of the page during a roast — reads
// as bigger/easier to track at a glance, not just wider.
const TEMP_CHART_HEIGHT = 400;
// Rate of rise gets its own panel under the temp chart rather than being
// overlaid on it. Overlaid, it shared the temp plot's height: a cold-start
// fluid-bed ramp (100-150°F/min) either got clipped off the top or, once the
// axis fit it, crushed the rest of the roast's RoR into a sliver, and the
// line crossed the temp/exhaust curves and the labels above the plot. Its
// own axis fits the real min/max with nothing cut off and nothing crossing.
// The temp chart gives up some height while the panel is showing so the
// whole chart doesn't get disproportionately tall.
const TEMP_CHART_HEIGHT_WITH_ROR = 330;
const ROR_PANEL_GAP = 18;
const ROR_PANEL_HEIGHT = 120;
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
// Same step-line band buildLiveComparisonSvg already draws for its own
// current-vs-comparison strip, ported here so every roast-curve chart shows
// control changes as a strip too, replacing the old on-curve triangle
// markers (dialChangeMarkers, removed) with something that scales to more
// than one simultaneous change without the markers overlapping.
const CONTROL_STRIP_HEIGHT = 40;
// Gap from the time-axis tick row down to the strip's own per-control label
// row — same spacing buildLiveComparisonSvg already uses (its own comment:
// any tighter and the strip's labels collide with the axis tick text just
// above them).
const CONTROL_STRIP_GAP = 22;
export const CHART_HEIGHT = MARGIN_TOP + TEMP_CHART_HEIGHT + AXIS_HEIGHT + CONTROL_STRIP_GAP + CONTROL_STRIP_HEIGHT;

/**
 * Cycled one per control (fan, heat, and whatever else a given roaster has)
 * for the control-change strip beneath the chart — four is plenty for any
 * real machine's control count, and reusing colors already defined for
 * milestone markers keeps this from needing its own new CSS variables.
 */
export const DIAL_MARKER_COLORS: [color: string, opacity: number][] = [
  ["var(--accent)", 1],
  ["var(--foreground)", 0.7],
  ["var(--mark-dry-end)", 1],
  ["var(--mark-second-crack)", 1],
];

export const MILESTONE_MARKERS: { type: EventType; label: string; color: string }[] = [
  { type: "DRY_END", label: "DE", color: "var(--mark-dry-end)" },
  { type: "YELLOWING_END", label: "YE", color: "var(--mark-yellowing-end)" },
  { type: "FIRST_CRACK_START", label: "1C", color: "var(--mark-first-crack)" },
  { type: "FIRST_CRACK_END", label: "1C end", color: "var(--mark-first-crack)" },
  { type: "SECOND_CRACK_START", label: "2C", color: "var(--mark-second-crack)" },
  { type: "SECOND_CRACK_END", label: "2C end", color: "var(--mark-second-crack)" },
];

export type PhaseKey = "drying" | "yellowing" | "browning" | "development";

export const PHASE_STYLES: { key: PhaseKey; label: string; color: string }[] = [
  { key: "drying", label: "Drying", color: "var(--phase-drying)" },
  { key: "yellowing", label: "Yellowing", color: "var(--phase-yellowing)" },
  { key: "browning", label: "Browning", color: "var(--phase-browning)" },
  { key: "development", label: "Development", color: "var(--phase-development)" },
];

/**
 * Which roast phase a moment falls in, from the milestones logged so far —
 * the same boundaries computeRoastPhases (phases.ts) uses: drying until
 * DRY_END, yellowing until YELLOWING_END, browning until FIRST_CRACK_START,
 * development after. A roast without a YELLOWING_END (older ones) goes
 * straight from drying to browning, matching phases.ts's own fallback.
 * Returns null when DRY_END was never logged: without that anchor "drying"
 * would just be a guess, so the curve keeps its single plain color rather
 * than painting an unlogged roast one phase's color end to end.
 */
export function phaseClassifier(events: Pick<RoastEvent, "type" | "atSeconds">[]): ((atSeconds: number) => PhaseKey) | null {
  const at = (type: string) => events.find((e) => e.type === type)?.atSeconds ?? null;
  const dryEnd = at("DRY_END");
  if (dryEnd == null) return null;
  const yellowEnd = at("YELLOWING_END");
  const firstCrack = at("FIRST_CRACK_START");
  return (t) => {
    if (firstCrack != null && t >= firstCrack) return "development";
    if (t >= (yellowEnd ?? dryEnd)) return "browning";
    if (t >= dryEnd) return "yellowing";
    return "drying";
  };
}

/**
 * The phases as time ranges, for shading the chart background: each runs from
 * its start milestone to the next one, and the phase still in progress (or the
 * last one, after drop) runs to `endSeconds` — the latest reading, not the
 * axis end, so a live chart never paints the future as already decided.
 * Empty when DRY_END was never logged (see phaseClassifier).
 */
export function phaseBands(
  events: Pick<RoastEvent, "type" | "atSeconds">[],
  endSeconds: number
): { key: PhaseKey; color: string; fromSeconds: number; toSeconds: number }[] {
  const at = (type: string) => events.find((e) => e.type === type)?.atSeconds ?? null;
  const dryEnd = at("DRY_END");
  if (dryEnd == null) return [];
  const yellowEnd = at("YELLOWING_END");
  const firstCrack = at("FIRST_CRACK_START");

  const starts: { key: PhaseKey; from: number }[] = [{ key: "drying", from: 0 }];
  if (yellowEnd != null) starts.push({ key: "yellowing", from: dryEnd });
  starts.push({ key: "browning", from: yellowEnd ?? dryEnd });
  if (firstCrack != null) starts.push({ key: "development", from: firstCrack });

  const bands: { key: PhaseKey; color: string; fromSeconds: number; toSeconds: number }[] = [];
  starts.forEach((s, i) => {
    const to = Math.min(i + 1 < starts.length ? starts[i + 1].from : endSeconds, endSeconds);
    if (to > s.from) {
      bands.push({ key: s.key, color: PHASE_STYLES.find((p) => p.key === s.key)!.color, fromSeconds: s.from, toSeconds: to });
    }
  });
  return bands;
}

export type RorLayout = "panel" | "overlay";

export interface CurveReading {
  atSeconds: number;
  temp: number;
  /** Keyed by control key (RoasterControl["key"] — "FAN"/"HEAT" today, more for other machines). */
  controlLevels: Record<string, number | null>;
  /** °F/min over the lookback span ending here (see ROR_SPAN_SECONDS), smoothed; null before the turning point / until enough data exists. */
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
// RoR is the temperature change across a lookback *span*, not between two
// adjacent samples — the same idea as Artisan's "Delta Span" setting (and
// Scott Rao's guidance: ~10s to pinpoint events, ~30s to read the trend;
// scottrao.com/blog/2019/7/3/how-to-manage-roast-software-settings). The
// old version differenced consecutive samples (after averaging each over a
// 15s window), which is fine at one reading every several seconds but turns
// into quantization noise at the probe's ~1s cadence: one 0.1°F tick over
// one second reads as 6°F/min, so the line jittered wildly. A span of
// seconds divides that same 0.1°F step by the whole span instead.
//
// 30s is Rao's "read the trend" end of that range, chosen because this
// chart exists to show the roast's overall RoR shape (a smooth, steadily
// declining line is the goal), not to pinpoint a single event — the live
// tips/forecast read the same numbers, where a steadier RoR is also the
// safer thing to extrapolate from.
const ROR_SPAN_SECONDS = 30;
// Artisan's separate "Smooth Deltas" step: after the span-based RoR is
// computed, average it once more over this trailing window so the line
// doesn't pick up the small dial-change bumps a fluid-bed probe shows.
const ROR_SERIES_SMOOTHING_SECONDS = 10;
// Beans hitting a hot drum/chamber drag the probe's reading *down* until
// the "turning point" (BT's minimum, ~1-2 min in) before it starts rising.
// RoR from before that point is the probe recovering, not the roast, and at
// -100°F/min and below it stretches the RoR axis until the real roast's
// RoR is a flat sliver — Artisan likewise only shows RoR from the turning
// point on. Searched for only within this many seconds, so a later
// mid-roast dip is never mistaken for it.
const TURNING_POINT_WINDOW_SECONDS = 240;
// A minimum this much below the first reading counts as a real charge dip;
// anything smaller is just probe noise, not a turning point worth gating on.
const TURNING_POINT_MIN_DIP_F = 5;
// Too short a span at the very start of a roast (the first couple of
// samples) is the same noise problem in miniature — no RoR until at least
// this much data exists, unless readings are so sparse (hand-logged) that a
// single gap already exceeds it.
const ROR_MIN_SPAN_SECONDS = 5;
// A fluid-bed roaster's probe reads a blend of true bean temp and the
// hot airflow tumbling the beans past it — every fan/heat change shows up
// in the reading faster than a bean's real thermal mass could respond. A
// short trailing average on each endpoint of the span damps that jitter
// the way a physically thicker BT probe would. This never touches the
// *displayed* temp (still the raw reading), only what RoR is computed from.
const ROR_SMOOTHING_WINDOW_SECONDS = 5;

/** Time-windowed, not count-windowed: dense probe data gets a real
 * multi-point average, while sparse hand-logged points spaced further
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

type TempPoint = { atSeconds: number; temp: number };

/** Index of the charge-dip minimum (see TURNING_POINT_WINDOW_SECONDS), or 0 when there isn't one. */
export function turningPointIndex(points: TempPoint[]): number {
  let best = 0;
  for (let i = 1; i < points.length && points[i].atSeconds <= TURNING_POINT_WINDOW_SECONDS; i++) {
    // <=, not <: the minimum is often a short plateau at the probe's 0.1°
    // resolution; Artisan reports the last sample of it, so match that.
    if (points[i].temp <= points[best].temp) best = i;
  }
  return points[0].temp - points[best].temp >= TURNING_POINT_MIN_DIP_F ? best : 0;
}

/** °F/min across the lookback span ending at point i (see ROR_SPAN_SECONDS), never reaching back before `firstIndex`. */
export function rorAt(points: TempPoint[], i: number, firstIndex = 0): number | null {
  if (i <= firstIndex) return null;
  const windowStart = points[i].atSeconds - ROR_SPAN_SECONDS;
  // Earliest point still inside the span; with sparse data nothing earlier
  // than the previous point qualifies, so this naturally degrades to the
  // plain two-point difference.
  let j = i - 1;
  while (j > firstIndex && points[j - 1].atSeconds >= windowStart) j--;
  const seconds = points[i].atSeconds - points[j].atSeconds;
  if (seconds <= 0) return null;
  // Only the opening seconds of a dense series: j can't reach back any
  // further than the first usable point, so the span is still too short to trust.
  if (j === firstIndex && seconds < ROR_MIN_SPAN_SECONDS) return null;
  return ((smoothedTempAt(points, i) - smoothedTempAt(points, j)) / seconds) * 60;
}

/** The full RoR series: span-based per point, from the turning point on, then lightly smoothed (see the constants above). */
export function rorSeries(points: TempPoint[]): (number | null)[] {
  const first = turningPointIndex(points);
  const raw = points.map((_, i) => rorAt(points, i, first));
  return raw.map((v, i) => {
    if (v == null) return null;
    const windowStart = points[i].atSeconds - ROR_SERIES_SMOOTHING_SECONDS;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0 && points[j].atSeconds > windowStart; j--) {
      const r = raw[j];
      if (r != null) {
        sum += r;
        count++;
      }
    }
    return count > 0 ? sum / count : v;
  });
}

export function getCurveReadings(
  events: RoastEvent[],
  probeReadings: Pick<TemperatureReading, "atSeconds" | "tempFahrenheit">[] = [],
  controls: RoasterControl[]
): CurveReading[] {
  // atSeconds >= 0: roasts imported before the importer learned to stop at
  // charge carry a few pre-charge samples at negative times.
  const probePoints = probeReadings
    .filter((r): r is typeof r & { atSeconds: number } => r.atSeconds != null && r.atSeconds >= 0)
    .map((r) => ({ atSeconds: r.atSeconds, temp: r.tempFahrenheit }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  // Nothing after DROP belongs on a roast's curve — an Artisan export keeps
  // sampling through cooldown (a 9-minute roast arrives with ~13 minutes of
  // data), and that cooldown's steep negative RoR stretched the RoR axis
  // until the actual roast's RoR was a flat sliver at the top.
  const dropAt = events.find((e) => e.type === "DROP")?.atSeconds;
  const untilDrop = <T extends { atSeconds: number }>(pts: T[]) =>
    dropAt == null ? pts : pts.filter((p) => p.atSeconds <= dropAt);

  const tempPoints = untilDrop(
    probePoints.length >= 2
      ? probePoints
      : events
          .filter((e) => e.type === "TEMP" && e.tempFahrenheit != null)
          .map((e) => ({ atSeconds: e.atSeconds, temp: e.tempFahrenheit as number }))
          .sort((a, b) => a.atSeconds - b.atSeconds)
  );
  if (tempPoints.length < 2) return [];
  const rors = rorSeries(tempPoints);

  const pointsByControl = new Map(
    controls.map((control) => [
      control.key,
      events
        .filter((e) => e.type === control.key && e.controlValue != null)
        .map((e) => ({ atSeconds: e.atSeconds, level: e.controlValue as number }))
        .sort((a, b) => a.atSeconds - b.atSeconds),
    ])
  );

  return tempPoints.map((p, i) => {
    const rorPerMin = rors[i];
    const controlLevels: Record<string, number | null> = {};
    for (const control of controls) {
      controlLevels[control.key] = levelAt(pointsByControl.get(control.key) ?? [], p.atSeconds);
    }
    return {
      atSeconds: p.atSeconds,
      temp: p.temp,
      controlLevels,
      rorPerMin,
    };
  });
}

/**
 * Exhaust/environment-probe temp (Artisan's "ET", `probeType: "environment"`)
 * as its own plain series — never merged into CurveReading/getCurveReadings
 * above, since that function's whole job (RoR, control levels, milestone
 * projection) is specifically about the *bean* temp; ET is supplementary
 * chart context only, drawn as a second line sharing the same temp axis.
 * No RoR or control-level pairing needed for it. Hand-logged/live roasts
 * without a second probe simply have none of these — buildRoastCurveSvg
 * only draws the line when there are at least two.
 */
export function getEnvTempPoints(
  probeReadings: Pick<TemperatureReading, "atSeconds" | "tempFahrenheit">[] = [],
  /** Same cutoff getCurveReadings applies to the bean series: the drop. */
  untilSeconds?: number
): { atSeconds: number; temp: number }[] {
  return probeReadings
    .filter((r): r is typeof r & { atSeconds: number } => r.atSeconds != null && r.atSeconds >= 0)
    .filter((r) => untilSeconds == null || r.atSeconds <= untilSeconds)
    .map((r) => ({ atSeconds: r.atSeconds, temp: r.tempFahrenheit }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
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
  /** The RoR panel under the temp chart (null unless the layout was built with it). */
  rorPanelTop: number | null;
  rorPanelBottom: number | null;
  /** Bottom of the lowest plot panel — the time axis row sits just below it. */
  plotBottom: number;
  /** Total SVG height for this layout (varies with whether the RoR panel is shown). */
  height: number;
  /** Top/bottom of the control-change step-line strip, below the time-axis row. */
  stripTop: number;
  stripBottom: number;
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
export function getChartLayout(
  readings: CurveReading[],
  totalSeconds: number,
  /** Extra temps (e.g. getEnvTempPoints' ET series) that should count
   * toward the axis's min/max range without being part of the bean-temp
   * `readings` array itself — so an exhaust line running hotter than bean
   * temp doesn't get its top clipped off. */
  extraTemps: number[] = [],
  /** Lay out the separate RoR panel beneath the temp chart. */
  rorPanel = false
): ChartLayout {
  const duration = readings.length === 0 ? Math.max(totalSeconds, 1) : Math.max(totalSeconds, readings[readings.length - 1].atSeconds, 1);

  // Padding before rounding out to a clean 25° grid line only guarantees
  // *at least* this much buffer — how much more depends on where the raw
  // value happens to fall relative to that grid, which could round to as
  // little as the padding itself. Bumped from 15 to keep a real, always-
  // visible gap above/below the plotted line in every case, not just the
  // lucky-rounding ones.
  const TEMP_PADDING = 25;
  const allTemps = [...readings.map((p) => p.temp), ...extraTemps];
  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  const minTemp = Math.floor((rawMin - TEMP_PADDING) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + TEMP_PADDING) / 25) * 25;

  // True min/max, padded: the RoR panel has its own plot, so the peak never
  // needs to be cut off to protect anything else's scale. (RoR is span-
  // smoothed and starts at the turning point now, so there's also no stray
  // two-readings-apart spike for a percentile trim to guard against.)
  const ROR_PADDING = 10;
  const rorValues = readings.map((p) => p.rorPerMin).filter((v): v is number => v != null);
  const rawMinRor = rorValues.length > 0 ? Math.min(...rorValues) : 0;
  const rawMaxRor = rorValues.length > 0 ? Math.max(...rorValues) : 0;
  const minRor = Math.floor((rawMinRor - ROR_PADDING) / 10) * 10;
  const maxRor = Math.ceil((rawMaxRor + ROR_PADDING) / 10) * 10;

  const chartLeft = CHART_MARGIN_LEFT;
  const chartRight = CHART_WIDTH - MARGIN_RIGHT;
  const chartWidth = chartRight - chartLeft;
  const tempChartTop = MARGIN_TOP;
  const tempChartHeight = rorPanel ? TEMP_CHART_HEIGHT_WITH_ROR : TEMP_CHART_HEIGHT;
  const tempChartBottom = tempChartTop + tempChartHeight;
  const rorPanelTop = rorPanel ? tempChartBottom + ROR_PANEL_GAP : null;
  const rorPanelBottom = rorPanelTop != null ? rorPanelTop + ROR_PANEL_HEIGHT : null;
  const plotBottom = rorPanelBottom ?? tempChartBottom;
  const stripTop = plotBottom + AXIS_HEIGHT + CONTROL_STRIP_GAP;
  const stripBottom = stripTop + CONTROL_STRIP_HEIGHT;

  // Clamped to the plot's own bounds as a defensive floor — min/max are
  // padded from the real values, so this isn't expected to trigger.
  const x = (seconds: number) => chartLeft + (seconds / duration) * chartWidth;
  const clampToTempChart = (y: number) => Math.min(tempChartBottom, Math.max(tempChartTop, y));
  const yTemp = (temp: number) =>
    clampToTempChart(tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * tempChartHeight);
  // In the panel when there is one; otherwise mapped onto the temp chart (only
  // reachable from callers that never draw RoR, e.g. the comparison chart).
  const yRor = (rorPerMin: number) =>
    rorPanelTop != null && rorPanelBottom != null
      ? Math.min(
          rorPanelBottom,
          Math.max(rorPanelTop, rorPanelTop + (1 - (rorPerMin - minRor) / (maxRor - minRor)) * ROR_PANEL_HEIGHT)
        )
      : clampToTempChart(tempChartTop + (1 - (rorPerMin - minRor) / (maxRor - minRor)) * tempChartHeight);

  return {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    rorPanelTop,
    rorPanelBottom,
    plotBottom,
    height: stripBottom,
    stripTop,
    stripBottom,
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

/** Live RoR-extrapolated forecast (src/lib/tips.ts's computeLiveForecast) —
 * same shape as LiveForecast there, duplicated here rather than imported to
 * keep curve.ts independent (tips.ts already imports from curve.ts, so the
 * reverse import would be circular). */
export interface RoastCurveForecast {
  type: "DRY_END" | "YELLOWING_END" | "FIRST_CRACK_START" | "DROP";
  fromAtSeconds: number;
  fromTempF: number;
  toAtSeconds: number;
  toTempF: number;
}

export function buildRoastCurveSvg(
  events: RoastEvent[],
  totalSeconds: number,
  controls: RoasterControl[],
  options: {
    showRor?: boolean;
    probeReadings?: ProbePoint[];
    /** Exhaust/environment-probe temp (Artisan's "ET") — a second, thinner
     * line on the same temp axis, drawn only when there are at least two
     * readings. See getEnvTempPoints's own comment for why this never
     * merges into the main bean-temp series. */
    envProbeReadings?: ProbePoint[];
    targets?: RoastCurveTargets;
    forecast?: RoastCurveForecast;
    /** Draws the temp line in on mount instead of appearing complete —
     * scoped to the completed-roast view only (RoastCurveChart passes this
     * when it renders with `title`). The live view's chart regenerates on
     * every polled event, and replaying a multi-second draw-in on each
     * poll would be distracting rather than delightful, so it's opt-in
     * rather than the default. */
    animateIn?: boolean;
    /** Where rate of rise is drawn when `showRor` is on: its own panel under the temp chart (default) or overlaid on the temp plot with a right-hand axis. */
    rorLayout?: RorLayout;
  } = {}
): string | null {
  const readings = getCurveReadings(events, options.probeReadings, controls);
  if (readings.length < 2) return null;
  const envTempPoints = getEnvTempPoints(options.envProbeReadings, events.find((e) => e.type === "DROP")?.atSeconds);

  // Extend the axis to cover the furthest target/forecast time too —
  // otherwise a live chart's x-axis only spans elapsed-time-so-far, and
  // every upcoming target/forecast (which is the whole point of showing
  // them) sits off-screen to the right until the actual roast catches up.
  const t = options.targets;
  const latestTarget = Math.max(
    t
      ? Math.max(
          t.dryEndSeconds ?? 0,
          t.yellowingEndSeconds ?? 0,
          t.firstCrackSeconds ?? 0,
          t.firstCrackSeconds != null && t.developmentSeconds != null
            ? t.firstCrackSeconds + t.developmentSeconds
            : 0
        )
      : 0,
    options.forecast?.toAtSeconds ?? 0
  );
  const layout = getChartLayout(
    readings,
    Math.max(totalSeconds, latestTarget),
    envTempPoints.map((p) => p.temp),
    !!options.showRor && (options.rorLayout ?? "panel") === "panel"
  );
  const {
    chartLeft,
    chartRight,
    tempChartTop,
    tempChartBottom,
    rorPanelTop,
    rorPanelBottom,
    plotBottom,
    height,
    stripTop,
    stripBottom,
    minTemp,
    maxTemp,
    minRor,
    maxRor,
    duration,
    x,
    yTemp,
    yRor,
  } = layout;

  const envTempLine =
    envTempPoints.length >= 2 ? envTempPoints.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ") : null;

  const tempTicks = [minTemp, (minTemp + maxTemp) / 2, maxTemp];
  const timeTickCount = duration > 600 ? 6 : 4;
  const timeTicks = Array.from({ length: timeTickCount + 1 }, (_, i) => (duration / timeTickCount) * i);

  const markers = MILESTONE_MARKERS.map((m) => ({
    ...m,
    event: events.find((e) => e.type === m.type),
  })).filter((m) => m.event);
  const dropEvent = events.find((e) => e.type === "DROP");

  const parts: string[] = [];

  parts.push(
    `<svg viewBox="0 0 ${CHART_WIDTH} ${height}" class="roast-curve-svg" role="img" aria-label="Roasting curve">`
  );

  // Phase bands behind the curve (how Artisan and Cropster shade a profile):
  // each phase is a tinted vertical band between the logged milestones, so
  // "which phase was I in at this point" reads from the background instead of
  // recoloring the line. Drawn first so the grid, markers and curve sit on top.
  for (const band of phaseBands(events, readings[readings.length - 1].atSeconds)) {
    const left = x(band.fromSeconds);
    const right = x(band.toSeconds);
    if (right <= left) continue;
    parts.push(
      `<rect x="${left}" y="${tempChartTop}" width="${right - left}" height="${tempChartBottom - tempChartTop}" style="fill:${band.color}" opacity="0.16" />`
    );
    if (rorPanelTop != null && rorPanelBottom != null) {
      parts.push(
        `<rect x="${left}" y="${rorPanelTop}" width="${right - left}" height="${rorPanelBottom - rorPanelTop}" style="fill:${band.color}" opacity="0.16" />`
      );
    }
  }

  for (const t of tempTicks) {
    parts.push(
      `<line x1="${chartLeft}" x2="${chartRight}" y1="${yTemp(t)}" y2="${yTemp(t)}" style="stroke:var(--border)" stroke-width="1" />`,
      `<text x="${chartLeft - 8}" y="${yTemp(t)}" text-anchor="end" dominant-baseline="middle" style="fill:var(--muted)" class="mono-10">${Math.round(t)}°</text>`
    );
  }

  for (const t of timeTicks) {
    parts.push(
      `<text x="${x(t)}" y="${plotBottom + AXIS_HEIGHT - 6}" text-anchor="middle" style="fill:var(--muted)" class="mono-10">${formatMMSS(t)}</text>`
    );
  }

  // Labels sit in one row above the plot; two milestones close enough that
  // their labels would collide (an SR800's dry end and yellowing end are
  // often seconds apart) alternate onto a second row instead of overprinting.
  let prevLabelX = -Infinity;
  let prevLabelRow = 1;
  for (const m of [...markers].sort((a, b) => a.event!.atSeconds - b.event!.atSeconds)) {
    const mx = x(m.event!.atSeconds);
    const row = mx - prevLabelX < 24 && prevLabelRow === 0 ? 1 : 0;
    prevLabelX = mx;
    prevLabelRow = row;
    parts.push(
      `<line x1="${mx}" x2="${mx}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${m.color}" stroke-width="1.5" stroke-dasharray="3 3" />`,
      `<text x="${mx}" y="${tempChartTop - (row === 0 ? 6 : 17)}" text-anchor="middle" style="fill:${m.color}" class="marker-label">${m.label}</text>`
    );
    if (rorPanelTop != null && rorPanelBottom != null) {
      parts.push(
        `<line x1="${mx}" x2="${mx}" y1="${rorPanelTop}" y2="${rorPanelBottom}" style="stroke:${m.color}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7" />`
      );
    }
  }

  if (dropEvent) {
    parts.push(
      `<line x1="${x(dropEvent.atSeconds)}" x2="${x(dropEvent.atSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:var(--mark-drop)" stroke-width="1.5" />`
    );
    if (rorPanelTop != null && rorPanelBottom != null) {
      parts.push(
        `<line x1="${x(dropEvent.atSeconds)}" x2="${x(dropEvent.atSeconds)}" y1="${rorPanelTop}" y2="${rorPanelBottom}" style="stroke:var(--mark-drop)" stroke-width="1.5" />`
      );
    }
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

  // Live RoR-extrapolated forecast (src/lib/tips.ts's computeLiveForecast) —
  // same ghosted dashed convention as the AI-plan targets just above
  // (reduced opacity, finer dash, label stacked at -16 rather than a real
  // milestone's -6), but suffixed "~" rather than "→" so the two stay
  // visually distinct on a roast that's tracking a plan AND has diverged
  // from it enough for the live-RoR forecast to land at a different time —
  // exactly the case most worth noticing. Drawn as a diagonal ray from the
  // last real reading to the projected point, not just a vertical marker,
  // since unlike a plan target (a fixed time with no implied path to it) a
  // forecast is a continuation of the curve itself.
  if (options.forecast) {
    const f = options.forecast;
    const marker = MILESTONE_MARKERS.find((m) => m.type === f.type);
    const color = marker?.color ?? "var(--mark-drop)";
    const label = marker?.label ?? "Drop";
    parts.push(
      `<line x1="${x(f.fromAtSeconds)}" x2="${x(f.toAtSeconds)}" y1="${yTemp(f.fromTempF)}" y2="${yTemp(f.toTempF)}" style="stroke:${color}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.55" />`,
      `<line x1="${x(f.toAtSeconds)}" x2="${x(f.toAtSeconds)}" y1="${tempChartTop}" y2="${tempChartBottom}" style="stroke:${color}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.55" />`,
      `<text x="${x(f.toAtSeconds)}" y="${tempChartTop - 16}" text-anchor="middle" style="fill:${color}" class="marker-label" opacity="0.7">${label}~</text>`
    );
  }

  // Exhaust/environment probe temp (Artisan's "ET") — drawn first, so the
  // primary bean-temp line above stays visually dominant on top of it.
  // Thinner, muted, and un-sketchy (a real recorded line, not the
  // hand-drawn-style focal one) — a supplementary reference, not the metric
  // roasting decisions actually get made from.
  if (envTempLine) {
    parts.push(
      `<polyline points="${envTempLine}" fill="none" style="stroke:var(--mark-dry-end)" stroke-width="1.5" stroke-linejoin="round" opacity="0.75" />`
    );
  }

  // filter, not a redrawn path: the sketchy-fine wobble (same filter every
  // other hand-drawn line in the app uses) is a couple px of visual
  // displacement only — the underlying points, and everything that reads
  // them (hover tooltip, hit-testing), are untouched. pathLength="1" is
  // only meaningful with the draw-in animation (globals.css's
  // .curve-draw-in, gated on animateIn) — harmless to always include, and
  // simpler than branching the whole polyline string on it.
  //
  // The filter (an feTurbulence displacement) is only applied on the
  // completed-roast view (animateIn) — the live chart is rebuilt and
  // re-rasterized on every update, and re-running that filter over a
  // dense probe-fed polyline each time was a real source of live lag.
  parts.push(
    `<polyline points="${readings.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ")}" pathLength="1" ${options.animateIn ? 'class="curve-draw-in"' : ""} fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round"${options.animateIn ? ' filter="url(#sketchy-fine)"' : ""} />`
  );
  // Per-reading dots only when the series is sparse (hand-logged temps,
  // where each dot is a real logged point worth seeing). Dense probe data
  // would emit hundreds of DOM nodes per rebuild for no visual gain — the
  // hover crosshair (RoastCurveChart) already marks any point on demand —
  // so there just the latest point gets a dot.
  const SPARSE_READING_LIMIT = 40;
  const dotted = readings.length <= SPARSE_READING_LIMIT ? readings : readings.slice(-1);
  for (const p of dotted) {
    parts.push(`<circle cx="${x(p.atSeconds)}" cy="${yTemp(p.temp)}" r="2.5" style="fill:var(--accent)" />`);
  }

  if (options.showRor && rorPanelTop != null && rorPanelBottom != null) {
    const rorTicks = [minRor, (minRor + maxRor) / 2, maxRor];
    for (const t of rorTicks) {
      parts.push(
        `<line x1="${chartLeft}" x2="${chartRight}" y1="${yRor(t)}" y2="${yRor(t)}" style="stroke:var(--border)" stroke-width="1" />`,
        `<text x="${chartLeft - 8}" y="${yRor(t)}" text-anchor="end" dominant-baseline="middle" style="fill:var(--ror)" class="mono-10">${Math.round(t)}</text>`
      );
    }
    parts.push(
      // Rotated into the left margin, centered on the panel: any spot above
      // the panel collides with the temp axis' bottom tick or the RoR axis'
      // own top tick (measured — those two are the only things up there).
      `<text transform="rotate(-90 9 ${(rorPanelTop + rorPanelBottom) / 2})" x="9" y="${(rorPanelTop + rorPanelBottom) / 2}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--ror)" class="marker-label">RoR °F/min</text>`
    );
    if (minRor < 0 && maxRor > 0) {
      parts.push(
        `<line x1="${chartLeft}" x2="${chartRight}" y1="${yRor(0)}" y2="${yRor(0)}" style="stroke:var(--ror)" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />`
      );
    }
    const rorLine = readings
      .filter((p): p is CurveReading & { rorPerMin: number } => p.rorPerMin != null)
      .map((p) => `${x(p.atSeconds)},${yRor(p.rorPerMin)}`)
      .join(" ");
    parts.push(
      `<polyline points="${rorLine}" fill="none" style="stroke:var(--ror)" stroke-width="1.75" stroke-linejoin="round" />`
    );
  } else if (options.showRor) {
    // Overlaid on the temp plot, sharing its height, with its own axis on the
    // right. Fit to the true peak like the panel — on a cold-start roaster the
    // opening ramp then compresses the rest of the RoR, which is the trade
    // the viewer is choosing by picking this layout over the panel.
    for (const t of [minRor, (minRor + maxRor) / 2, maxRor]) {
      parts.push(
        `<text x="${chartRight + 8}" y="${yRor(t)}" text-anchor="start" dominant-baseline="middle" style="fill:var(--ror)" class="mono-10">${Math.round(t)}</text>`
      );
    }
    const midY = (tempChartTop + tempChartBottom) / 2;
    parts.push(
      `<text transform="rotate(-90 ${CHART_WIDTH - 5} ${midY})" x="${CHART_WIDTH - 5}" y="${midY}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--ror)" class="marker-label">RoR °F/min</text>`
    );
    if (minRor < 0 && maxRor > 0) {
      parts.push(
        `<line x1="${chartLeft}" x2="${chartRight}" y1="${yRor(0)}" y2="${yRor(0)}" style="stroke:var(--ror)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4" />`
      );
    }
    const rorLine = readings
      .filter((p): p is CurveReading & { rorPerMin: number } => p.rorPerMin != null)
      .map((p) => `${x(p.atSeconds)},${yRor(p.rorPerMin)}`)
      .join(" ");
    parts.push(
      `<polyline points="${rorLine}" fill="none" style="stroke:var(--ror)" stroke-width="1.75" stroke-linejoin="round" />`
    );
  }

  // Control-change step-line strip beneath the axis row — ported from
  // buildLiveComparisonSvg's own strip (same per-control color cycling,
  // same step-path shape), replacing the old on-curve triangle markers so
  // more than one simultaneous dial change reads clearly instead of
  // overlapping. Each control gets its own 0-1 normalized band (fan's 1-9
  // and a gas valve's 0-100 don't share real units, so there's no single
  // absolute scale to draw ticks for — the step shape, not the axis, is
  // what this answers "when did it change and which way"). A control with
  // zero changes yet still gets its label, just no path — an intact empty
  // band, not a broken one.
  let stripLabelX = chartLeft;
  controls.forEach((control, i) => {
    const [color, opacity] = DIAL_MARKER_COLORS[i % DIAL_MARKER_COLORS.length];
    parts.push(
      `<text x="${stripLabelX}" y="${stripTop - 6}" style="fill:${color};opacity:${opacity}" class="marker-label">${escapeXml(control.label)}</text>`
    );
    stripLabelX += control.label.length * 6 + 14;

    const points = eventPoints(events, control.key);
    if (points.length > 0) {
      // Clamped to the control's own range: an imported level outside it
      // (e.g. an Artisan damper on a 0-100 scale against a 0-10 control)
      // otherwise plots far outside its strip and across the temp chart.
      const yLevel = (level: number) =>
        stripTop +
        (1 - (Math.min(control.max, Math.max(control.min, level)) - control.min) / (control.max - control.min)) *
          CONTROL_STRIP_HEIGHT;
      parts.push(
        `<path d="${buildStepPath(points, duration, x, yLevel)}" fill="none" style="stroke:${color};opacity:${opacity}" stroke-width="1.5" />`
      );
    }
  });
  parts.push(
    `<line x1="${chartLeft}" x2="${chartRight}" y1="${stripBottom}" y2="${stripBottom}" style="stroke:var(--border)" stroke-width="1" />`
  );

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

function eventPoints(events: RoastEvent[], type: EventType) {
  return events
    .filter((e) => e.type === type && e.controlValue != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.controlValue as number }))
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

/** A roast's dial changes, sorted by time — same reasoning as getMilestoneEvents: "at 2:15, heat -> 7" reads better as a table row than as a second step-line squeezed into a small strip. One entry per control this roast's machine actually has (see RoasterDefinition). */
export function getDialChangeEvents(
  events: RoastEvent[],
  controls: RoasterControl[]
): { type: EventType; level: number; atSeconds: number }[] {
  return controls
    .flatMap((control) => eventPoints(events, control.key).map((p) => ({ type: control.key, ...p })))
    .sort((a, b) => a.atSeconds - b.atSeconds);
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
  controls: RoasterControl[],
  currentProbeReadings: ProbePoint[] = [],
  // The comparison roast's own probe data — easy to forget since it wasn't
  // needed before probe tracking was reliable, but a past roast tracked
  // purely via probe (no hand-logged TEMP events at all, which
  // getCurveReadings never looks at otherwise) has zero readings without
  // this, silently killing the whole chart even when the current roast has
  // plenty of its own data.
  comparisonProbeReadings: ProbePoint[] = [],
  // Current roast only — the comparison roast's temp line already uses
  // --ror's color (dashed), so a second RoR series would either clash with
  // it or need a third color; the live roast's own RoR is the thing you'd
  // actually want to watch while roasting, which this option is for.
  showRor = false
): string | null {
  const readingsA = getCurveReadings(currentEvents, currentProbeReadings, controls);
  const readingsB = getCurveReadings(comparisonEvents, comparisonProbeReadings, controls);
  if (readingsA.length < 2 || readingsB.length < 2) return null;

  const duration = Math.max(currentElapsedSeconds, comparisonTotalSeconds, 1);
  const allTemps = [...readingsA, ...readingsB].map((p) => p.temp);
  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  // Same guaranteed-minimum-buffer padding as getChartLayout's TEMP_PADDING.
  const minTemp = Math.floor((rawMin - 25) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + 25) / 25) * 25;

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

  // Clamped to the temp plot area's own bounds, same reasoning as
  // getChartLayout's yTemp/yRor — a percentile-trimmed RoR range (below)
  // deliberately lets an outlier point fall outside [minRor, maxRor], and
  // without clamping its *pixel* position would escape the plot box
  // entirely rather than flattening against the top/bottom edge.
  const x = (seconds: number) => chartLeft + (seconds / duration) * (chartRight - chartLeft);
  const clampToTempChart = (y: number) => Math.min(tempChartBottom, Math.max(tempChartTop, y));
  const yTemp = (temp: number) =>
    clampToTempChart(tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * LIVE_CMP_TEMP_HEIGHT);
  // Normalized 0-1 per control's own min/max, not one shared absolute
  // scale — a gas valve's 0-100 range and a fan's 1-9 range have to share
  // this one strip, so there's no single set of real units to draw ticks
  // for; the step-lines' shape (when did it change, which direction) is
  // what this strip is for, same reasoning as buildRoastCurveSvg's own
  // control-change strip.
  const yLevelA = (level: number, control: RoasterControl) =>
    stripATop + (1 - (level - control.min) / (control.max - control.min)) * LIVE_CMP_STRIP_HEIGHT;

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
  // Same dense-series reasoning as buildRoastCurveSvg: dots only when
  // sparse, otherwise just the latest point.
  const dottedA = readingsA.length <= 40 ? readingsA : readingsA.slice(-1);
  for (const p of dottedA) {
    parts.push(`<circle cx="${x(p.atSeconds)}" cy="${yTemp(p.temp)}" r="2.5" style="fill:var(--accent)" />`);
  }

  if (showRor) {
    const rorValues = readingsA.map((p) => p.rorPerMin).filter((v): v is number => v != null);
    const [rawMinRor, rawMaxRor] = rorPercentileRange(rorValues);
    // Same guaranteed-minimum-buffer padding as getChartLayout's ROR_PADDING.
    const minRor = Math.floor((rawMinRor - 10) / 10) * 10;
    const maxRor = Math.ceil((rawMaxRor + 10) / 10) * 10;
    const yRor = (rorPerMin: number) =>
      clampToTempChart(tempChartTop + (1 - (rorPerMin - minRor) / (maxRor - minRor)) * LIVE_CMP_TEMP_HEIGHT);
    // --foreground, not --ror — the comparison roast's temp line already
    // owns --ror (dashed) in this chart, and both can be on screen at once
    // once this is toggled on. --foreground at reduced opacity is this same
    // function's existing convention for a secondary/tertiary series (see
    // the heat dial step-line below).
    const rorTicks = [minRor, (minRor + maxRor) / 2, maxRor];
    for (const t of rorTicks) {
      parts.push(
        `<text x="${chartRight + 8}" y="${yRor(t)}" text-anchor="start" dominant-baseline="middle" style="fill:var(--foreground);opacity:0.6" class="mono-10">${Math.round(t)}</text>`
      );
    }
    parts.push(
      `<text x="${chartRight}" y="${tempChartTop - 6}" text-anchor="end" style="fill:var(--foreground);opacity:0.6" class="marker-label">°F/min</text>`
    );
    const rorPoints = readingsA.filter((p): p is CurveReading & { rorPerMin: number } => p.rorPerMin != null);
    const rorLine = rorPoints.map((p) => `${x(p.atSeconds)},${yRor(p.rorPerMin)}`).join(" ");
    parts.push(
      `<polyline points="${rorLine}" fill="none" style="stroke:var(--foreground)" stroke-width="1.75" stroke-linejoin="round" opacity="0.6" />`
    );
  }

  let labelX = chartLeft;
  controls.forEach((control, i) => {
    const [color, opacity] = DIAL_MARKER_COLORS[i % DIAL_MARKER_COLORS.length];
    parts.push(`<text x="${labelX}" y="${stripATop - 6}" style="fill:${color};opacity:${opacity}" class="marker-label">${escapeXml(control.label)}</text>`);
    labelX += control.label.length * 6 + 14;

    const points = eventPoints(currentEvents, control.key);
    if (points.length > 0) {
      parts.push(
        `<path d="${buildStepPath(points, currentElapsedSeconds, x, (level) => yLevelA(level, control))}" fill="none" style="stroke:${color};opacity:${opacity}" stroke-width="1.5" />`
      );
    }
  });
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

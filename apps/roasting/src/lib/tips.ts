import { formatMMSS } from "@/lib/format";
import { nearestCurveReading, type CurveReading } from "@/lib/curve";
import type { RoastEvent, RoastSession } from "@prisma/client";

/**
 * Averages pulled from the roaster's own past completed roasts (same bean if
 * there are any, otherwise all beans) — used to ground tips in what's
 * actually typical for THIS roaster on THIS hardware, not a generic number.
 */
export type HistoricalBaseline = {
  count: number;
  avgDryEndSeconds: number | null;
  avgFirstCrackSeconds: number | null;
  avgDurationSeconds: number | null;
};

export function computeHistoricalBaseline(
  sessions: (RoastSession & { events: Pick<RoastEvent, "type" | "atSeconds">[] })[]
): HistoricalBaseline {
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const durations = sessions
    .filter((s) => s.endedAt)
    .map((s) => (s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000);
  const deTimes = sessions
    .map((s) => s.events.find((e) => e.type === "DRY_END")?.atSeconds)
    .filter((v): v is number => v != null);
  const fcTimes = sessions
    .map((s) => s.events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds)
    .filter((v): v is number => v != null);

  return {
    count: sessions.length,
    avgDryEndSeconds: avg(deTimes),
    avgFirstCrackSeconds: avg(fcTimes),
    avgDurationSeconds: avg(durations),
  };
}

export type Tip = { id: string; message: string };

/** A specific past roast to compare live progress against — either the bean's explicitly-marked golden roast, or (falling back) its most recent completed roast. */
export type ReferenceRoast = { label: string; readings: CurveReading[] };

const STALL_WINDOW_SECONDS = 90;
const STALL_MIN_READINGS = 3;
// Below this, RoR reads as flat rather than just naturally decelerating —
// real light-roast Maillard RoR is typically well above this per the
// external research folded into roastAdvisor.ts's system prompt.
const STALL_FLOOR_ROR = 8;
const STALL_DROP_RATIO = 0.5;
const CRASH_WINDOW_SECONDS = 90;
const CRASH_FLOOR_ROR = 3;

function avgRoR(readings: CurveReading[]): number | null {
  const withRoR = readings.map((r) => r.rorPerMin).filter((v): v is number => v != null);
  if (withRoR.length === 0) return null;
  return withRoR.reduce((a, b) => a + b, 0) / withRoR.length;
}

/**
 * Flags a stalling RoR during the browning/Maillard phase, or a crash right
 * after first crack — both are how acidity and origin character get muted
 * even in a roast that finishes light-colored (see roastAdvisor.ts's system
 * prompt for the mechanism, and this SR800 unit's own fan/heat-vs-RoR
 * analysis behind the "lower fan" suggestion). Only fires with enough
 * recent readings to trust — a probe streaming every 5s or dense
 * hand-logged points — and only compares like-for-like windows (this
 * roast's own earlier pace, or a chosen reference roast at the same
 * elapsed time), never a single noisy point against an invented threshold.
 */
function detectStall(
  curveReadings: CurveReading[],
  elapsedSeconds: number,
  dryEndAt: number | null,
  firstCrackAt: number | null,
  referenceRoast?: ReferenceRoast | null
): Tip | null {
  if (dryEndAt == null || elapsedSeconds <= dryEndAt) return null; // still drying — RoR swings here by design

  // Crash window: readings strictly since first crack, never blended with
  // pre-1C readings — a blanket "last 90s" lookback here would average a
  // real crash together with the healthy declining RoR just before 1C and
  // mask it.
  if (firstCrackAt != null && elapsedSeconds > firstCrackAt) {
    if (elapsedSeconds - firstCrackAt > CRASH_WINDOW_SECONDS) return null; // past the crash/flick window
    const postCrackWindow = curveReadings.filter((r) => r.atSeconds >= firstCrackAt && r.atSeconds <= elapsedSeconds);
    if (postCrackWindow.length < STALL_MIN_READINGS) return null;
    const postCrackRoR = avgRoR(postCrackWindow);
    if (postCrackRoR == null || postCrackRoR > CRASH_FLOOR_ROR) return null;
    return {
      id: "ror-crash",
      message: `RoR has flattened to ~${postCrackRoR.toFixed(0)}°F/min right after first crack — watch for a "flick" (RoR rebounding too fast), which can add harsh notes. A small fan reduction tends to smooth this transition better than a heat bump.`,
    };
  }
  if (firstCrackAt != null) return null; // through 1C, outside the crash window — not the stall zone anymore

  const recentWindow = curveReadings.filter(
    (r) => r.atSeconds > elapsedSeconds - STALL_WINDOW_SECONDS && r.atSeconds <= elapsedSeconds
  );
  if (recentWindow.length < STALL_MIN_READINGS) return null;
  const recentRoR = avgRoR(recentWindow);
  if (recentRoR == null) return null;

  let priorRoR: number | null = null;
  let comparedTo: string;
  if (referenceRoast && referenceRoast.readings.length > 0) {
    priorRoR = nearestCurveReading(referenceRoast.readings, elapsedSeconds).rorPerMin;
    comparedTo = `${referenceRoast.label}'s pace`;
  } else {
    const priorWindow = curveReadings.filter(
      (r) =>
        r.atSeconds > elapsedSeconds - STALL_WINDOW_SECONDS * 2 &&
        r.atSeconds <= elapsedSeconds - STALL_WINDOW_SECONDS
    );
    priorRoR = priorWindow.length >= 2 ? avgRoR(priorWindow) : null;
    comparedTo = "its own pace a bit earlier";
  }
  if (priorRoR == null || priorRoR <= 0) return null;

  if (recentRoR < priorRoR * STALL_DROP_RATIO && recentRoR < STALL_FLOOR_ROR) {
    return {
      id: "ror-stall",
      message: `RoR has flattened to ~${recentRoR.toFixed(0)}°F/min, well under ${comparedTo} (~${priorRoR.toFixed(0)}°F/min) — a stalling RoR through browning is how acidity and origin character get muted even in a light roast. This machine's own data shows lowering fan is the more reliable way to rebuild momentum here than adding heat.`,
    };
  }
  return null;
}

/**
 * A small, deliberately conservative rule set — general, widely-cited
 * roasting heuristics (never precise/authoritative claims) plus comparisons
 * to the roaster's own history where we have it. Not a substitute for
 * judgment; see the UI copy that wraps this.
 */
export function generateLiveTips(input: {
  elapsedSeconds: number;
  events: Pick<RoastEvent, "type" | "atSeconds" | "tempFahrenheit">[];
  baseline: HistoricalBaseline;
  referenceRoast?: ReferenceRoast | null;
  curveReadings?: CurveReading[];
  /** Set (via computeAdjustedPlan, src/lib/curve.ts) when an accepted plan's
   * dial schedule has been contradicted by an actual fan/heat move — surfaced
   * here rather than silently adjusting the rest of the plan, since a real
   * divergence means the plan's remaining targets are no longer trustworthy,
   * not just off by a fixed offset. */
  planDivergedAtSeconds?: number;
}): Tip[] {
  const { elapsedSeconds, events, baseline, referenceRoast, curveReadings = [], planDivergedAtSeconds } = input;
  const tips: Tip[] = [];

  if (planDivergedAtSeconds != null) {
    tips.unshift({
      id: "plan-diverged",
      message: `Plan diverged around ${formatMMSS(planDivergedAtSeconds)} — remaining targets are the original suggestion, unadjusted from here on.`,
    });
  }

  const stallTip = detectStall(
    curveReadings,
    elapsedSeconds,
    events.find((e) => e.type === "DRY_END")?.atSeconds ?? null,
    events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds ?? null,
    referenceRoast
  );
  if (stallTip) tips.unshift(stallTip);

  // Prefer curveReadings (probe-aware, per getCurveReadings) over the raw
  // event's own TEMP entries — a probe streaming every 5s shouldn't get
  // flagged as "stale" just because nothing was hand-logged recently, and
  // the reference-roast comparison should use the same live number the
  // chart itself is showing right now.
  const lastCurveReading = curveReadings.length > 0 ? curveReadings[curveReadings.length - 1] : null;
  const lastHandLoggedTemp = [...events].reverse().find((e) => e.type === "TEMP");
  const currentTemp = lastCurveReading?.temp ?? lastHandLoggedTemp?.tempFahrenheit;
  const lastTempAt = lastCurveReading?.atSeconds ?? lastHandLoggedTemp?.atSeconds;

  if (referenceRoast && referenceRoast.readings.length > 0) {
    const ref = nearestCurveReading(referenceRoast.readings, elapsedSeconds);
    const diff = currentTemp != null ? Math.round(currentTemp - ref.temp) : null;
    const comparison =
      diff != null ? ` — you're at ${Math.round(currentTemp!)}°F (${diff > 0 ? "+" : ""}${diff}°)` : "";
    tips.push({
      id: "reference-roast",
      message: `${referenceRoast.label} was at ${Math.round(ref.temp)}°F around ${formatMMSS(ref.atSeconds)}${comparison}.`,
    });
  }

  const hasType = (t: string) => events.some((e) => e.type === t);

  if (elapsedSeconds > 30 && (lastTempAt == null || elapsedSeconds - lastTempAt > 60)) {
    tips.push({
      id: "temp-stale",
      message: "No temp reading in the last minute — log one to keep the curve accurate.",
    });
  }

  if (!hasType("DRY_END")) {
    const threshold = baseline.avgDryEndSeconds != null ? baseline.avgDryEndSeconds * 1.25 : 210;
    if (elapsedSeconds > threshold) {
      const hint =
        baseline.avgDryEndSeconds != null
          ? ` (usually around ${formatMMSS(baseline.avgDryEndSeconds)} for this bean)`
          : "";
      tips.push({
        id: "de-late",
        message: `No dry end marked yet${hint} — tap it once the beans turn yellow and stop steaming.`,
      });
    }
  } else if (!hasType("FIRST_CRACK_START")) {
    const threshold = baseline.avgFirstCrackSeconds != null ? baseline.avgFirstCrackSeconds * 1.2 : 420;
    if (elapsedSeconds > threshold) {
      const hint =
        baseline.avgFirstCrackSeconds != null
          ? ` (usually around ${formatMMSS(baseline.avgFirstCrackSeconds)} for this bean)`
          : "";
      tips.push({
        id: "fc-late",
        message: `First crack hasn't been marked yet${hint} — listen closely.`,
      });
    }
  } else {
    const firstCrackAt = events.find((e) => e.type === "FIRST_CRACK_START")!.atSeconds;
    const devSoFar = elapsedSeconds - firstCrackAt;
    const devPercent = elapsedSeconds > 0 ? (devSoFar / elapsedSeconds) * 100 : 0;
    tips.push({
      id: "dtr-live",
      message: `Development time so far: ${formatMMSS(devSoFar)} (${devPercent.toFixed(0)}% of elapsed) — Scott Rao targets roughly 20–25% (lower on high-powered roasters).`,
    });
  }

  if (baseline.avgDurationSeconds != null && elapsedSeconds > baseline.avgDurationSeconds * 1.3) {
    tips.push({
      id: "running-long",
      message: `Running longer than usual — your average for this bean is ${formatMMSS(baseline.avgDurationSeconds)}.`,
    });
  }

  return tips;
}

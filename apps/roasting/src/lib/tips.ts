import { formatMMSS } from "@/lib/format";
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
    .map((s) => (s.endedAt!.getTime() - s.startedAt.getTime()) / 1000);
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

/**
 * A small, deliberately conservative rule set — general, widely-cited
 * roasting heuristics (never precise/authoritative claims) plus comparisons
 * to the roaster's own history where we have it. Not a substitute for
 * judgment; see the UI copy that wraps this.
 */
export function generateLiveTips(input: {
  elapsedSeconds: number;
  events: Pick<RoastEvent, "type" | "atSeconds">[];
  baseline: HistoricalBaseline;
}): Tip[] {
  const { elapsedSeconds, events, baseline } = input;
  const tips: Tip[] = [];

  const hasType = (t: string) => events.some((e) => e.type === t);
  const lastTemp = [...events].reverse().find((e) => e.type === "TEMP");

  if (elapsedSeconds > 30 && (!lastTemp || elapsedSeconds - lastTemp.atSeconds > 60)) {
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
      message: `Development time so far: ${formatMMSS(devSoFar)} (${devPercent.toFixed(0)}% of elapsed) — commonly cited target is roughly 15–25%.`,
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

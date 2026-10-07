import type { RoastEvent } from "@prisma/client";
import { turningPointIndex, type CurveReading } from "@/lib/curve";

/**
 * The numbers Artisan shows beside a roast curve (its "computed" block:
 * charge temp, turning point, temp at each milestone, per-phase RoR and
 * temperature gain), derived here from the readings themselves instead of
 * read out of an imported file — so a roast logged live, hand-entered or
 * imported all get the same metrics, and they stay consistent with the chart.
 * Checked against the `computed` block of 15 real Artisan .alog files: charge
 * temp, turning point, milestone temps, per-phase °F/min and ΔT all match.
 *
 * Artisan's conventions, kept so the numbers line up with what a roaster
 * already knows from it: a phase's RoR/ΔT is measured from the *turning
 * point* (not from charge — the probe's early reading is the charge dip, not
 * the beans), and "total" RoR is turning point → drop.
 *
 * Temperatures are always a real reading (nearest within MATCH_TOLERANCE_SECONDS),
 * never interpolated — same rule as the chart's hover. Anything that can't be
 * grounded in a reading, or whose milestone wasn't logged, comes back null.
 */
const MATCH_TOLERANCE_SECONDS = 20;

export interface MilestoneMetric {
  atSeconds: number;
  tempF: number | null;
}

export interface PhaseMetric {
  /** Wall-clock length of the phase (drying is charge → dry end, as in Artisan). */
  seconds: number;
  percent: number | null;
  /** °F gained across the phase, measured as described above. */
  deltaTempF: number | null;
  /** Average °F/min across the phase. */
  avgRorPerMin: number | null;
}

export interface RoastMetrics {
  chargeTempF: number | null;
  turningPoint: { atSeconds: number; tempF: number } | null;
  dryEnd: MilestoneMetric | null;
  firstCrack: MilestoneMetric | null;
  drop: MilestoneMetric | null;
  drying: PhaseMetric | null;
  maillard: PhaseMetric | null;
  development: PhaseMetric | null;
  /** Turning point → drop. */
  overallRorPerMin: number | null;
  /** The chart's (smoothed) RoR at the moment of first crack. */
  rorAtFirstCrackPerMin: number | null;
}

function nearest(readings: CurveReading[], atSeconds: number): CurveReading | null {
  let best: CurveReading | null = null;
  let bestDist = Infinity;
  for (const r of readings) {
    const d = Math.abs(r.atSeconds - atSeconds);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best && bestDist <= MATCH_TOLERANCE_SECONDS ? best : null;
}

export function computeRoastMetrics(
  readings: CurveReading[],
  events: Pick<RoastEvent, "type" | "atSeconds">[],
  totalSeconds: number
): RoastMetrics | null {
  if (readings.length < 2) return null;

  const at = (type: string) => events.find((e) => e.type === type)?.atSeconds ?? null;
  const dryEndAt = at("DRY_END");
  const firstCrackAt = at("FIRST_CRACK_START");
  const dropAt = at("DROP") ?? (totalSeconds > 0 ? totalSeconds : null);

  const milestone = (atSeconds: number | null): MilestoneMetric | null =>
    atSeconds == null ? null : { atSeconds, tempF: nearest(readings, atSeconds)?.temp ?? null };

  const tpIndex = turningPointIndex(readings);
  const turningPoint = tpIndex > 0 ? { atSeconds: readings[tpIndex].atSeconds, tempF: readings[tpIndex].temp } : null;
  // With no charge dip (a hand-logged roast that only ever rises) the first
  // reading is the earliest meaningful starting point.
  const start = turningPoint ?? { atSeconds: readings[0].atSeconds, tempF: readings[0].temp };

  const pct = (seconds: number) => (totalSeconds > 0 ? (seconds / totalSeconds) * 100 : null);
  const rorBetween = (from: { atSeconds: number; tempF: number | null }, to: MilestoneMetric) => {
    if (from.tempF == null || to.tempF == null || to.atSeconds <= from.atSeconds) return { delta: null, ror: null };
    const delta = to.tempF - from.tempF;
    return { delta, ror: (delta / (to.atSeconds - from.atSeconds)) * 60 };
  };

  const dryEnd = milestone(dryEndAt);
  const firstCrack = milestone(firstCrackAt);
  const drop = milestone(dropAt);

  const phase = (
    from: { atSeconds: number; tempF: number | null },
    to: MilestoneMetric | null,
    secondsFromStartOfPhase: number
  ): PhaseMetric | null => {
    if (!to || secondsFromStartOfPhase <= 0) return null;
    const { delta, ror } = rorBetween(from, to);
    return { seconds: secondsFromStartOfPhase, percent: pct(secondsFromStartOfPhase), deltaTempF: delta, avgRorPerMin: ror };
  };

  return {
    chargeTempF: readings[0].atSeconds <= MATCH_TOLERANCE_SECONDS ? readings[0].temp : null,
    turningPoint,
    dryEnd,
    firstCrack,
    drop,
    // Drying's length is charge → dry end, but (Artisan's convention) its
    // temperature gain/RoR start from the turning point.
    drying: phase(start, dryEnd, dryEnd?.atSeconds ?? 0),
    maillard:
      dryEnd && firstCrack ? phase({ atSeconds: dryEnd.atSeconds, tempF: dryEnd.tempF }, firstCrack, firstCrack.atSeconds - dryEnd.atSeconds) : null,
    development:
      firstCrack && drop ? phase({ atSeconds: firstCrack.atSeconds, tempF: firstCrack.tempF }, drop, drop.atSeconds - firstCrack.atSeconds) : null,
    overallRorPerMin: drop ? rorBetween(start, drop).ror : null,
    rorAtFirstCrackPerMin: firstCrackAt != null ? (nearest(readings, firstCrackAt)?.rorPerMin ?? null) : null,
  };
}

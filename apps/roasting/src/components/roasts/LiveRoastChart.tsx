"use client";

import { useMemo } from "react";
import RoastCurveChart from "@/components/roasts/RoastCurveChart";
import LiveComparisonChart from "@/components/roasts/LiveComparisonChart";
import { useProbeReadings } from "@/lib/useProbeReadings";
import { getCurveReadings, type PlanTargets, type ProbePoint } from "@/lib/curve";
import { computeLiveForecast, projectNextMilestone, type MilestoneTempBaseline } from "@/lib/tips";
import type { RoasterControl } from "@/lib/roasters";
import type { RoastEvent } from "@prisma/client";

/**
 * The live roast's chart, driven directly by the shared probe feed
 * (useProbeReadings — new readings about once a second, appended
 * client-side) instead of the page's server-rendered props. Before this,
 * the curve only moved when the whole page re-ran server-side every few
 * seconds, including its heavy baseline query; now a new reading is a
 * small fetch and a client re-render, so the curve and the forecast ray
 * advance together as data lands.
 *
 * The server still supplies what genuinely needs a database round trip and
 * changes rarely — events (which refresh on their own whenever a Server
 * Action logs one), the historical milestone baseline, and the accepted
 * plan — as props; the forecast/projection math that used to run in
 * page.tsx runs here instead, against the live series. `initialReadings`
 * only covers the gap before the feed's first response.
 */
export default function LiveRoastChart({
  roastSessionId,
  events,
  controls,
  initialReadings,
  initialEnvReadings,
  milestoneTempBaseline,
  hasAcceptedPlan,
  planTargets,
  comparison,
}: {
  roastSessionId: string;
  events: RoastEvent[];
  controls: RoasterControl[];
  initialReadings: ProbePoint[];
  initialEnvReadings: ProbePoint[];
  milestoneTempBaseline: MilestoneTempBaseline | null;
  hasAcceptedPlan: boolean;
  planTargets?: PlanTargets;
  /** Set when the roast is being compared live against a past one — renders the overlay chart instead. */
  comparison?: {
    currentLabel: string;
    comparisonEvents: RoastEvent[];
    comparisonLabel: string;
    comparisonTotalSeconds: number;
    comparisonProbeReadings: ProbePoint[];
  };
}) {
  const live = useProbeReadings(roastSessionId);

  // Bean and environment (exhaust) probes post under different probeTypes —
  // the curve/RoR/forecast math is bean-only, ET is a supplementary line.
  const readings = useMemo<ProbePoint[]>(
    () => (live ? live.filter((r) => r.probeType === "bean") : initialReadings),
    [live, initialReadings]
  );
  const envReadings = useMemo<ProbePoint[]>(
    () => (live ? live.filter((r) => r.probeType === "environment") : initialEnvReadings),
    [live, initialEnvReadings]
  );

  // Data-driven, same as the server-side value this replaces: the latest
  // logged event or reading, not a wall clock.
  const elapsedSeconds = useMemo(() => {
    let max = 1;
    for (const e of events) max = Math.max(max, e.atSeconds);
    for (const r of readings) max = Math.max(max, r.atSeconds ?? 0);
    return max;
  }, [events, readings]);

  const { targets, forecast } = useMemo(() => {
    const curveReadings = getCurveReadings(events, readings, controls);
    const hasYellowingTarget = planTargets?.yellowingEndSeconds != null;

    let projectedTargets = planTargets;
    if (milestoneTempBaseline && hasAcceptedPlan && projectedTargets) {
      // Live RoR-based re-projection of the next unreached milestone — only
      // overrides the one field it projects (see tips.ts's projectNextMilestone).
      const projection = projectNextMilestone({
        events,
        curveReadings,
        elapsedSeconds,
        milestoneTempBaseline,
        hasYellowingTarget,
        controls,
      });
      if (projection) {
        projectedTargets = {
          ...projectedTargets,
          ...(projection.milestone === "DRY_END" && { dryEndSeconds: Math.round(projection.projectedAtSeconds) }),
          ...(projection.milestone === "YELLOWING_END" && {
            yellowingEndSeconds: Math.round(projection.projectedAtSeconds),
          }),
          ...(projection.milestone === "FIRST_CRACK_START" && {
            firstCrackSeconds: Math.round(projection.projectedAtSeconds),
          }),
        };
      }
    }

    // Computed whether or not a plan was accepted — dropTempF is simply
    // undefined without one and the forecast falls back to the historical
    // drop temp (see tips.ts's computeLiveForecast).
    const liveForecast = milestoneTempBaseline
      ? computeLiveForecast({
          events,
          curveReadings,
          elapsedSeconds,
          milestoneTempBaseline,
          hasYellowingTarget,
          dropTempF: planTargets?.dropTempF,
          controls,
        })
      : null;

    return { targets: projectedTargets, forecast: liveForecast ?? undefined };
  }, [events, readings, controls, elapsedSeconds, milestoneTempBaseline, hasAcceptedPlan, planTargets]);

  if (comparison) {
    return (
      <LiveComparisonChart
        currentEvents={events}
        currentLabel={comparison.currentLabel}
        currentElapsedSeconds={elapsedSeconds}
        comparisonEvents={comparison.comparisonEvents}
        comparisonLabel={comparison.comparisonLabel}
        comparisonTotalSeconds={comparison.comparisonTotalSeconds}
        controls={controls}
        currentProbeReadings={readings}
        comparisonProbeReadings={comparison.comparisonProbeReadings}
      />
    );
  }

  return (
    <RoastCurveChart
      events={events}
      totalSeconds={elapsedSeconds}
      controls={controls}
      probeReadings={readings}
      envProbeReadings={envReadings}
      targets={targets}
      forecast={forecast}
    />
  );
}

"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { useProbeReadings } from "@/lib/useProbeReadings";
import { computeRoastPhases } from "@/lib/phases";
import { getCurveReadings, type PlanTargets } from "@/lib/curve";
import { generateLiveTips, type HistoricalBaseline, type MilestoneTempBaseline, type ReferenceRoast } from "@/lib/tips";
import PhaseBar from "@/components/roasts/PhaseBar";
import type { RoastEvent } from "@prisma/client";

export default function LiveTipsPanel({
  roastSessionId,
  startedAt,
  events,
  baseline,
  referenceRoast,
  planDivergedAtSeconds,
  milestoneTempBaseline,
  originalPlanTargets,
}: {
  roastSessionId: string;
  startedAt: string;
  events: RoastEvent[];
  baseline: HistoricalBaseline;
  referenceRoast?: ReferenceRoast | null;
  planDivergedAtSeconds?: number;
  milestoneTempBaseline?: MilestoneTempBaseline | null;
  originalPlanTargets?: PlanTargets;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const phases = computeRoastPhases(events, elapsed);
  const probeReadings = useProbeReadings(roastSessionId);
  const curveReadings = useMemo(
    () => getCurveReadings(events, probeReadings ?? []),
    [events, probeReadings]
  );
  const tips = generateLiveTips({
    elapsedSeconds: elapsed,
    events,
    baseline,
    referenceRoast,
    curveReadings,
    planDivergedAtSeconds,
    milestoneTempBaseline,
    originalPlanTargets,
  });

  return (
    <div className="flex flex-col gap-3">
      <PhaseBar phases={phases} />
      {tips.length > 0 && (
        <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Tips
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
            {tips.map((tip) => (
              <li key={tip.id}>{tip.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            General guidance, not personalized coaching — use your judgment.
          </p>
        </div>
      )}
    </div>
  );
}

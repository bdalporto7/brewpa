"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { useProbeReadings } from "@/lib/useProbeReadings";
import { computeRoastPhases } from "@/lib/phases";
import { getCurveReadings, type PlanTargets } from "@/lib/curve";
import { generateLiveTips, type HistoricalBaseline, type MilestoneTempBaseline, type ReferenceRoast } from "@/lib/tips";
import PhaseBar from "@/components/roasts/PhaseBar";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
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
        <Card interactive={false} className="p-4">
          <Eyebrow icon={<Sparkles className="h-3.5 w-3.5" />} className="mb-2">
            Tips
          </Eyebrow>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
            {tips.map((tip) => (
              <li key={tip.id}>{tip.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            General guidance, not personalized coaching — use your judgment.
          </p>
        </Card>
      )}
    </div>
  );
}

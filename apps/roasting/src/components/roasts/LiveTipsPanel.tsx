"use client";

import { useMemo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
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
  // Collapsed by default, like every other secondary panel on the live
  // page — but internally, not via an external SectionCard wrapper: this
  // component keeps polling (useProbeReadings, below) the whole time it's
  // on screen, and PhaseBar is compact enough to stay visible even while
  // the tips list itself is tucked away.
  const [collapsed, setCollapsed] = useState(true);
  const elapsed = useElapsedSeconds(startedAt);
  const phases = computeRoastPhases(events, elapsed);
  const probeReadings = useProbeReadings(roastSessionId);
  // generateLiveTips only reads temp/RoR off these — controls irrelevant here.
  // Bean-only: a second (e.g. environment) probe channel posts under a
  // different probeType and would otherwise corrupt this series — see
  // LiveRoastBars.tsx's identical filter for the full reasoning.
  const curveReadings = useMemo(
    () => getCurveReadings(events, (probeReadings ?? []).filter((r) => r.probeType === "bean"), []),
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
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1.5"
          >
            <Eyebrow icon={<Sparkles className="h-3.5 w-3.5" />}>Tips</Eyebrow>
            <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          </button>
          {!collapsed && (
            <div className="mt-2">
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
        </Card>
      )}
    </div>
  );
}

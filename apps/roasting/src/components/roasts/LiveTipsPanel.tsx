"use client";

import { Sparkles } from "lucide-react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { computeRoastPhases } from "@/lib/phases";
import { generateLiveTips, type HistoricalBaseline } from "@/lib/tips";
import PhaseBar from "@/components/roasts/PhaseBar";
import type { RoastEvent } from "@prisma/client";

export default function LiveTipsPanel({
  startedAt,
  events,
  baseline,
}: {
  startedAt: string;
  events: RoastEvent[];
  baseline: HistoricalBaseline;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const phases = computeRoastPhases(events, elapsed);
  const tips = generateLiveTips({ elapsedSeconds: elapsed, events, baseline });

  return (
    <div className="flex flex-col gap-3">
      <PhaseBar phases={phases} />
      {tips.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
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

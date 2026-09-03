"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import RatingBeans from "@/components/ui/RatingBeans";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean, RoastSession } from "@prisma/client";

export default function RoastSessionCard({
  session,
}: {
  session: RoastSession & { bean: Bean };
}) {
  const router = useRouter();
  const durationSeconds =
    session.endedAt != null && session.startedAt != null
      ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
      : null;
  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;
  const roastedPercentLeft =
    session.roastedWeightGrams != null && session.roastedWeightGrams > 0
      ? ((session.roastedRemainingGrams ?? 0) / session.roastedWeightGrams) * 100
      : null;

  return (
    // Not wrapped in a <Link> — TapCircleLink below already renders a real
    // anchor on the name, and nesting a second one around the whole card
    // is invalid HTML. router.push keeps "click anywhere on the card"
    // navigation instead; stopPropagation on the name stops that same
    // click from firing both the anchor's navigation and this one.
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/roasts/${session.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">
            <span onClick={(e) => e.stopPropagation()}>
              <TapCircleLink href={`/roasts/${session.id}`} className="hover:text-accent">
                {session.bean.name}
              </TapCircleLink>
            </span>
            {session.roastLevel && (
              <span className="font-normal text-muted"> — {session.roastLevel}</span>
            )}
          </h3>
          <p className="text-sm text-muted">
            {session.startedAt ? format(session.startedAt, "MMM d, yyyy") : "Not started yet"} ·{" "}
            {session.greenWeightGrams}g green
            {session.roastedWeightGrams != null && ` → ${session.roastedWeightGrams}g roasted`}
            {weightLoss != null && ` (${weightLoss.toFixed(1)}% loss)`}
            {durationSeconds != null && ` · ${formatMMSS(durationSeconds)}`}
          </p>
        </div>
        {session.rating != null && <RatingBeans rating={session.rating} max={5} className="shrink-0" />}
      </div>

      {roastedPercentLeft != null && (
        <div className="mt-2">
          <div className="flex justify-between font-mono text-xs text-muted">
            <span>{Math.round((session.roastedRemainingGrams ?? 0) * 10) / 10}g roasted coffee on hand</span>
            <span>{Math.round(roastedPercentLeft)}%</span>
          </div>
          <div className="mt-1">
            <ProgressBar percent={roastedPercentLeft} />
          </div>
        </div>
      )}
    </Card>
  );
}

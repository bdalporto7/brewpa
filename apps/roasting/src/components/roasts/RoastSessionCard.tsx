"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatMMSS } from "@/lib/format";
import LedgerRow from "@/components/ui/LedgerRow";
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
    <LedgerRow
      onClick={() => router.push(`/roasts/${session.id}`)}
      percent={roastedPercentLeft ?? undefined}
      low={roastedPercentLeft != null && roastedPercentLeft <= 15}
      gaugeLabel={
        roastedPercentLeft != null &&
        `${Math.round((session.roastedRemainingGrams ?? 0) * 10) / 10}g (${Math.round(roastedPercentLeft)}%)`
      }
      trailing={session.rating != null && <RatingBeans rating={session.rating} max={5} className="justify-end" />}
      primary={
        <>
          <span onClick={(e) => e.stopPropagation()}>
            <TapCircleLink href={`/roasts/${session.id}`} className="hover:text-accent">
              {session.bean.name}
            </TapCircleLink>
          </span>
          {session.roastLevel && <span className="font-normal text-muted"> — {session.roastLevel}</span>}
        </>
      }
      secondary={
        <>
          {session.startedAt ? format(session.startedAt, "MMM d, yyyy") : "Not started yet"} ·{" "}
          {session.greenWeightGrams}g green
          {session.roastedWeightGrams != null && ` → ${session.roastedWeightGrams}g roasted`}
          {weightLoss != null && ` (${weightLoss.toFixed(1)}% loss)`}
          {durationSeconds != null && ` · ${formatMMSS(durationSeconds)}`}
        </>
      }
    />
  );
}

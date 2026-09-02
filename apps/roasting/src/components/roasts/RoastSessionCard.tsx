import Link from "next/link";
import { format } from "date-fns";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import RatingBeans from "@/components/ui/RatingBeans";
import type { Bean, RoastSession } from "@prisma/client";

export default function RoastSessionCard({
  session,
}: {
  session: RoastSession & { bean: Bean };
}) {
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
    <Link href={`/roasts/${session.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">
              {session.bean.name}
              {session.roastLevel && (
                <span className="font-normal text-muted"> — {session.roastLevel}</span>
              )}
            </h3>
            <p className="text-sm text-muted">
              {session.startedAt ? format(session.startedAt, "MMM d, yyyy") : "Not started yet"} ·{" "}
              {session.greenWeightGrams}g green
              {session.roastedWeightGrams != null && ` → ${session.roastedWeightGrams}g roasted`}
              {weightLoss != null && ` (${weightLoss.toFixed(1)}% loss)`}
            </p>
          </div>
          {session.rating != null && <RatingBeans rating={session.rating} max={5} className="shrink-0" />}
        </div>

        {roastedPercentLeft != null && (
          <div className="mt-3">
            <div className="flex justify-between font-mono text-xs text-muted">
              <span>{Math.round((session.roastedRemainingGrams ?? 0) * 10) / 10}g roasted coffee on hand</span>
              <span>{Math.round(roastedPercentLeft)}%</span>
            </div>
            <div className="mt-1">
              <ProgressBar percent={roastedPercentLeft} />
            </div>
          </div>
        )}

        {durationSeconds != null && (
          <p className="mt-2 font-mono text-xs text-muted">{formatMMSS(durationSeconds)} total</p>
        )}
      </Card>
    </Link>
  );
}

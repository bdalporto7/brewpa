import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { Bean, RoastSession } from "@prisma/client";

/** Same 15% threshold as BeanStockBar/BeanRoastedSummaryCard's own "isLow" styling — one definition of "running low" everywhere it shows up. */
export default function LowStockBanner({
  lowGreenBeans,
  lowRoastedSessions,
  runningOutSoon = [],
}: {
  lowGreenBeans: Bean[];
  lowRoastedSessions: (RoastSession & { bean: Bean })[];
  /** Beans projected to run out within REORDER_WARNING_DAYS at their actual
   * roasting pace (inventoryVelocity.ts) — a separate condition from the
   * flat %-remaining one above, and deliberately not deduped against it in
   * the caller's filters: a bean can be both low AND fast-burning, and
   * showing it once per reason it needs attention is fine. */
  runningOutSoon?: { bean: Bean; daysLeft: number }[];
}) {
  if (lowGreenBeans.length === 0 && lowRoastedSessions.length === 0 && runningOutSoon.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-warning/50 bg-warning/10 px-4 py-3 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-warning">
        <TriangleAlert className="h-4 w-4" />
        Running low:
      </span>
      {lowGreenBeans.map((b) => (
        <Link
          key={b.id}
          href={`/beans/${b.id}`}
          className="rounded-full border border-warning/40 px-2.5 py-0.5 text-xs text-warning transition hover:bg-warning/15"
        >
          {b.name} · green ({Math.round(b.remainingGrams * 10) / 10}g)
        </Link>
      ))}
      {lowRoastedSessions.map((s) => (
        <Link
          key={s.id}
          href={`/roasts/${s.id}`}
          className="rounded-full border border-warning/40 px-2.5 py-0.5 text-xs text-warning transition hover:bg-warning/15"
        >
          {s.bean.name} · roasted ({Math.round((s.roastedRemainingGrams ?? 0) * 10) / 10}g)
        </Link>
      ))}
      {runningOutSoon.map(({ bean, daysLeft }) => (
        <Link
          key={`pace-${bean.id}`}
          href={`/beans/${bean.id}`}
          className="rounded-full border border-warning/40 px-2.5 py-0.5 text-xs text-warning transition hover:bg-warning/15"
        >
          {bean.name} · ~{Math.round(daysLeft)}d left at current pace
        </Link>
      ))}
    </div>
  );
}

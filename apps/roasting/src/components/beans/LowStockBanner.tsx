import Link from "next/link";
import { TriangleAlert, X } from "lucide-react";
import type { Bean, RoastSession } from "@prisma/client";
import { dismissLowStock } from "@/lib/actions";

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
        <Pill key={b.id} beanId={b.id} href={`/beans/${b.id}`}>
          {b.name} · green ({Math.round(b.remainingGrams * 10) / 10}g)
        </Pill>
      ))}
      {lowRoastedSessions.map((s) => (
        <Pill key={s.id} beanId={s.bean.id} href={`/roasts/${s.id}`}>
          {s.bean.name} · roasted ({Math.round((s.roastedRemainingGrams ?? 0) * 10) / 10}g)
        </Pill>
      ))}
      {runningOutSoon.map(({ bean, daysLeft }) => (
        <Pill key={`pace-${bean.id}`} beanId={bean.id} href={`/beans/${bean.id}`}>
          {bean.name} · ~{Math.round(daysLeft)}d left at current pace
        </Pill>
      ))}
    </div>
  );
}

/**
 * The × dismisses this bean's warning for good — Bean.lowStockDismissed,
 * cleared automatically the next time this bean is restocked
 * (adjustBeanStock's "add" case) rather than needing any manual undo. A
 * plain `<form action={...}>` rather than a client component: the whole
 * banner stays a server component this way, same pattern as NavClient's
 * logout form.
 */
function Pill({ beanId, href, children }: { beanId: string; href: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center overflow-hidden rounded-full border border-warning/40 text-xs text-warning">
      <Link href={href} className="px-2.5 py-0.5 transition hover:bg-warning/15">
        {children}
      </Link>
      <form action={dismissLowStock.bind(null, beanId)}>
        <button
          type="submit"
          aria-label="Dismiss this warning"
          title="Dismiss — reappears if this bean is restocked and runs low again"
          className="flex h-full items-center border-l border-warning/40 px-1.5 py-0.5 transition hover:bg-warning/25"
        >
          <X className="h-3 w-3" />
        </button>
      </form>
    </span>
  );
}

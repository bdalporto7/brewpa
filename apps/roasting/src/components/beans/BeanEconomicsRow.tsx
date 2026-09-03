"use client";

import { useRouter } from "next/navigation";
import LedgerRow from "@/components/ui/LedgerRow";
import TapCircleLink from "@/components/ui/TapCircleLink";
import { formatCurrency } from "@/lib/format";

/**
 * Same router.push + LedgerRow shape as BeanRoastedSummaryCard/RoastSessionCard
 * — LedgerRow's onClick needs a Client Component boundary, and the
 * `/business` page itself is a plain async Server Component like every
 * other page, so this is the small client wrapper for just the row.
 * Doesn't use LedgerRow's percent/gauge column — profit isn't naturally a
 * 0-100% bar (it can be negative), so the money figure just sits in
 * `trailing` instead.
 */
export default function BeanEconomicsRow({
  beanId,
  beanName,
  roastCount,
  totalCost,
  revenue,
  profit,
}: {
  beanId: string;
  beanName: string;
  roastCount: number;
  totalCost: number;
  revenue: number;
  profit: number;
}) {
  const router = useRouter();

  return (
    <LedgerRow
      onClick={() => router.push(`/beans/${beanId}`)}
      primary={
        <span onClick={(e) => e.stopPropagation()}>
          <TapCircleLink href={`/beans/${beanId}`} className="hover:text-accent">
            {beanName}
          </TapCircleLink>
        </span>
      }
      secondary={
        <>
          {roastCount} roast{roastCount === 1 ? "" : "s"} · cost {formatCurrency(totalCost)} · sold{" "}
          {formatCurrency(revenue)}
        </>
      }
      trailing={
        <span className={`font-mono text-sm font-semibold ${profit >= 0 ? "text-success" : "text-danger"}`}>
          {formatCurrency(profit)}
        </span>
      }
    />
  );
}

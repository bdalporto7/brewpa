"use client";

import { useRouter } from "next/navigation";
import LedgerRow from "@/components/ui/LedgerRow";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean } from "@prisma/client";

export default function BeanRoastedSummaryCard({
  bean,
  remainingGrams,
  totalGrams,
  roastCount,
}: {
  bean: Bean;
  remainingGrams: number;
  totalGrams: number;
  roastCount: number;
}) {
  const router = useRouter();
  const percentLeft = totalGrams > 0 ? (remainingGrams / totalGrams) * 100 : 0;
  const isLow = percentLeft <= 15 && percentLeft > 0;

  return (
    <LedgerRow
      onClick={() => router.push(`/beans/${bean.id}`)}
      percent={percentLeft}
      low={isLow}
      gaugeLabel={`${remainingGrams}g (${Math.round(percentLeft)}%)`}
      primary={
        <span onClick={(e) => e.stopPropagation()}>
          <TapCircleLink href={`/beans/${bean.id}`} className="hover:text-accent">
            {bean.name}
          </TapCircleLink>
        </span>
      }
      secondary={
        <>
          {bean.origin} · {bean.process} · {roastCount} roast{roastCount === 1 ? "" : "s"}
        </>
      }
    />
  );
}

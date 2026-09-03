"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
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
    // router.push, not a wrapping <Link> — TapCircleLink on the name
    // already renders a real anchor; see RoastSessionCard for the reasoning.
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/beans/${bean.id}`)}
    >
      <h3 className="font-medium" onClick={(e) => e.stopPropagation()}>
        <TapCircleLink href={`/beans/${bean.id}`}>{bean.name}</TapCircleLink>
      </h3>
      <p className="text-sm text-muted">
        {bean.origin} · {bean.process}
      </p>

      <div className="mt-2">
        <div className="flex justify-between font-mono text-xs text-muted">
          <span>
            {remainingGrams}g left of {totalGrams}g · {roastCount} roast{roastCount === 1 ? "" : "s"}
          </span>
          <span>{Math.round(percentLeft)}%</span>
        </div>
        <div className="mt-1">
          <ProgressBar percent={percentLeft} low={isLow} />
        </div>
      </div>
    </Card>
  );
}

import Link from "next/link";
import Card from "@/components/ui/Card";
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
  const percentLeft = totalGrams > 0 ? (remainingGrams / totalGrams) * 100 : 0;
  const isLow = percentLeft <= 15 && percentLeft > 0;

  return (
    <Link href={`/beans/${bean.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <h3 className="font-medium">{bean.name}</h3>
        <p className="text-sm text-muted">
          {bean.origin} · {bean.process}
        </p>

        <div className="mt-3">
          <div className="flex justify-between font-mono text-xs text-muted">
            <span>{remainingGrams}g left of {totalGrams}g</span>
            <span>{Math.round(percentLeft)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
            <div
              className={`pour-fill h-full rounded-full ${isLow ? "bg-warning" : "bg-accent"}`}
              style={
                // @ts-expect-error -- custom property consumed by the pour-fill keyframe
                { "--fill-width": `${Math.max(0, Math.min(100, percentLeft))}%` }
              }
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-muted">
          {roastCount} roast{roastCount === 1 ? "" : "s"}
        </p>
      </Card>
    </Link>
  );
}

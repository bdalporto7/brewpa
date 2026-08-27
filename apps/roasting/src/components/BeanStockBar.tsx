"use client";

import { adjustBeanStock, setBeanStock } from "@/lib/actions";
import StockAdjuster from "@/components/StockAdjuster";
import type { Bean } from "@prisma/client";

export default function BeanStockBar({ bean }: { bean: Bean }) {
  const percentLeft = bean.weightGrams > 0 ? (bean.remainingGrams / bean.weightGrams) * 100 : 0;
  const isLow = percentLeft <= 15;

  return (
    <div>
      <div className="flex items-start justify-between">
        <StockAdjuster
          currentGrams={bean.remainingGrams}
          unitLabel={`left of ${Math.round(bean.weightGrams * 10) / 10}g`}
          onAdd={adjustBeanStock.bind(null, bean.id, "add")}
          onRemove={adjustBeanStock.bind(null, bean.id, "remove")}
          onSet={setBeanStock.bind(null, bean.id)}
        />
        <span className="font-mono text-xs text-muted">{Math.round(percentLeft)}%</span>
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
  );
}

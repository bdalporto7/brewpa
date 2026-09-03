"use client";

import { adjustBeanStock, setBeanStock } from "@/lib/actions";
import StockAdjuster from "@/components/StockAdjuster";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Bean } from "@prisma/client";

export default function BeanStockBar({ bean }: { bean: Bean }) {
  const percentLeft = bean.weightGrams > 0 ? (bean.remainingGrams / bean.weightGrams) * 100 : 0;
  const isLow = percentLeft <= 15;

  return (
    <div>
      {/* flex-wrap: StockAdjuster's closed state is a short line of text,
          but its open "adjust"/"set" state is an input plus several
          buttons — much wider. Wrapping (rather than a fixed-width parent
          forcing an overflow) lets the percent drop to its own line when
          that happens instead of clipping or overlapping. */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <StockAdjuster
          currentGrams={bean.remainingGrams}
          unitLabel={`left of ${Math.round(bean.weightGrams * 10) / 10}g`}
          onAdd={adjustBeanStock.bind(null, bean.id, "add")}
          onRemove={adjustBeanStock.bind(null, bean.id, "remove")}
          onSet={setBeanStock.bind(null, bean.id)}
        />
        <span className="font-mono text-xs text-muted">{Math.round(percentLeft)}%</span>
      </div>
      <div className="mt-1">
        <ProgressBar percent={percentLeft} low={isLow} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { costPerBag, DEFAULT_LOSS_PERCENT, formatWeight } from "@/lib/inventory-connector/math";
import { formatCurrency } from "@/lib/inventory-connector/client";

type LotCost = {
  id: string;
  name: string;
  purchasePrice: number | null;
  weightGrams: number;
  sessions: { greenWeightGrams: number; roastedWeightGrams: number | null }[];
};

const BAG_PRESETS = [
  { label: "250g", grams: 250 },
  { label: "12oz", grams: 340 },
  { label: "1lb", grams: 454 },
];

/**
 * True cost per bag: lot price → green cost/gram → through measured (or
 * assumed) weight loss → one filled bag. Lots without a recorded price
 * are listed as unknown — never treated as free.
 */
export default function CostsClient({ lots }: { lots: LotCost[] }) {
  const [bagGrams, setBagGrams] = useState<number>(340);
  const [custom, setCustom] = useState<string>("");

  const priced = lots.filter((l) => l.purchasePrice != null);
  const unpriced = lots.filter((l) => l.purchasePrice == null);

  return (
    <div className="flex flex-col gap-6">
      <Card interactive={false} className="p-4">
        <Eyebrow className="mb-2">Bag size</Eyebrow>
        <div className="flex flex-wrap items-center gap-2">
          {BAG_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setBagGrams(p.grams); setCustom(""); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                bagGrams === p.grams && custom === ""
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            aria-label="Custom bag size in grams"
            type="number"
            min="1"
            step="any"
            inputMode="decimal"
            value={custom}
            placeholder="Custom g"
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n) && n > 0) setBagGrams(n);
            }}
            className="w-28 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {priced.map((lot) => {
          const cost = costPerBag(lot, lot.sessions, bagGrams);
          if (!cost) return null;
          return (
            <Card key={lot.id} interactive={false} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/inventory/lots/${lot.id}`} className="text-sm font-semibold hover:underline">
                  {lot.name}
                </Link>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {formatCurrency(cost.costPerBag)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {formatCurrency(cost.greenCostPerGram)}/g green · {formatWeight(cost.greenGramsPerBag)} green per bag ·{" "}
                {cost.lossPercent.toFixed(1)}% loss {cost.lossMeasured ? "(measured)" : "(assumed)"}
              </p>
            </Card>
          );
        })}
      </div>

      {unpriced.length > 0 && (
        <div>
          <Eyebrow className="mb-2">No price recorded</Eyebrow>
          <p className="mb-2 text-xs text-muted">Cost unknown — add a purchase price on the lot to include it here.</p>
          <div className="flex flex-wrap gap-2">
            {unpriced.map((lot) => (
              <Link
                key={lot.id}
                href={`/inventory/lots/${lot.id}/edit`}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                {lot.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        * Assumed {DEFAULT_LOSS_PERCENT}% loss wherever a lot has no completed roasts with recorded yield.
      </p>
    </div>
  );
}

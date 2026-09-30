"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { SelectField } from "@/components/ui/Field";
import {
  roastedYield,
  greenNeeded,
  measuredLossPercent,
  DEFAULT_LOSS_PERCENT,
  formatWeight,
} from "@/lib/inventory-connector/math";

type LotInfo = {
  id: string;
  name: string;
  sessions: { greenWeightGrams: number; roastedWeightGrams: number | null }[];
};

/**
 * Two-way roast calculator: green → roasted, or roasted target → green
 * needed. Weight-loss % defaults to the selected lot's measured loss,
 * falling back to the 16% assumption (always labeled as such).
 */
export default function CalculatorClient({ lots }: { lots: LotInfo[] }) {
  const [lotId, setLotId] = useState<string>("");
  const [lossInput, setLossInput] = useState<string>("");
  const [green, setGreen] = useState<string>("");
  const [roasted, setRoasted] = useState<string>("");

  const lot = lots.find((l) => l.id === lotId);
  const measured = lot ? measuredLossPercent(lot.sessions) : null;
  const lossPercent = lossInput !== "" ? Number(lossInput) : (measured ?? DEFAULT_LOSS_PERCENT);
  const lossSource =
    lossInput !== "" ? "entered" : measured != null ? "measured from this lot's roasts" : "assumed";

  function onGreenChange(v: string) {
    setGreen(v);
    const n = Number(v);
    setRoasted(v === "" || !Number.isFinite(n) ? "" : String(Math.round(roastedYield(n, lossPercent) * 10) / 10));
  }

  function onRoastedChange(v: string) {
    setRoasted(v);
    const n = Number(v);
    setGreen(v === "" || !Number.isFinite(n) ? "" : String(Math.round(greenNeeded(n, lossPercent) * 10) / 10));
  }

  // Recompute the paired field when the loss % changes.
  function onLossChange(v: string) {
    setLossInput(v);
    const lp = v !== "" ? Number(v) : (measured ?? DEFAULT_LOSS_PERCENT);
    if (green !== "" && Number.isFinite(Number(green))) {
      setRoasted(String(Math.round(roastedYield(Number(green), lp) * 10) / 10));
    } else if (roasted !== "" && Number.isFinite(Number(roasted))) {
      setGreen(String(Math.round(greenNeeded(Number(roasted), lp) * 10) / 10));
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm text-foreground focus:border-accent focus:outline-none";

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Card interactive={false} className="flex flex-col gap-4 p-4 sm:p-5">
        <SelectField label="Lot (optional — uses its measured weight loss)" name="lotId" value={lotId} onChange={(e) => { setLotId(e.target.value); setLossInput(""); }}>
          <option value="">No lot — use the default</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="loss">
            Weight loss %
          </label>
          <input
            id="loss"
            type="number"
            min="0"
            max="60"
            step="0.1"
            inputMode="decimal"
            value={lossInput}
            placeholder={String(measured ?? DEFAULT_LOSS_PERCENT)}
            onChange={(e) => onLossChange(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-muted">
            {lossSource === "entered"
              ? "Using your entered value."
              : lossSource.startsWith("measured")
                ? `Measured from this lot's roasts (${measured!.toFixed(1)}%).`
                : `Assumed ${DEFAULT_LOSS_PERCENT}% — no completed roasts with recorded yield.`}
          </p>
        </div>
      </Card>

      <Card interactive={false} className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <Eyebrow className="mb-2">Green in → roasted out</Eyebrow>
          <div className="flex items-center gap-3">
            <input
              aria-label="Green weight in grams"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={green}
              onChange={(e) => onGreenChange(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
            <span className="text-sm text-muted">g green →</span>
            <input
              aria-label="Roasted weight in grams"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={roasted}
              onChange={(e) => onRoastedChange(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
            <span className="text-sm text-muted">g roasted</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Type in either box — the other converts. Both directions use the same {Number.isFinite(lossPercent) ? lossPercent : "—"}%
            loss.
          </p>
        </div>
      </Card>

      {green !== "" && Number(green) > 0 && (
        <p className="text-sm text-muted">
          {formatWeight(Number(green))} of green yields about {formatWeight(Number(roasted) || 0)} roasted.
        </p>
      )}
    </div>
  );
}

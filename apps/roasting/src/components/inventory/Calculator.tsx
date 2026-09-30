"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { WEIGHT_UNITS, toGrams, fromGrams, formatWeight, type WeightUnit } from "@/lib/units";
import { roastedYield, greenNeeded, DEFAULT_LOSS_PERCENT } from "@/lib/inventory";

/**
 * Two-way roast calculator, fully client-side — no data needed, nothing
 * saved. Left: green in → roasted yield → how many bags that fills.
 * Right: bags wanted → green to buy/roast. Weight-loss % is adjustable on
 * both, defaulting to the measured-when-available constant's fallback.
 */
function UnitSelect({
  value,
  onChange,
  label,
}: {
  value: WeightUnit;
  onChange: (u: WeightUnit) => void;
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WeightUnit)}
      aria-label={label}
      className="rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium focus:border-accent focus:outline-none"
    >
      {WEIGHT_UNITS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  step = "any",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: WeightUnit;
  onUnitChange?: (u: WeightUnit) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
        />
        {unit && onUnitChange && <UnitSelect value={unit} onChange={onUnitChange} label={`${label} unit`} />}
      </div>
    </div>
  );
}

function Result({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-background px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function Calculator() {
  // Green → roasted → bags
  const [green, setGreen] = useState("1000");
  const [greenUnit, setGreenUnit] = useState<WeightUnit>("g");
  const [lossA, setLossA] = useState(String(DEFAULT_LOSS_PERCENT));
  const [bagSizeA, setBagSizeA] = useState("340");
  const [bagUnitA, setBagUnitA] = useState<WeightUnit>("g");

  // Bags → green
  const [bagCount, setBagCount] = useState("20");
  const [bagSizeB, setBagSizeB] = useState("340");
  const [bagUnitB, setBagUnitB] = useState<WeightUnit>("g");
  const [lossB, setLossB] = useState(String(DEFAULT_LOSS_PERCENT));

  const greenGrams = toGrams(Number(green) || 0, greenUnit);
  const lossPctA = Number(lossA) || 0;
  const roastedGrams = roastedYield(greenGrams, lossPctA);
  const bagGramsA = toGrams(Number(bagSizeA) || 0, bagUnitA);
  const bagsOut = bagGramsA > 0 ? Math.floor(roastedGrams / bagGramsA) : 0;
  const leftover = bagGramsA > 0 ? roastedGrams - bagsOut * bagGramsA : 0;

  const bagsWanted = Number(bagCount) || 0;
  const bagGramsB = toGrams(Number(bagSizeB) || 0, bagUnitB);
  const lossPctB = Number(lossB) || 0;
  const greenRequired = greenNeeded(bagsWanted * bagGramsB, lossPctB);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ArrowLeftRight className="h-4 w-4 text-accent" />
          Green → roasted → bags
        </h2>
        <NumberInput label="Green coffee" value={green} onChange={setGreen} unit={greenUnit} onUnitChange={setGreenUnit} />
        <NumberInput label="Weight loss %" value={lossA} onChange={setLossA} step="0.5" />
        <NumberInput label="Bag size" value={bagSizeA} onChange={setBagSizeA} unit={bagUnitA} onUnitChange={setBagUnitA} />
        <div className="flex flex-col gap-2">
          <Result label="Roasted yield" value={formatWeight(roastedGrams)} sub={`${lossPctA}% loss assumed`} />
          <Result
            label="Full bags"
            value={String(bagsOut)}
            sub={leftover > 1 ? `${formatWeight(leftover)} left over` : "no meaningful leftover"}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ArrowLeftRight className="h-4 w-4 text-accent" />
          Bags → green needed
        </h2>
        <NumberInput label="Bags wanted" value={bagCount} onChange={setBagCount} step="1" />
        <NumberInput label="Bag size" value={bagSizeB} onChange={setBagSizeB} unit={bagUnitB} onUnitChange={setBagUnitB} />
        <NumberInput label="Weight loss %" value={lossB} onChange={setLossB} step="0.5" />
        <div className="flex flex-col gap-2">
          <Result
            label="Green coffee needed"
            value={Number.isFinite(greenRequired) ? formatWeight(greenRequired) : "—"}
            sub={`${formatWeight(bagsWanted * bagGramsB)} roasted at ${lossPctB}% loss`}
          />
          <Result
            label="In pounds"
            value={Number.isFinite(greenRequired) ? `${(fromGrams(greenRequired, "lb")).toFixed(2)} lb` : "—"}
            sub="for ordering"
          />
        </div>
      </section>
    </div>
  );
}

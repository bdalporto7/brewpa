"use client";

import { useState } from "react";
import { WEIGHT_UNITS, toGrams, fromGrams, type WeightUnit } from "@/lib/units";

/**
 * Weight input with an in-place unit switcher (g/kg/lb/oz). The number the
 * roaster sees converts when the unit changes; the hidden input always
 * submits grams — the database never sees a unit. Same component on every
 * weight field in the inventory section so the interaction is identical
 * everywhere.
 */
export default function WeightInput({
  name,
  label,
  defaultGrams,
  defaultUnit = "g",
  required = false,
  placeholder,
  hint,
}: {
  /** Name of the hidden input that submits grams. */
  name: string;
  label: string;
  defaultGrams?: number | null;
  defaultUnit?: WeightUnit;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [unit, setUnit] = useState<WeightUnit>(defaultUnit);
  const [display, setDisplay] = useState<string>(
    defaultGrams != null ? String(Math.round(fromGrams(defaultGrams, defaultUnit) * 100) / 100) : ""
  );

  const grams = display === "" || Number.isNaN(Number(display)) ? "" : String(toGrams(Number(display), unit));

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={display}
          onChange={(e) => setDisplay(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <select
          value={unit}
          onChange={(e) => {
            const next = e.target.value as WeightUnit;
            // Convert the visible number so the *weight* stays the same —
            // switching g→kg divides the number, not the quantity.
            if (display !== "" && !Number.isNaN(Number(display))) {
              const g = toGrams(Number(display), unit);
              setDisplay(String(Math.round(fromGrams(g, next) * 1000) / 1000));
            }
            setUnit(next);
          }}
          aria-label={`${label} unit`}
          className="rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium focus:border-accent focus:outline-none"
        >
          {WEIGHT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <input type="hidden" name={name} value={grams} />
    </div>
  );
}

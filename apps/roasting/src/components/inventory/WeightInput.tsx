"use client";

import { useState } from "react";
import { WEIGHT_UNITS, fromGrams, toGrams, type WeightUnit } from "@/lib/inventory-connector/math";

/**
 * A weight field with a g/kg/lb/oz switcher. The displayed number converts
 * in place when the unit changes; the form submits the raw number plus the
 * unit (`<name>` / `<name>Unit`) and the server converts to grams — one
 * conversion path, owned server-side.
 */
export default function WeightInput({
  label,
  name,
  defaultGrams,
  required,
}: {
  label: string;
  name: string;
  defaultGrams?: number | null;
  required?: boolean;
}) {
  const [unit, setUnit] = useState<WeightUnit>("g");
  const [display, setDisplay] = useState<string>(
    defaultGrams != null && defaultGrams > 0 ? String(Math.round(fromGrams(defaultGrams, "g") * 100) / 100) : ""
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted" htmlFor={`${name}-display`}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`${name}-display`}
          name={name}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={display}
          required={required}
          onChange={(e) => setDisplay(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <select
          name={`${name}Unit`}
          aria-label={`${label} unit`}
          value={unit}
          onChange={(e) => {
            const next = e.target.value as WeightUnit;
            const n = Number(display);
            if (display !== "" && Number.isFinite(n)) {
              setDisplay(String(Math.round(fromGrams(toGrams(n, unit), next) * 100) / 100));
            }
            setUnit(next);
          }}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          {WEIGHT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import type { BlendRecipe, BlendComponent } from "@prisma/client";

type LotOption = { id: string; name: string; remainingGrams: number };
type ComponentRow = { beanId: string; ratioPercent: string };

/**
 * Create/edit form for a blend recipe. Component shares must add up to
 * 100% — enforced again server-side, since a 97% blend would silently
 * drop 3% of every batch.
 */
export default function BlendRecipeForm({
  recipe,
  lots,
  action,
  submitLabel,
}: {
  recipe?: BlendRecipe & { components: BlendComponent[] };
  lots: LotOption[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const [rows, setRows] = useState<ComponentRow[]>(
    recipe
      ? recipe.components.map((c) => ({ beanId: c.beanId, ratioPercent: String(c.ratioPercent) }))
      : [
          { beanId: "", ratioPercent: "" },
          { beanId: "", ratioPercent: "" },
        ]
  );

  const total = rows.reduce((sum, r) => sum + (Number(r.ratioPercent) || 0), 0);

  function setRow(i: number, patch: Partial<ComponentRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <Card interactive={false} className="p-4 sm:p-5">
      <Form
        action={async (formData) => {
          formData.set(
            "componentsJson",
            JSON.stringify(
              rows.map((r) => ({ beanId: r.beanId, ratioPercent: Number(r.ratioPercent) }))
            )
          );
          await action(formData);
        }}
        successMessage="Blend saved"
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Blend name *" name="name" required defaultValue={recipe?.name ?? ""} />
        </div>
        <TextareaField label="Notes" name="notes" rows={2} defaultValue={recipe?.notes ?? ""} />

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Components</p>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <SelectField label={i === 0 ? "Lot" : ""} name={`_bean_${i}`} value={row.beanId} onChange={(e) => setRow(i, { beanId: e.target.value })}>
                    <option value="">Choose a lot…</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id} disabled={rows.some((r, j) => j !== i && r.beanId === lot.id)}>
                        {lot.name} ({Math.round(lot.remainingGrams)}g)
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div className="w-24">
                  <TextField
                    label={i === 0 ? "Share %" : ""}
                    name={`_ratio_${i}`}
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    value={row.ratioPercent}
                    onChange={(e) => setRow(i, { ratioPercent: e.target.value })}
                  />
                </div>
                {rows.length > 2 && (
                  <Button type="button" variant="danger" size="sm" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { beanId: "", ratioPercent: "" }])}
            >
              Add lot
            </Button>
            <p className={`font-mono text-sm tabular-nums ${Math.abs(total - 100) < 0.01 ? "text-foreground" : "text-danger"}`}>
              {Math.round(total * 10) / 10}% of 100%
            </p>
          </div>
        </div>

        <div>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Form>
    </Card>
  );
}

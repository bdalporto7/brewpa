"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createBlendRecipe, updateBlendRecipe } from "@/lib/inventory-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean, BlendRecipe, BlendComponent } from "@prisma/client";

interface ComponentRow {
  beanId: string;
  ratioPercent: string;
}

/**
 * Blend recipe form — dynamic component rows (lot + share %), with a live
 * total so the "must sum to 100%" rule is visible before submit, not just
 * a server error after. Used for both create and edit.
 */
export default function BlendRecipeForm({
  recipe,
  beans,
  onDone,
}: {
  recipe?: BlendRecipe & { components: BlendComponent[] };
  beans: Pick<Bean, "id" | "name" | "remainingGrams">[];
  onDone?: () => void;
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
  const totalOk = Math.abs(total - 100) < 0.01 && rows.length >= 2;

  const action = recipe ? updateBlendRecipe.bind(null, recipe.id) : createBlendRecipe;

  return (
    <ActionForm
      action={action}
      onSuccess={onDone}
      successMessage={recipe ? "Blend updated" : "Blend created"}
      className="flex flex-col gap-3"
    >
      <TextField label="Blend name *" name="name" required defaultValue={recipe?.name ?? ""} placeholder="e.g. House Espresso" />
      <TextareaField label="Notes" name="notes" rows={2} defaultValue={recipe?.notes ?? ""} placeholder="Target profile, brew methods…" />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">Components *</span>
          <span className={`font-mono text-sm font-semibold ${totalOk ? "text-success" : "text-warning"}`}>
            {Math.round(total * 10) / 10}% / 100%
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <SelectField
                  label={i === 0 ? "Lot" : ""}
                  // Not submitted by name — the action reads componentsJson.
                  name={`component-bean-${i}`}
                  value={row.beanId}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, beanId: e.target.value } : r)))}
                >
                  <option value="" disabled>
                    Select lot
                  </option>
                  {beans.map((b) => (
                    <option key={b.id} value={b.id} disabled={rows.some((r, j) => j !== i && r.beanId === b.id)}>
                      {b.name} ({Math.round(b.remainingGrams * 10) / 10}g)
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="w-24 shrink-0">
                <TextField
                  label={i === 0 ? "Share %" : ""}
                  // Not submitted by name — the action reads componentsJson.
                  name={`component-ratio-${i}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  mono
                  value={row.ratioPercent}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, ratioPercent: e.target.value } : r)))}
                  placeholder="%"
                />
              </div>
              {rows.length > 2 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="mb-1 shrink-0 rounded-lg p-2 text-muted hover:text-danger"
                  aria-label="Remove component"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <input
          type="hidden"
          name="componentsJson"
          value={JSON.stringify(
            rows
              .filter((r) => r.beanId && r.ratioPercent !== "")
              .map((r) => ({ beanId: r.beanId, ratioPercent: Number(r.ratioPercent) }))
          )}
        />
        <button
          type="button"
          onClick={() => setRows([...rows, { beanId: "", ratioPercent: "" }])}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add lot
        </button>
        {!totalOk && (
          <p className="mt-1 text-xs text-warning">Shares must add up to exactly 100%.</p>
        )}
      </div>

      <div>
        <Button type="submit" variant="primary" disabled={!totalOk}>
          {recipe ? "Save changes" : "Create blend"}
        </Button>
      </div>
    </ActionForm>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Upload, ScanLine, CheckCircle2 } from "lucide-react";
import { extractReceipt, addStockToBean, type ReceiptExtractionResult } from "@/lib/inventory-actions";
import { createBean } from "@/lib/actions";
import { toGrams, type WeightUnit } from "@/lib/units";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField, FileField } from "@/components/ui/Field";
import WeightInput from "@/components/inventory/WeightInput";
import type { Bean } from "@prisma/client";

/**
 * Receipt intake, two steps. Step 1 uploads the photo/PDF to Blob and runs
 * Claude vision over it; step 2 is the confirm screen — every extracted
 * field editable, then either a new lot (createBean) or stock added to a
 * matching existing lot. Nothing hits the database except the Blob file
 * until the roaster confirms — the same confirm-before-save rule as the
 * rest of the app's AI-assisted flows.
 */
export default function ReceiptScanFlow({ beans }: { beans: Pick<Bean, "id" | "name" | "remainingGrams">[] }) {
  const [result, extractAction, isExtracting] = useActionState<ReceiptExtractionResult, FormData>(
    async (_prev, formData) => extractReceipt(formData),
    { ok: false }
  );
  const [mode, setMode] = useState<"new" | "existing">("new");

  const fields = result.ok ? result.fields : undefined;

  if (!fields) {
    return (
      <form action={extractAction} className="flex flex-col gap-3">
        <FileField
          label="Receipt photo or PDF"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          required
        />
        <p className="-mt-1 text-xs text-muted">
          An order confirmation, invoice, or packing slip. Claude reads the supplier, coffee, weight,
          price, and date — you review everything before it saves.
        </p>
        {result.error && <p className="text-sm text-danger">{result.error}</p>}
        <div>
          <Button type="submit" variant="primary" disabled={isExtracting}>
            <span className="inline-flex items-center gap-2">
              {isExtracting ? <ScanLine className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
              {isExtracting ? "Reading receipt…" : "Scan receipt"}
            </span>
          </Button>
        </div>
      </form>
    );
  }

  const extractedGrams =
    fields.weightValue != null && fields.weightUnit != null
      ? toGrams(fields.weightValue, fields.weightUnit as WeightUnit)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl border border-success/40 bg-surface p-3.5 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <div>
          <p className="font-semibold">
            Receipt read{" "}
            <span className="font-normal text-muted">
              (confidence: {fields.confidence}
              {result.receiptUrl && (
                <>
                  {" · "}
                  <a href={result.receiptUrl} target="_blank" rel="noreferrer" className="underline hover:text-accent">
                    view file
                  </a>
                </>
              )}
              )
            </span>
          </p>
          <p className="mt-0.5 text-muted">Review and correct anything below — nothing has been saved yet.</p>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
          New lot
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} disabled={beans.length === 0} />
          Add to existing lot
        </label>
      </div>

      {mode === "new" ? (
        <ActionForm action={createBean} className="grid grid-cols-1 gap-3 sm:grid-cols-2" successMessage="Lot added">
          <TextField label="Name *" name="name" required defaultValue={fields.name ?? ""} />
          <TextField label="Origin *" name="origin" required defaultValue={fields.origin ?? ""} />
          <TextField label="Process *" name="process" required defaultValue={fields.process ?? ""} />
          <TextField label="Supplier" name="supplier" defaultValue={fields.supplier ?? ""} />
          <TextField
            label="Purchase date"
            name="purchaseDate"
            type="date"
            defaultValue={fields.purchaseDate ?? new Date().toISOString().slice(0, 10)}
          />
          <TextField
            label={`Purchase price${fields.currency ? ` (${fields.currency})` : ""}`}
            name="purchasePrice"
            type="number"
            min="0"
            step="any"
            mono
            defaultValue={fields.price ?? ""}
          />
          <WeightInput
            name="weightGrams"
            label="Lot weight *"
            defaultGrams={extractedGrams}
            defaultUnit={(fields.weightUnit as WeightUnit) ?? "g"}
            required
          />
          <div className="sm:col-span-2">
            <TextareaField label="Notes" name="notes" rows={2} defaultValue={fields.process ? `Process per receipt: ${fields.process}` : ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary">
              Create lot
            </Button>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={addStockToBean} className="grid grid-cols-1 gap-3 sm:grid-cols-2" successMessage="Stock added">
          <SelectField label="Lot" name="beanId" required defaultValue="">
            <option value="" disabled>
              Select a lot
            </option>
            {beans.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({Math.round(b.remainingGrams * 10) / 10}g on hand)
              </option>
            ))}
          </SelectField>
          <WeightInput
            name="grams"
            label="Weight received *"
            defaultGrams={extractedGrams}
            defaultUnit={(fields.weightUnit as WeightUnit) ?? "g"}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary">
              Add stock
            </Button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

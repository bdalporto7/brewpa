"use client";

import { useActionState } from "react";
import { Sparkles, CheckCircle2, Search } from "lucide-react";
import { extractLotFromUrl, type SmartAddResult } from "@/lib/inventory-actions";
import { createBean } from "@/lib/actions";
import { toGrams, type WeightUnit } from "@/lib/units";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import WeightInput from "@/components/inventory/WeightInput";

/**
 * Smart Add: paste a supplier's product page URL → Claude pulls the lot
 * details → confirm screen → createBean. The description + supplier fields
 * are for the roaster's own reference (and pre-fill when the page doesn't
 * state something); the URL is what actually gets read. No automatic
 * search-engine lookup — there's no search API configured, so "find the
 * page" is pasting the link, usually straight from the order confirmation.
 */
export default function SmartAddFlow() {
  const [result, extractAction, isExtracting] = useActionState<SmartAddResult, FormData>(
    async (_prev, formData) => extractLotFromUrl(formData),
    { ok: false }
  );

  const fields = result.ok ? result.fields : undefined;

  if (!fields) {
    return (
      <form action={extractAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="What coffee is it?" name="description" placeholder="e.g. that washed Ethiopian from Sweet Maria's" />
        <TextField label="Supplier" name="supplierHint" placeholder="e.g. Sweet Maria's" />
        <div className="sm:col-span-2">
          <TextField
            label="Supplier product page URL *"
            name="url"
            type="url"
            required
            placeholder="https://…"
          />
          <p className="mt-1 text-xs text-muted">
            Paste the product page — the details below get pulled from it automatically.
          </p>
        </div>
        {result.error && <p className="text-sm text-danger sm:col-span-2">{result.error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={isExtracting}>
            <span className="inline-flex items-center gap-2">
              {isExtracting ? <Search className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
              {isExtracting ? "Reading page…" : "Look it up"}
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
          <p className="font-semibold">Page read{fields.supplier ? ` — ${fields.supplier}` : ""}</p>
          <p className="mt-0.5 text-muted">Review and correct anything below — nothing has been saved yet.</p>
        </div>
      </div>

      <ActionForm action={createBean} className="grid grid-cols-1 gap-3 sm:grid-cols-2" successMessage="Lot added">
        <TextField label="Name *" name="name" required defaultValue={fields.name ?? ""} />
        <TextField label="Origin *" name="origin" required defaultValue={fields.origin ?? ""} />
        <TextField label="Process *" name="process" required defaultValue={fields.process ?? ""} />
        <TextField label="Producer" name="producer" defaultValue={fields.producer ?? ""} />
        <TextField label="Variety" name="variety" defaultValue={fields.variety ?? ""} />
        <TextField label="Supplier" name="supplier" defaultValue={fields.supplier ?? ""} />
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
          <TextareaField
            label="Notes"
            name="notes"
            rows={2}
            defaultValue={[
              fields.tastingNotes ? `Tasting notes: ${fields.tastingNotes}` : null,
              fields.altitude ? `Altitude: ${fields.altitude}` : null,
              fields.harvestYear ? `Harvest: ${fields.harvestYear}` : null,
            ]
              .filter(Boolean)
              .join("\n")}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary">
            Create lot
          </Button>
        </div>
      </ActionForm>
    </div>
  );
}

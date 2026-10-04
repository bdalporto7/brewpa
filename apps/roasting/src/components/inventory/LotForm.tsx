import type { ReactNode } from "react";
import type { Bean } from "@prisma/client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, FileField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import WeightInput from "@/components/inventory/WeightInput";

function isoDate(d: Date): string {
  // Local date, not UTC — matches what the date input shows.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Create/edit form for a green coffee lot.
 *
 * - `initial` pre-fills the form: a full Bean for editing, or partial
 *   extracted values for the intake review step (scan → review → save).
 * - In edit mode the weight field edits "total purchased" (validated
 *   server-side to never drop below remaining); day-to-day stock moves
 *   happen on the lot page instead.
 */
export default function LotForm({
  initial,
  action,
  submitLabel,
  successMessage,
  extraFields,
}: {
  initial?: Partial<Bean>;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  successMessage?: string;
  /** Extra hidden inputs rendered inside the form (e.g. a receipt URL). */
  extraFields?: ReactNode;
}) {
  const purchaseDateDefault =
    initial?.purchaseDate instanceof Date ? isoDate(initial.purchaseDate) : isoDate(new Date());

  return (
    <Form action={action} successMessage={successMessage ?? "Saved"} className="flex flex-col gap-4">
      {extraFields}
      <Card interactive={false} className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Name" name="name" required defaultValue={initial?.name ?? ""} placeholder="Ethiopia Guji" />
          <TextField label="Origin" name="origin" required defaultValue={initial?.origin ?? ""} placeholder="Ethiopia, Guji" />
          <TextField label="Process" name="process" required defaultValue={initial?.process ?? ""} placeholder="Washed" />
          <TextField label="Producer" name="producer" defaultValue={initial?.producer ?? ""} placeholder="Farm or co-op" />
          <TextField label="Variety" name="variety" defaultValue={initial?.variety ?? ""} placeholder="Heirloom" />
          <TextField label="Supplier" name="supplier" defaultValue={initial?.supplier ?? ""} placeholder="Where you bought it" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <WeightInput label={initial?.id ? "Total purchased" : "Weight purchased"} name="weight" required defaultGrams={initial?.weightGrams} />
          <TextField
            label="Price paid (total)"
            name="purchasePrice"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            defaultValue={initial?.purchasePrice ?? ""}
            placeholder="0.00"
          />
          <TextField label="Purchase date" name="purchaseDate" type="date" defaultValue={purchaseDateDefault} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Supplier URL" name="supplierUrl" type="url" defaultValue={initial?.supplierUrl ?? ""} placeholder="https://…" />
          {!initial?.id && <FileField label="Photo" name="photo" accept="image/*" />}
        </div>
        <TextareaField label="Notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </Card>

      <Card interactive={false} className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold">Reorder settings</h3>
          <p className="mt-0.5 text-xs text-muted">Optional — used for the “needs attention” alerts. Leave blank for sensible defaults.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            label="Reorder level (g)"
            name="reorderLevelGrams"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            defaultValue={initial?.reorderLevelGrams ?? ""}
            placeholder="e.g. 500"
          />
          <TextField
            label="Lead time (days)"
            name="leadTimeDays"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={initial?.leadTimeDays ?? ""}
            placeholder="14"
          />
          <TextField
            label="Aging alert (days)"
            name="agingThresholdDays"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={initial?.agingThresholdDays ?? ""}
            placeholder="180"
          />
        </div>
      </Card>

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </Form>
  );
}

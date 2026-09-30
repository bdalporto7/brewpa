import type { Bean } from "@prisma/client";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import WeightInput from "@/components/inventory/WeightInput";

/**
 * The lot form, shared by create (lots page disclosure) and edit (lot
 * detail page). Posts to the existing createBean/updateBean actions — all
 * weight fields go through WeightInput so the roaster can work in
 * g/kg/lb/oz while the database keeps seeing grams.
 */
export default function LotForm({
  bean,
  action,
  submitLabel,
}: {
  bean?: Bean;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const purchaseDateDefault = bean?.purchaseDate
    ? bean.purchaseDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField label="Name *" name="name" required defaultValue={bean?.name ?? ""} placeholder="e.g. Ethiopia Guji Natural" />
      <TextField label="Origin *" name="origin" required defaultValue={bean?.origin ?? ""} placeholder="e.g. Ethiopia" />
      <TextField label="Process *" name="process" required defaultValue={bean?.process ?? ""} placeholder="Washed, Natural, Honey…" />
      <TextField label="Producer" name="producer" defaultValue={bean?.producer ?? ""} placeholder="Farm or cooperative" />
      <TextField label="Variety" name="variety" defaultValue={bean?.variety ?? ""} placeholder="e.g. Bourbon" />
      <TextField label="Supplier" name="supplier" defaultValue={bean?.supplier ?? ""} placeholder="Where you bought it" />
      <TextField label="Supplier URL" name="supplierUrl" type="url" defaultValue={bean?.supplierUrl ?? ""} placeholder="https://…" />
      <TextField
        label="Purchase date"
        name="purchaseDate"
        type="date"
        defaultValue={purchaseDateDefault}
      />
      <TextField
        label="Purchase price (total)"
        name="purchasePrice"
        type="number"
        min="0"
        step="any"
        mono
        defaultValue={bean?.purchasePrice ?? ""}
        placeholder="0.00"
      />
      <WeightInput
        name="weightGrams"
        label={bean ? "Total purchased" : "Lot weight *"}
        defaultGrams={bean?.weightGrams}
        required
        hint={bean ? `Currently ${bean.remainingGrams}g remaining — total can't go below that.` : undefined}
      />
      <WeightInput
        name="reorderLevelGrams"
        label="Reorder level"
        defaultGrams={bean?.reorderLevelGrams}
        hint="Flag this lot when stock drops below here."
      />
      <TextField
        label="Lead time (days)"
        name="leadTimeDays"
        type="number"
        min="0"
        step="1"
        mono
        defaultValue={bean?.leadTimeDays ?? ""}
        placeholder="e.g. 14"
      />
      <TextField
        label="Aging threshold (days)"
        name="agingThresholdDays"
        type="number"
        min="0"
        step="1"
        mono
        defaultValue={bean?.agingThresholdDays ?? ""}
        placeholder="e.g. 180"
      />
      <div className="sm:col-span-2">
        <TextareaField label="Notes" name="notes" rows={2} defaultValue={bean?.notes ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </ActionForm>
  );
}

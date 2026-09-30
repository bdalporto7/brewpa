import { createLotCupping } from "@/lib/inventory-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean } from "@prisma/client";

const SCORE_FIELDS = [
  ["fragranceAroma", "Fragrance"],
  ["flavor", "Flavor"],
  ["aftertaste", "Aftertaste"],
  ["acidity", "Acidity"],
  ["body", "Body"],
  ["balance", "Balance"],
  ["uniformity", "Uniformity"],
  ["cleanCup", "Clean cup"],
  ["sweetness", "Sweetness"],
  ["overall", "Overall"],
  ["defects", "Defects"],
] as const;

/**
 * Log a cupping against a green lot (arrival sample, pre-roast check).
 * Either bound to one lot (hidden beanId, e.g. the lot detail page) or
 * with a lot picker (the cupping index page).
 */
export default function LotCuppingForm({
  beanId,
  beans,
}: {
  beanId?: string;
  beans?: Pick<Bean, "id" | "name">[];
}) {
  return (
    <ActionForm action={createLotCupping} className="grid grid-cols-3 gap-3 sm:grid-cols-4" successMessage="Cupping saved">
      {beanId ? (
        <input type="hidden" name="beanId" value={beanId} />
      ) : (
        <div className="col-span-3 sm:col-span-4">
          <SelectField label="Lot *" name="beanId" required defaultValue="">
            <option value="" disabled>
              Select a lot
            </option>
            {(beans ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <div className="col-span-3 sm:col-span-4">
        <TextField label="Cupped on" name="cuppedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      {SCORE_FIELDS.map(([key, label]) => (
        <TextField key={key} label={label} name={key} type="number" min="0" max="10" step="0.25" mono />
      ))}
      <div className="col-span-3 sm:col-span-4">
        <TextareaField label="Notes" name="notes" rows={2} />
      </div>
      <div className="col-span-3 sm:col-span-4">
        <Button type="submit" variant="primary">
          Save cupping
        </Button>
      </div>
    </ActionForm>
  );
}

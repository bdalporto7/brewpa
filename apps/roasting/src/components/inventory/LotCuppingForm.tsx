import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import { createLotCupping } from "@/lib/inventory-connector/actions";
import { SCORE_LABELS, ALL_SCORE_FIELDS } from "@/lib/inventory-connector/queries";

type LotOption = { id: string; name: string };

/**
 * Adds a cupping note directly to a green lot (arrival sample, pre-roast
 * check). Every score is optional — notes + overall alone is a valid
 * entry; the total only appears when all ten categories are scored.
 */
export default function LotCuppingForm({
  lots,
  defaultLotId,
}: {
  lots: LotOption[];
  defaultLotId?: string;
}) {
  return (
    <Card interactive={false} className="p-4 sm:p-5">
      <Form action={createLotCupping} successMessage="Cupping note saved" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField label="Lot *" name="beanId" required defaultValue={defaultLotId ?? ""}>
          <option value="" disabled>
            Choose a lot…
          </option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Cupped on"
          name="cuppedAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        {ALL_SCORE_FIELDS.map((field) => (
          <TextField
            key={field}
            label={SCORE_LABELS[field]}
            name={field}
            type="number"
            min="0"
            max="10"
            step="0.25"
            inputMode="decimal"
            placeholder="0–10"
          />
        ))}
        <TextField
          label="Defects"
          name="defects"
          type="number"
          min="0"
          step="0.25"
          inputMode="decimal"
          placeholder="0"
        />
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={3} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Save note</Button>
        </div>
      </Form>
    </Card>
  );
}

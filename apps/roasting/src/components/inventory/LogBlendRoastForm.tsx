import { logBlendRoast } from "@/lib/inventory-actions";
import { ROAST_LEVELS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import WeightInput from "@/components/inventory/WeightInput";
import type { RoasterDefinition } from "@prisma/client";

/**
 * "Log a blend roast" — total green for the batch; the action splits it
 * across the recipe's components by ratio and deducts each lot. Lives in
 * a disclosure on each blend card.
 */
export default function LogBlendRoastForm({
  blendRecipeId,
  roasterDefinitions,
}: {
  blendRecipeId: string;
  roasterDefinitions: Pick<RoasterDefinition, "id" | "name" | "isDefault">[];
}) {
  const defaultRoasterId =
    roasterDefinitions.find((r) => r.isDefault)?.id ?? roasterDefinitions[0]?.id ?? "";

  return (
    <ActionForm action={logBlendRoast} className="grid grid-cols-1 gap-3 sm:grid-cols-2" successMessage="Blend roast logged">
      <input type="hidden" name="blendRecipeId" value={blendRecipeId} />
      <WeightInput
        name="totalGreenGrams"
        label="Total green weight *"
        required
        hint="Split across lots by the recipe's ratios."
      />
      <WeightInput name="roastedWeightGrams" label="Roasted yield" hint="Optional — split proportionally for cost math." />
      <SelectField label="Roast level *" name="roastLevel" required defaultValue="">
        <option value="" disabled>
          Select level
        </option>
        {ROAST_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </SelectField>
      {roasterDefinitions.length > 1 ? (
        <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={defaultRoasterId}>
          {roasterDefinitions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
      )}
      <TextField label="Rating (1–5)" name="rating" type="number" min="1" max="5" step="1" mono />
      <div className="sm:col-span-2">
        <TextareaField label="Notes" name="notes" rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary">
          Log blend roast
        </Button>
      </div>
    </ActionForm>
  );
}

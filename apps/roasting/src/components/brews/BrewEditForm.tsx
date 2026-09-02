import { updateBrew } from "@/lib/brew-actions";
import { formatMMSS } from "@/lib/format";
import { BREW_METHODS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Brew, Recipe } from "@prisma/client";

/** Just the form now — BrewHeader owns the isEditing toggle and swaps its
 * whole header block for this, same pattern as BeanEditForm/FriendEditForm. */
export default function BrewEditForm({
  brew,
  recipes,
  onDone,
}: {
  brew: Brew;
  recipes: Recipe[];
  onDone: () => void;
}) {
  return (
    <ActionForm action={updateBrew.bind(null, brew.id)} onSuccess={onDone} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {!brew.roastSessionId && (
        <div className="col-span-2 sm:col-span-4">
          <TextField label="Bean" name="beanName" required defaultValue={brew.beanName ?? ""} />
        </div>
      )}
      <SelectField label="Recipe (optional)" name="recipeId" defaultValue={brew.recipeId ?? ""}>
        <option value="">No recipe — ad hoc</option>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>
      <div>
        <TextField
          label="Method"
          name="method"
          list="brew-methods-edit"
          required
          defaultValue={brew.method}
          autoComplete="off"
        />
        <datalist id="brew-methods-edit">
          {BREW_METHODS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <TextField
        label="Dose (g)"
        name="doseGrams"
        type="number"
        step="0.1"
        min="0.1"
        required
        defaultValue={brew.doseGrams}
        mono
      />
      <TextField
        label="Water (g)"
        name="waterGrams"
        type="number"
        step="0.1"
        min="0.1"
        required
        defaultValue={brew.waterGrams}
        mono
      />
      <TextField label="Grind" name="grindSetting" defaultValue={brew.grindSetting ?? ""} />
      <TextField
        label="Water temp (°F)"
        name="waterTempF"
        type="number"
        step="1"
        min="0"
        defaultValue={brew.waterTempF ?? ""}
        mono
      />
      <TextField
        label="Brew time (m:ss)"
        name="brewTimeMMSS"
        defaultValue={brew.brewTimeSeconds != null ? formatMMSS(brew.brewTimeSeconds) : ""}
        mono
      />
      <TextField
        label="Rating (1-10)"
        name="rating"
        type="number"
        step="1"
        min="1"
        max="10"
        defaultValue={brew.rating ?? ""}
        mono
      />
      <div className="col-span-2 sm:col-span-4">
        <TextareaField label="Tasting notes" name="notes" rows={2} defaultValue={brew.notes ?? ""} />
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

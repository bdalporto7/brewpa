import { createRecipe, updateRecipe } from "@/lib/brew-actions";
import { BREW_METHODS } from "@/lib/constants";
import { formatMMSS } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import type { Recipe } from "@prisma/client";

export default function RecipeForm({
  recipe,
  onSuccess,
  onCancel,
}: {
  recipe?: Recipe;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const action = recipe ? updateRecipe.bind(null, recipe.id) : createRecipe;

  return (
    <ActionForm action={action} onSuccess={onSuccess} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2">
        <TextField label="Name" name="name" required defaultValue={recipe?.name} placeholder="V60 4:6" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="recipe-method">
          Method
        </label>
        <input
          id="recipe-method"
          name="method"
          list="brew-methods-recipe"
          required
          defaultValue={recipe?.method ?? ""}
          placeholder="V60"
          autoComplete="off"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <datalist id="brew-methods-recipe">
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
        defaultValue={recipe?.doseGrams}
        mono
      />
      <TextField
        label="Water (g)"
        name="waterGrams"
        type="number"
        step="0.1"
        min="0.1"
        required
        defaultValue={recipe?.waterGrams}
        mono
      />
      <TextField
        label="Grind"
        name="grindSetting"
        defaultValue={recipe?.grindSetting ?? ""}
        placeholder="Comandante 25 clicks"
      />
      <TextField
        label="Water temp (°F)"
        name="waterTempF"
        type="number"
        step="1"
        min="0"
        defaultValue={recipe?.waterTempF ?? ""}
        mono
      />
      <TextField
        label="Brew time (m:ss)"
        name="brewTimeMMSS"
        defaultValue={recipe?.brewTimeSeconds != null ? formatMMSS(recipe.brewTimeSeconds) : ""}
        placeholder="3:00"
        mono
      />
      <div className="col-span-2 sm:col-span-4">
        <TextareaField
          label="Steps / notes"
          name="notes"
          rows={3}
          defaultValue={recipe?.notes ?? ""}
          placeholder="Bloom 40g @ 0:00, pour to 150g @ 0:45, pour to 300g @ 1:30…"
        />
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <Button type="submit" size="sm">
          {recipe ? "Save" : "Create recipe"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </ActionForm>
  );
}

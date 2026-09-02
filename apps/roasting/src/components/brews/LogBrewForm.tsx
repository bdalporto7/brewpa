"use client";

import { useState } from "react";
import { format } from "date-fns";
import { logBrew } from "@/lib/brew-actions";
import { formatMMSS } from "@/lib/format";
import { BREW_METHODS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean, Recipe, RoastSession } from "@prisma/client";

/**
 * Picking a recipe swaps in its dose/water/grind/etc. as defaults, but
 * the fields below are plain uncontrolled inputs — changing a
 * `defaultValue` prop after a field has already mounted does nothing.
 * `key={recipeId}` on the form forces a full remount instead, which is
 * the only way to get them to pick up the newly-selected recipe's values.
 */
export default function LogBrewForm({
  sessions,
  recipes,
  defaultRoastSessionId,
}: {
  sessions: (RoastSession & { bean: Bean })[];
  recipes: Recipe[];
  defaultRoastSessionId?: string;
}) {
  const [recipeId, setRecipeId] = useState("");
  const [useOwnBean, setUseOwnBean] = useState(sessions.length === 0);
  const recipe = recipes.find((r) => r.id === recipeId);

  return (
    <ActionForm key={recipeId} action={logBrew} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex items-center gap-1 rounded-full border border-border bg-background p-0.5 text-xs font-medium sm:col-span-4">
        <button
          type="button"
          onClick={() => setUseOwnBean(false)}
          disabled={sessions.length === 0}
          className={`flex-1 rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            !useOwnBean ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          From my roasted coffee
        </button>
        <button
          type="button"
          onClick={() => setUseOwnBean(true)}
          className={`flex-1 rounded-full px-3 py-1.5 transition ${
            useOwnBean ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          Other coffee
        </button>
      </div>

      {useOwnBean ? (
        <div className="col-span-2 sm:col-span-2">
          <TextField label="Bean" name="beanName" required placeholder="e.g. Blue Bottle Giant Steps" />
        </div>
      ) : (
        <div className="col-span-2 sm:col-span-2">
          <SelectField label="Roasted coffee" name="roastSessionId" required defaultValue={defaultRoastSessionId ?? ""}>
            <option value="" disabled>
              Select roast
            </option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.bean.name} — {format(session.startedAt ?? session.createdAt, "MMM d, yyyy")} (
                {Math.round((session.roastedRemainingGrams ?? 0) * 10) / 10}g left)
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <div className="col-span-2">
        <SelectField label="Recipe (optional)" name="recipeId" defaultValue="" onChange={(e) => setRecipeId(e.target.value)}>
          <option value="">No recipe — ad hoc</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <TextField
          label="Method"
          name="method"
          list="brew-methods"
          required
          defaultValue={recipe?.method ?? ""}
          placeholder="V60"
          autoComplete="off"
        />
        <datalist id="brew-methods">
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
      <TextField label="Rating (1-10)" name="rating" type="number" step="1" min="1" max="10" placeholder="8" mono />
      <div className="col-span-2 sm:col-span-4">
        <TextareaField
          label="Tasting notes"
          name="notes"
          rows={2}
          placeholder="Bright, floral, a little over-extracted…"
        />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" size="sm">
          Log brew
        </Button>
      </div>
    </ActionForm>
  );
}

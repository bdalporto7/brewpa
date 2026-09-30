"use client";

import { useState } from "react";
import { Pencil, Flame } from "lucide-react";
import { deleteBlendRecipe } from "@/lib/inventory-actions";
import DeleteButton from "@/components/DeleteButton";
import BlendRecipeForm from "@/components/inventory/BlendRecipeForm";
import LogBlendRoastForm from "@/components/inventory/LogBlendRoastForm";
import type { Bean, BlendRecipe, BlendComponent, RoasterDefinition } from "@prisma/client";

type RecipeWithComponents = BlendRecipe & {
  components: (BlendComponent & { bean: Pick<Bean, "id" | "name"> })[];
};

/**
 * One blend recipe card: component ratios, roast count, edit + log-roast
 * disclosures, delete. Blend roasts deduct each component lot
 * proportionally — the card shows the ratios so the math is never a
 * surprise.
 */
export default function BlendCard({
  recipe,
  beans,
  roasterDefinitions,
  roastCount,
}: {
  recipe: RecipeWithComponents;
  beans: Pick<Bean, "id" | "name" | "remainingGrams">[];
  roasterDefinitions: Pick<RoasterDefinition, "id" | "name" | "isDefault">[];
  roastCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{recipe.name}</h3>
          {recipe.notes && <p className="mt-0.5 text-sm text-muted">{recipe.notes}</p>}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {recipe.components.map((c) => (
              <li
                key={c.id}
                className="rounded-full bg-background px-2.5 py-1 font-mono text-xs"
              >
                {c.bean.name} · {c.ratioPercent}%
              </li>
            ))}
          </ul>
          {roastCount > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              {roastCount} blend roast{roastCount === 1 ? "" : "s"} logged
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> {editing ? "Close" : "Edit"}
          </button>
          <DeleteButton
            action={deleteBlendRecipe.bind(null, recipe.id)}
            confirmText={`Delete "${recipe.name}"? Roasts already logged from it are kept.`}
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setLogging((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground"
        >
          <Flame className="h-4 w-4" /> {logging ? "Close" : "Log a blend roast"}
        </button>
      </div>

      {logging && (
        <div className="mt-3 border-t border-border pt-3">
          <LogBlendRoastForm blendRecipeId={recipe.id} roasterDefinitions={roasterDefinitions} />
        </div>
      )}
      {editing && (
        <div className="mt-3 border-t border-border pt-3">
          <BlendRecipeForm recipe={recipe} beans={beans} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

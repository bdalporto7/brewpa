"use client";

import { useState } from "react";
import { deleteRecipe } from "@/lib/brew-actions";
import DeleteButton from "@/components/DeleteButton";
import Button from "@/components/ui/Button";
import RecipeForm from "@/components/brews/RecipeForm";
import type { Recipe } from "@prisma/client";

export default function RecipeDetailsPanel({ recipe }: { recipe: Recipe }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <p className="mb-3 text-sm font-medium">Edit recipe</p>
        <RecipeForm recipe={recipe} onSuccess={() => setIsEditing(false)} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{recipe.name}</h1>
        <p className="text-sm text-muted">
          {recipe.method}
          {recipe.grindSetting && ` · ${recipe.grindSetting}`}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <DeleteButton
          action={deleteRecipe.bind(null, recipe.id)}
          confirmText="Delete this recipe? Brews already logged with it keep their own numbers, they just lose the link."
          label="Delete"
        />
      </div>
    </div>
  );
}

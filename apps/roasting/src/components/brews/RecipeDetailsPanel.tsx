"use client";

import { useState } from "react";
import { deleteRecipe } from "@/lib/brew-actions";
import DeleteButton from "@/components/DeleteButton";
import Button from "@/components/ui/Button";
import RecipeForm from "@/components/brews/RecipeForm";
import RecipeFavoriteToggle from "@/components/brews/RecipeFavoriteToggle";
import Card from "@/components/ui/Card";
import type { Recipe } from "@prisma/client";

/** Same isEditing-toggle shape as RoastProfileDetailsPanel — see that
 * component's comment for why they aren't merged. */
export default function RecipeDetailsPanel({ recipe }: { recipe: Recipe }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <Card interactive={false} className="p-4">
        <p className="mb-3 text-sm font-medium">Edit recipe</p>
        <RecipeForm recipe={recipe} onSuccess={() => setIsEditing(false)} onCancel={() => setIsEditing(false)} />
      </Card>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tight">
          {recipe.name}
          <RecipeFavoriteToggle recipeId={recipe.id} isFavorite={recipe.isFavorite} className="h-7 w-7" />
        </h1>
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

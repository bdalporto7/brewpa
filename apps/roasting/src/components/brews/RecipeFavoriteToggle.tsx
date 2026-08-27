"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { toggleRecipeFavorite } from "@/lib/brew-actions";

/** Stops the click from bubbling to a wrapping <Link> (RecipeCard is a whole-card link to the recipe's own page). */
export default function RecipeFavoriteToggle({
  recipeId,
  isFavorite,
  className = "h-4 w-4",
}: {
  recipeId: string;
  isFavorite: boolean;
  /** Sizes the icon itself, e.g. "h-6 w-6" next to a larger heading. */
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => toggleRecipeFavorite(recipeId, !isFavorite));
      }}
      aria-label={isFavorite ? "Remove from favorites" : "Mark as favorite"}
      className="flex-none text-muted transition hover:text-accent disabled:opacity-50"
    >
      <Star className={`${className} ${isFavorite ? "fill-accent text-accent" : ""}`} />
    </button>
  );
}

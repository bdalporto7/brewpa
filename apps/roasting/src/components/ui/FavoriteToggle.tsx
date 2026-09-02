"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";

/** Stops the click from bubbling to a wrapping <Link> — both current
 * callers (RoastProfileCard, RecipeCard) are whole-card links to the
 * entity's own page. */
export default function FavoriteToggle({
  isFavorite,
  onToggle,
  className = "h-4 w-4",
}: {
  isFavorite: boolean;
  onToggle: () => Promise<void>;
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
        startTransition(onToggle);
      }}
      aria-label={isFavorite ? "Remove from favorites" : "Mark as favorite"}
      className="flex-none text-muted transition hover:text-accent disabled:opacity-50"
    >
      <Star className={`${className} ${isFavorite ? "fill-accent text-accent" : ""}`} />
    </button>
  );
}

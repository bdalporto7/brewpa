import { toggleRecipeFavorite } from "@/lib/brew-actions";
import FavoriteToggle from "@/components/ui/FavoriteToggle";

export default function RecipeFavoriteToggle({
  recipeId,
  isFavorite,
  className,
}: {
  recipeId: string;
  isFavorite: boolean;
  className?: string;
}) {
  return (
    <FavoriteToggle
      isFavorite={isFavorite}
      onToggle={() => toggleRecipeFavorite(recipeId, !isFavorite)}
      className={className}
    />
  );
}

import Link from "next/link";
import Card from "@/components/ui/Card";
import { BrewedCupIcon } from "@/components/ui/CoffeeIcons";
import SteamWisp from "@/components/ui/SteamWisp";
import RecipeFavoriteToggle from "@/components/brews/RecipeFavoriteToggle";
import type { Recipe } from "@prisma/client";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const ratio = Math.round((recipe.waterGrams / recipe.doseGrams) * 10) / 10;

  return (
    <Link href={`/recipes/${recipe.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-medium">
            <span className="relative inline-flex h-4 w-4 flex-none text-accent">
              <BrewedCupIcon className="h-4 w-4" />
              <SteamWisp className="pointer-events-none absolute -top-2.5 left-0.5 h-2.5 w-3.5 text-foreground" />
            </span>
            {recipe.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{recipe.method}</span>
            <RecipeFavoriteToggle recipeId={recipe.id} isFavorite={recipe.isFavorite} />
          </div>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {recipe.doseGrams}g : {recipe.waterGrams}g · 1:{ratio}
          {recipe.waterTempF != null && ` · ${recipe.waterTempF}°F`}
        </p>
      </Card>
    </Link>
  );
}

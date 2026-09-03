"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { BrewedCupIcon } from "@/components/ui/CoffeeIcons";
import SteamWisp from "@/components/ui/SteamWisp";
import RecipeFavoriteToggle from "@/components/brews/RecipeFavoriteToggle";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Recipe } from "@prisma/client";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const ratio = Math.round((recipe.waterGrams / recipe.doseGrams) * 10) / 10;

  return (
    // Not wrapped in <Link> — TapCircleLink below already renders a real
    // anchor on the name, and nesting a second one around the whole card
    // is invalid HTML. router.push keeps "click anywhere on the card"
    // navigation, same reasoning as RoastSessionCard/BeanCard.
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/recipes/${recipe.id}`)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium">
          <span className="relative inline-flex h-4 w-4 flex-none text-accent">
            <BrewedCupIcon className="h-4 w-4" />
            <SteamWisp className="pointer-events-none absolute -top-2.5 left-0.5 h-2.5 w-3.5 text-foreground" />
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <TapCircleLink href={`/recipes/${recipe.id}`}>{recipe.name}</TapCircleLink>
          </span>
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
  );
}

import Link from "next/link";
import Card from "@/components/ui/Card";
import type { Recipe } from "@prisma/client";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const ratio = Math.round((recipe.waterGrams / recipe.doseGrams) * 10) / 10;

  return (
    <Link href={`/recipes/${recipe.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">{recipe.name}</h3>
          <span className="text-xs text-muted">{recipe.method}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {recipe.doseGrams}g : {recipe.waterGrams}g · 1:{ratio}
          {recipe.waterTempF != null && ` · ${recipe.waterTempF}°F`}
        </p>
      </Card>
    </Link>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMMSS } from "@/lib/format";
import { getCurrentAllowedUser } from "@/lib/admin";
import RecipeDetailsPanel from "@/components/brews/RecipeDetailsPanel";
import BrewCard from "@/components/brews/BrewCard";
import Stat from "@/components/ui/Stat";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [recipe, user] = await Promise.all([prisma.recipe.findUnique({ where: { id } }), getCurrentAllowedUser()]);

  if (!recipe || !user) notFound();

  const brews = await prisma.brew.findMany({
    where: { recipeId: id, userId: user.id },
    orderBy: { brewedAt: "desc" },
    include: { roastSession: { include: { bean: true } } },
  });

  const ratio = Math.round((recipe.waterGrams / recipe.doseGrams) * 10) / 10;

  return (
    <div className="flex flex-col gap-6">
      <RecipeDetailsPanel recipe={recipe} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Dose" value={`${recipe.doseGrams}g`} />
        <Stat label="Water" value={`${recipe.waterGrams}g`} />
        <Stat label="Ratio" value={`1:${ratio}`} />
        <Stat label="Time" value={recipe.brewTimeSeconds != null ? formatMMSS(recipe.brewTimeSeconds) : "—"} />
      </div>

      {recipe.notes && <p className="text-sm whitespace-pre-line text-foreground/80">{recipe.notes}</p>}

      <div>
        <h2 className="mb-3 font-medium">Your brews with this recipe</h2>
        {brews.length === 0 ? (
          <p className="text-sm text-muted">No brews logged with this recipe yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {brews.map((brew) => (
              <BrewCard key={brew.id} brew={brew} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

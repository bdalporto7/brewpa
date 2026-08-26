import { prisma } from "@/lib/prisma";
import RecipeForm from "@/components/brews/RecipeForm";
import RecipeCard from "@/components/brews/RecipeCard";

export default async function RecipesPage() {
  const recipes = await prisma.recipe.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Recipes</h1>
        <p className="text-sm text-muted">Dial in a method once, reuse it for every brew.</p>
      </div>

      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <p className="mb-3 text-sm font-medium">New recipe</p>
        <RecipeForm />
      </div>

      <div>
        <h2 className="mb-3 font-medium">All recipes</h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-muted">No recipes yet — add one above.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

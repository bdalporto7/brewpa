import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RecipeForm from "@/components/brews/RecipeForm";
import RecipeCard from "@/components/brews/RecipeCard";
import SectionHeading from "@/components/ui/SectionHeading";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";
import PageStamp from "@/components/ui/PageStamp";

export default async function RecipesPage() {
  const recipes = await prisma.recipe.findMany({ orderBy: [{ isFavorite: "desc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Recipes</h1>
        <p className="text-sm text-muted">Dial in a method once, reuse it for every brew.</p>
      </div>

      {/* Closed by default — built once, reused many times via the recipe
          picker, not something checked every visit (same reasoning as
          BeanForm/LogPastRoastForm's native <details>). */}
      <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
        <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
          <Plus className="h-4 w-4" /> New recipe
        </summary>
        <div className="p-4">
          <RecipeForm />
        </div>
      </details>

      <div>
        <div className="mb-3">
          <SectionHeading>All recipes</SectionHeading>
        </div>
        {recipes.length === 0 ? (
          <DecoratedEmptyState>No recipes yet — add one above.</DecoratedEmptyState>
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

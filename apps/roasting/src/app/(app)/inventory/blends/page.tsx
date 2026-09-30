import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import BlendCard from "@/components/inventory/BlendCard";
import BlendRecipeForm from "@/components/inventory/BlendRecipeForm";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Blend recipes: component lots + ratios, and the "log a blend roast"
 * entry that deducts each lot proportionally. Recipes are commitments
 * (like plans) — only the roast sessions created from them move stock.
 */
export default async function BlendsPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [recipes, beans, roasterDefinitions, blendSessionCounts] = await Promise.all([
    prisma.blendRecipe.findMany({
      where: { teamId: user.teamId },
      include: { components: { include: { bean: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true, remainingGrams: true },
      orderBy: { name: "asc" },
    }),
    prisma.roasterDefinition.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true, isDefault: true },
      orderBy: { name: "asc" },
    }),
    prisma.roastSession.groupBy({
      by: ["blendRecipeId"],
      where: { teamId: user.teamId, blendRecipeId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByRecipe = new Map(blendSessionCounts.map((r) => [r.blendRecipeId, r._count._all]));

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-muted">
        Named blends with component ratios. Logging a blend roast creates one roast per lot, each
        deducting its share — cost and weight loss keep working per lot.
      </p>

      {recipes.length === 0 ? (
        <DecoratedEmptyState>
          No blends yet — create one below, e.g. your house espresso.
        </DecoratedEmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {recipes.map((recipe) => (
            <BlendCard
              key={recipe.id}
              recipe={recipe}
              beans={beans}
              roasterDefinitions={roasterDefinitions}
              roastCount={countByRecipe.get(recipe.id) ?? 0}
            />
          ))}
        </ul>
      )}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4 text-accent" />
          Create a blend
        </summary>
        <div className="border-t border-border p-4">
          <BlendRecipeForm beans={beans} />
        </div>
      </details>
    </div>
  );
}

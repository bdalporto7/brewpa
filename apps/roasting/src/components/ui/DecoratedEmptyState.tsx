import CoffeeRingStain from "@/components/ui/CoffeeRingStain";

/**
 * The "nothing here yet" treatment for a top-level list page's first-time-
 * empty view (Roasts, Recipes, Friends, Profiles, Brews) — a dashed box
 * plus a coffee-ring-stain flourish, more than the plain muted sentence
 * used for empty states nested inside a detail page's sub-section (a
 * bean's drops, a profile's roasts). The top-level case is the one a user
 * is actually likely to sit and look at; a nested sub-list's empty state
 * is more often just a passing glance.
 */
export default function DecoratedEmptyState({ children }: { children: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
      <CoffeeRingStain className="pointer-events-none absolute -top-6 -right-6 h-32 w-32" />
      <p className="relative text-sm text-muted">{children}</p>
    </div>
  );
}

import type { Bean, RoastSession } from "@prisma/client";

/**
 * Pure stock math for the online shop — no Prisma calls, so apps/shop can
 * carry an identical copy (the repo has no shared-package tooling, see root
 * AGENTS.md). Keep the two copies in sync.
 *
 * Fulfillment is mixed: a bag is sold from roasted stock on hand when there
 * is enough, otherwise it's roasted to order from green stock. So a bean's
 * sellable amount is its roasted grams plus what its green stock would yield
 * once roasted.
 */

/** The standard bag sizes a new listing starts with; prices are editable per coffee. */
export const DEFAULT_VARIANTS: ReadonlyArray<{ label: string; grams: number; priceCents: number }> = [
  { label: "4 oz", grams: 113, priceCents: 1500 },
  { label: "8 oz", grams: 227, priceCents: 2200 },
  { label: "12 oz", grams: 340, priceCents: 2700 },
  { label: "2 lb", grams: 907, priceCents: 3200 },
  { label: "5 lb", grams: 2268, priceCents: 6000 },
];

/** Used only when a bean has no completed roast with a logged roasted weight to learn from. */
export const FALLBACK_YIELD = 0.85;

type YieldSession = Pick<RoastSession, "endedAt" | "greenWeightGrams" | "roastedWeightGrams">;
type StockSession = YieldSession & Pick<RoastSession, "roastedRemainingGrams">;

/**
 * Average roasted/green weight ratio across this bean's own completed roasts —
 * a real, checkable number from the roaster's history rather than a generic
 * assumption. Ratios outside 0.5–1 are ignored as data-entry mistakes.
 */
export function roastYield(sessions: YieldSession[]): number {
  const ratios = sessions
    .filter((s) => s.endedAt != null && s.roastedWeightGrams != null && s.greenWeightGrams > 0)
    .map((s) => (s.roastedWeightGrams as number) / s.greenWeightGrams)
    .filter((r) => r > 0.5 && r <= 1);
  if (ratios.length === 0) return FALLBACK_YIELD;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export interface BeanStock {
  /** Roasted grams on hand across completed roasts. */
  roastedGrams: number;
  /** Roasted grams the remaining green stock would produce. */
  roastableGrams: number;
  yield: number;
}

/**
 * `backorderedGrams` is roasted coffee that paid orders are already waiting on
 * and that no stock covered when they were paid. Green stock added later is
 * spoken for by those orders first, so it's subtracted from what new customers
 * can buy.
 */
export function beanStock(
  bean: Pick<Bean, "remainingGrams">,
  sessions: StockSession[],
  backorderedGrams = 0
): BeanStock {
  const roastedGrams = sessions
    .filter((s) => s.endedAt != null)
    .reduce((sum, s) => sum + Math.max(0, s.roastedRemainingGrams ?? 0), 0);
  const y = roastYield(sessions);
  return { roastedGrams, roastableGrams: Math.max(0, Math.max(0, bean.remainingGrams) * y - backorderedGrams), yield: y };
}

export type Availability = "ready" | "roast_to_order" | "backorder" | "sold_out";

/**
 * Whether one bag of `grams` can be sold, and how it would be fulfilled.
 * With `allowBackorder`, a bag we can't cover is still sold — the roaster buys
 * more green to fill it — instead of showing as sold out.
 */
export function variantAvailability(stock: BeanStock, grams: number, allowBackorder = false): Availability {
  if (stock.roastedGrams >= grams) return "ready";
  if (stock.roastedGrams + stock.roastableGrams >= grams) return "roast_to_order";
  return allowBackorder ? "backorder" : "sold_out";
}

/** URL slug for a listing: "Kercha Haruse — Ethiopia" → "kercha-haruse-ethiopia". */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "coffee"
  );
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

import type { Bean, RoastSession, Sale } from "@prisma/client";

/**
 * Real cost/margin math off data this app already stores — `Bean.purchasePrice`
 * and `Sale.price` — but never combines into a profit figure anywhere. Every
 * function here returns `null` rather than assuming $0 when a price is
 * missing, since a missing purchase price silently treated as free would
 * show a fake 100% margin instead of just admitting the cost isn't known.
 */

export function greenCostPerGram(bean: Pick<Bean, "purchasePrice" | "weightGrams">): number | null {
  if (bean.purchasePrice == null || bean.weightGrams <= 0) return null;
  return bean.purchasePrice / bean.weightGrams;
}

export interface RoastMargin {
  /** Per gram of *roasted* output — weight loss means each roasted gram
   * carries more of the green cost than a naive per-gram split would. */
  costPerRoastedGram: number;
  /** The green coffee cost that went into this specific roast. */
  totalCost: number;
  /** Sum of this roast's Sale.price rows (a null price counts as $0, e.g. a
   * gifted bag, without breaking the aggregate). */
  revenue: number;
  gramsSold: number;
  costOfGoodsSold: number;
  profit: number;
  /** What's still tied up in unsold roasted stock from this batch, at cost. */
  unsoldValue: number;
}

export function roastMargin(
  session: Pick<RoastSession, "greenWeightGrams" | "roastedWeightGrams" | "roastedRemainingGrams">,
  bean: Pick<Bean, "purchasePrice" | "weightGrams">,
  sales: Pick<Sale, "price" | "weightGrams">[]
): RoastMargin | null {
  const costPerGreenGram = greenCostPerGram(bean);
  if (costPerGreenGram == null) return null;
  // No recorded yield yet (roast still in progress, or weight never logged)
  // — there's no roasted-gram basis to allocate cost across.
  if (session.roastedWeightGrams == null || session.roastedWeightGrams <= 0) return null;

  const totalCost = costPerGreenGram * session.greenWeightGrams;
  const costPerRoastedGram = totalCost / session.roastedWeightGrams;

  const revenue = sales.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const gramsSold = sales.reduce((sum, s) => sum + s.weightGrams, 0);
  const costOfGoodsSold = costPerRoastedGram * gramsSold;

  return {
    costPerRoastedGram,
    totalCost,
    revenue,
    gramsSold,
    costOfGoodsSold,
    profit: revenue - costOfGoodsSold,
    unsoldValue: costPerRoastedGram * (session.roastedRemainingGrams ?? 0),
  };
}

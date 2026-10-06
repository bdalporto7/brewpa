import { prisma } from "@/lib/prisma";

/**
 * Roasted grams, per bean, that paid online orders are waiting on with no
 * stock behind them yet. Green coffee added later belongs to those orders
 * first, so it's subtracted from what the shop offers new customers (see
 * `beanStock`'s third argument).
 */
export async function backorderedGramsByBean(beanIds: string[]): Promise<Map<string, number>> {
  if (beanIds.length === 0) return new Map();
  const rows = await prisma.shopOrderItem.groupBy({
    by: ["beanId"],
    where: { beanId: { in: beanIds }, gramsBackordered: { gt: 0 }, order: { status: { in: ["PAID", "NEEDS_ATTENTION"] } } },
    _sum: { gramsBackordered: true },
  });
  return new Map(rows.map((r) => [r.beanId, r._sum.gramsBackordered ?? 0]));
}

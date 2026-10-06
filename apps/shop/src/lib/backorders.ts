import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Roasted grams, per bean, that paid orders are still waiting on with nothing
 * in stock to cover them. Green coffee that arrives later belongs to these
 * orders first, so the shop must not offer it to anyone else.
 */
export async function backorderedGramsByBean(beanIds: string[]): Promise<Map<string, number>> {
  if (beanIds.length === 0) return new Map();
  const rows = await prisma.shopOrderItem.groupBy({
    by: ["beanId"],
    where: { beanId: { in: beanIds }, gramsBackordered: { gt: 0 }, order: { status: { in: ["PAID", "NEEDS_ATTENTION"] } } },
    _sum: { gramsBackordered: true },
  });
  return new Map(rows.flatMap((r) => (r.beanId ? [[r.beanId, r._sum.gramsBackordered ?? 0] as [string, number]] : [])));
}

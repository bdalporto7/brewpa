import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roastYield } from "@/lib/shop-stock";

/**
 * Marks a paid online order and takes its coffee out of stock, all in one
 * transaction: roasted grams first (oldest roast first, recorded as real
 * `Sale` rows so the roast ledgers and business page count online sales),
 * then whatever is left is roasted to order out of green stock. If stock ran
 * out between checkout and payment, the order is still marked paid (the money
 * is taken) but flagged NEEDS_ATTENTION — never failed.
 */
export async function markOrderPaid(squareOrderId: string, paidCents: number | null): Promise<string> {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.shopOrder.findUnique({
        where: { squareOrderId },
        include: { items: true },
      });
      if (!order) return "unknown-order";
      if (order.status !== "PENDING") return "already-processed";

      // Guard against two deliveries racing: only one gets to flip PENDING.
      const claimed = await tx.shopOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date(), ...(paidCents != null ? { totalCents: paidCents } : {}) },
      });
      if (claimed.count === 0) return "already-processed";

      const notes: string[] = [];
      for (const item of order.items) {
        const need = item.grams * item.quantity;
        const lineRevenue = (item.unitPriceCents * item.quantity) / 100;
        let remaining = need;
        let fromRoasted = 0;

        const sessions = await tx.roastSession.findMany({
          where: { beanId: item.beanId, endedAt: { not: null }, roastedRemainingGrams: { gt: 0 } },
          orderBy: { endedAt: "asc" },
          select: { id: true, roastedRemainingGrams: true },
        });
        for (const s of sessions) {
          if (remaining <= 0) break;
          const take = Math.min(s.roastedRemainingGrams ?? 0, remaining);
          if (take <= 0) continue;
          const upd = await tx.roastSession.updateMany({
            where: { id: s.id, roastedRemainingGrams: { gte: take } },
            data: { roastedRemainingGrams: { decrement: take } },
          });
          if (upd.count === 0) continue;
          await tx.sale.create({
            data: {
              roastSessionId: s.id,
              weightGrams: take,
              price: Math.round(lineRevenue * (take / need) * 100) / 100,
              notes: `Online order ${order.publicRef}`,
              shopOrderItemId: item.id,
            },
          });
          fromRoasted += take;
          remaining -= take;
        }

        let toRoast = 0;
        if (remaining > 0.01) {
          const bean = await tx.bean.findUnique({
            where: { id: item.beanId },
            select: { remainingGrams: true, roastSessions: { select: { endedAt: true, greenWeightGrams: true, roastedWeightGrams: true } } },
          });
          const yieldRatio = roastYield(bean?.roastSessions ?? []);
          const green = remaining / yieldRatio;
          const upd = await tx.bean.updateMany({
            where: { id: item.beanId, remainingGrams: { gte: green } },
            data: { remainingGrams: { decrement: green } },
          });
          toRoast = remaining;
          if (upd.count === 0) notes.push(`Not enough green stock for ${item.variantLabel}.`);
        }

        await tx.shopOrderItem.update({
          where: { id: item.id },
          data: { gramsFromRoasted: fromRoasted, gramsToRoast: toRoast },
        });
      }

      if (notes.length > 0) {
        await tx.shopOrder.update({
          where: { id: order.id },
          data: { status: "NEEDS_ATTENTION", attentionNote: notes.join(" ") } satisfies Prisma.ShopOrderUpdateInput,
        });
        return "needs-attention";
      }
      return "paid";
    },
    { timeout: 20000, maxWait: 10000 }
  );
}

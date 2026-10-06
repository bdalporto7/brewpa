import { prisma } from "@/lib/prisma";
import { roastYield } from "@/lib/shop-stock";

/**
 * Paying for a roast-to-order bag sets its green coffee aside right away (so
 * the shop can't oversell it). Once the roast actually exists, that placeholder
 * has to turn into the real thing, otherwise roasting it normally would take
 * the green a second time and the new roasted coffee would look unsold. So when
 * an order is marked Ready: give the set-aside green back, and take the same
 * amount out of the roasted stock (oldest roast first, as Sale rows on the
 * order). If the roasted weight isn't in stock yet, refuse and say what's missing.
 */
export async function convertRoastToOrderItems(orderId: string) {
  await prisma.$transaction(
    async (tx) => {
      const order = await tx.shopOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      for (const item of order.items.filter((i) => i.gramsToRoast > 0.01)) {
        const sessions = await tx.roastSession.findMany({
          where: { beanId: item.beanId, endedAt: { not: null } },
          orderBy: { endedAt: "asc" },
          select: { id: true, roastedRemainingGrams: true, endedAt: true, greenWeightGrams: true, roastedWeightGrams: true },
        });
        const available = sessions.reduce((n, x) => n + Math.max(0, x.roastedRemainingGrams ?? 0), 0);
        if (available + 0.01 < item.gramsToRoast) {
          throw new Error(
            `Not enough roasted coffee yet for ${item.variantLabel}: ${Math.round(item.gramsToRoast)} g needed, ${Math.round(available)} g in stock. Finish the roast and log its roasted weight first.`
          );
        }
        let remaining = item.gramsToRoast;
        for (const x of sessions) {
          if (remaining <= 0.01) break;
          const take = Math.min(Math.max(0, x.roastedRemainingGrams ?? 0), remaining);
          if (take <= 0) continue;
          await tx.roastSession.update({ where: { id: x.id }, data: { roastedRemainingGrams: { decrement: take } } });
          await tx.sale.create({
            data: {
              roastSessionId: x.id,
              weightGrams: take,
              price: Math.round(((item.unitPriceCents * item.quantity) / 100) * (take / (item.grams * item.quantity)) * 100) / 100,
              notes: `Online order ${order.publicRef}`,
              shopOrderItemId: item.id,
            },
          });
          remaining -= take;
        }
        const green = item.gramsToRoast / roastYield(sessions);
        await tx.bean.update({ where: { id: item.beanId }, data: { remainingGrams: { increment: green } } });
        await tx.shopOrderItem.update({
          where: { id: item.id },
          data: { gramsFromRoasted: { increment: item.gramsToRoast }, gramsToRoast: 0 },
        });
      }
    },
    { timeout: 20000, maxWait: 10000 }
  );
}

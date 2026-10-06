import "server-only";
import { prisma } from "@/lib/prisma";
import { markOrderPaid } from "@/lib/allocate";
import { captureShippingAddress } from "@/lib/shipping-address";
import { squareFetch } from "@/lib/square";
import { formatCents } from "@/lib/shop-stock";

/**
 * Everything that keeps our order records honest when Square is the one that
 * knows what happened: settling a paid order, catching payments whose
 * notification never arrived, and flagging refunds.
 */

/** Marks an online order paid (and saves its shipping address). Safe to call more than once. */
export async function settleOrder(squareOrderId: string, paidCents: number | null): Promise<string> {
  const order = await prisma.shopOrder.findUnique({ where: { squareOrderId }, select: { id: true, fulfillment: true } });
  if (!order) return "unknown-order";
  const result = await markOrderPaid(squareOrderId, paidCents);
  if (order.fulfillment === "SHIPMENT") {
    await captureShippingAddress(order.id, squareOrderId).catch((err) =>
      console.error("Could not read the shipping address for", squareOrderId, err)
    );
  }
  return result;
}

/**
 * A refund made in Square. We don't try to guess whether the coffee left the
 * building, so the order is flagged for a person to look at, with the amount.
 * Repeats of the same notification don't re-flag.
 */
export async function applyRefund(squareOrderId: string, refundedCents: number): Promise<string> {
  const order = await prisma.shopOrder.findUnique({ where: { squareOrderId } });
  if (!order || !["PAID", "READY", "FULFILLED", "NEEDS_ATTENTION"].includes(order.status)) return "ignored";
  const total = order.totalCents ?? order.subtotalCents + order.shippingCents;
  const note = `Refunded ${formatCents(refundedCents)} of ${formatCents(total)} in Square. If the coffee wasn't handed over, add the bags back on the Coffees page.`;
  if (order.attentionNote === note) return "already-flagged";
  await prisma.shopOrder.update({ where: { id: order.id }, data: { status: "NEEDS_ATTENTION", attentionNote: note } });
  return "refund-flagged";
}

interface SqOrder {
  state?: string;
  total_money?: { amount?: number };
  net_amount_due_money?: { amount?: number };
  tenders?: unknown[];
}

const MINUTE = 60_000;

/**
 * Looks at orders still waiting for payment after a few minutes and asks Square
 * directly: if one was actually paid (its notification was missed), settle it;
 * if it was abandoned for days, cancel it. Bounded work per run.
 */
export async function reconcilePendingOrders(): Promise<{ settled: number; canceled: number }> {
  const stale = await prisma.shopOrder.findMany({
    where: { status: "PENDING", squareOrderId: { not: null }, createdAt: { lt: new Date(Date.now() - 5 * MINUTE) } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  let settled = 0;
  let canceled = 0;
  for (const o of stale) {
    try {
      const res = await squareFetch<{ order?: SqOrder }>("GET", `/v2/orders/${o.squareOrderId}`);
      const sq = res.order;
      const paid = sq?.state === "COMPLETED" || (!!sq?.tenders?.length && (sq.net_amount_due_money?.amount ?? 1) === 0);
      if (paid) {
        await settleOrder(o.squareOrderId as string, sq?.total_money?.amount ?? null);
        settled++;
      } else if (Date.now() - o.createdAt.getTime() > 3 * 24 * 60 * MINUTE) {
        await prisma.shopOrder.updateMany({
          where: { id: o.id, status: "PENDING" },
          data: { status: "CANCELED", attentionNote: "Checkout was never completed." },
        });
        canceled++;
      }
    } catch (err) {
      console.error("Could not reconcile order", o.publicRef, err);
    }
  }
  return { settled, canceled };
}

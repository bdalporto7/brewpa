import { WebhooksHelper } from "square";
import { prisma } from "@/lib/prisma";
import { markOrderPaid, recordPosSale } from "@/lib/allocate";
import { squareClient, webhookUrl } from "@/lib/square";

export const dynamic = "force-dynamic";

interface PaymentEvent {
  event_id?: string;
  type?: string;
  data?: {
    object?: {
      payment?: { id?: string; status?: string; order_id?: string; total_money?: { amount?: number | string } };
    };
  };
}

/**
 * Square tells us a payment changed. The signature is verified against the
 * raw body first; unsigned or tampered requests are rejected. Square delivers
 * at-least-once, so each event id is recorded and a repeat is a no-op.
 */
export async function POST(req: Request) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return new Response("Webhook not configured", { status: 503 });

  const body = await req.text();
  const valid = await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: req.headers.get("x-square-hmacsha256-signature") ?? "",
    signatureKey: key,
    notificationUrl: webhookUrl(),
  });
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: PaymentEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (event.type !== "payment.updated" || !event.event_id) return new Response("ignored", { status: 200 });

  const payment = event.data?.object?.payment;
  if (payment?.status !== "COMPLETED" || !payment.order_id) return new Response("ignored", { status: 200 });

  if (await prisma.processedSquareEvent.findUnique({ where: { eventId: event.event_id } })) {
    return new Response("duplicate", { status: 200 });
  }

  const paid = payment.total_money?.amount != null ? Number(payment.total_money.amount) : null;
  let result: string;
  const isOnlineOrder = await prisma.shopOrder.findUnique({
    where: { squareOrderId: payment.order_id },
    select: { id: true },
  });
  if (isOnlineOrder) {
    result = await markOrderPaid(payment.order_id, Number.isFinite(paid) ? paid : null);
  } else {
    result = await handlePosPayment(payment.id ?? payment.order_id, payment.order_id);
  }
  // Recorded only after a successful run, so a crash mid-way gets retried by Square.
  await prisma.processedSquareEvent.upsert({
    where: { eventId: event.event_id },
    create: { eventId: event.event_id },
    update: {},
  });
  return new Response(result, { status: 200 });
}

/**
 * A completed payment that isn't one of our online orders: a register sale.
 * Only lines for the synced coffee bags matter; everything else Square sells
 * (drinks, merch) is ignored. Safe against repeats — a payment is processed
 * once, keyed on its own id as well as the event id.
 */
async function handlePosPayment(paymentId: string, squareOrderId: string): Promise<string> {
  // When Square holds the bag counts it subtracts register sales itself.
  if (process.env.SHOP_SOURCE === "square") return "square-managed";
  const key = `pos-payment:${paymentId}`;
  if (await prisma.processedSquareEvent.findUnique({ where: { eventId: key } })) return "duplicate-payment";

  const res = await squareClient().orders.get({ orderId: squareOrderId });
  const lines = (res.order?.lineItems ?? [])
    .filter((l) => l.catalogObjectId)
    .map((l) => ({
      variationId: l.catalogObjectId as string,
      quantity: Number(l.quantity) || 0,
      totalCents: Number(l.totalMoney?.amount ?? 0),
    }))
    .filter((l) => l.quantity > 0);
  if (lines.length === 0) {
    await prisma.processedSquareEvent.upsert({ where: { eventId: key }, create: { eventId: key }, update: {} });
    return "no-coffee-lines";
  }

  const out = await recordPosSale(lines, paymentId);
  if (out.unmatched.length > 0 || out.shortGrams > 0) {
    console.warn("POS sale partly unrecorded", paymentId, out);
  }
  await prisma.processedSquareEvent.upsert({ where: { eventId: key }, create: { eventId: key }, update: {} });
  return out.shortGrams > 0 ? "pos-short-stock" : "pos-recorded";
}

import { WebhooksHelper } from "square";
import { prisma } from "@/lib/prisma";
import { markOrderPaid } from "@/lib/allocate";
import { webhookUrl } from "@/lib/square";

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
  const result = await markOrderPaid(payment.order_id, Number.isFinite(paid) ? paid : null);
  // Recorded only after a successful run, so a crash mid-way gets retried by Square.
  await prisma.processedSquareEvent.upsert({
    where: { eventId: event.event_id },
    create: { eventId: event.event_id },
    update: {},
  });
  return new Response(result, { status: 200 });
}

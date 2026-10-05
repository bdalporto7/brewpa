import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import ClearBag from "@/components/ClearBag";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/shop-stock";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = await prisma.shopOrder.findUnique({ where: { publicRef: ref }, include: { items: true } });
  if (!order) notFound();

  const pending = order.status === "PENDING";
  const canceled = order.status === "CANCELED";
  const firstName = order.customerName.split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
      {!canceled && <ClearBag />}
      {pending && <AutoRefresh />}
      <h1 className="text-5xl font-extrabold tracking-tight">
        {canceled ? "Order not completed" : pending ? "Confirming your payment" : `Thanks, ${firstName}`}
      </h1>
      <p className="mt-4 text-lg text-muted">
        {canceled
          ? "This order wasn't completed and you haven't been charged."
          : pending
            ? "This usually takes a few seconds. This page updates on its own."
            : "Your order is in. We sent a receipt to your email, and we'll be in touch about timing."}
      </p>

      <div className="mt-8 rounded-lg border-2 border-[var(--border-strong)] bg-surface p-6 shadow-[3px_3px_0_var(--shadow-ink)]">
        <p className="font-mono text-sm text-muted">Order {order.publicRef}</p>
        <ul className="mt-3 divide-y-2 divide-border">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2">
              <span>{i.quantity} × {i.variantLabel}</span>
              <span className="font-mono">{formatCents(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t-2 border-border pt-3">
          {order.fulfillment === "SHIPMENT" && (
            <div className="flex justify-between text-sm"><dt>Shipping</dt><dd className="font-mono">{order.shippingCents === 0 ? "Free" : formatCents(order.shippingCents)}</dd></div>
          )}
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="font-mono">{formatCents(order.totalCents ?? order.subtotalCents + order.shippingCents)}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-muted">
          {order.fulfillment === "PICKUP"
            ? `Pickup or local delivery in San Francisco, around ${order.pickupAt?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles" })}.`
            : "Shipping to the address you gave Square."}
        </p>
      </div>
    </div>
  );
}

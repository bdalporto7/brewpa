"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { earliestPickupDate, priceCart as priceCartLib, type PricedCart } from "@/lib/checkout";
import { getSiteSettings, shippingCentsFor } from "@/lib/site";
import { shopBaseUrl, squareClient, squareLocationId } from "@/lib/square";

export async function priceCartAction(lines: { variantId: string; qty: number }[]): Promise<PricedCart> {
  return priceCartLib(lines);
}

export type CheckoutResult = { error: string } | { url: string };

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRef(): string {
  const bytes = randomBytes(8);
  return "CY-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createCheckout(input: {
  lines: { variantId: string; qty: number }[];
  fulfillment: "PICKUP" | "SHIPMENT";
  pickupDate: string | null;
  name: string;
  email: string;
  phone: string;
}): Promise<CheckoutResult> {
  const teamId = process.env.SHOP_TEAM_ID;
  if (!teamId) return { error: "The shop isn't configured yet." };

  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 200);
  const phone = input.phone.trim().slice(0, 40);
  if (!name) return { error: "Enter your name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email so we can send your receipt." };
  if (input.fulfillment !== "PICKUP" && input.fulfillment !== "SHIPMENT") return { error: "Choose pickup or shipping." };

  // Cheap abuse guard: unpaid checkouts pile up if someone hammers this, so cap recent ones.
  const since = new Date(Date.now() - 10 * 60_000);
  const [byEmail, overall] = await Promise.all([
    prisma.shopOrder.count({ where: { status: "PENDING", customerEmail: email, createdAt: { gt: since } } }),
    prisma.shopOrder.count({ where: { status: "PENDING", createdAt: { gt: since } } }),
  ]);
  if (byEmail >= 5 || overall >= 40) return { error: "Too many checkouts started just now. Please wait a few minutes and try again." };

  const settings = await getSiteSettings();
  let pickupAt: Date | null = null;
  if (input.fulfillment === "PICKUP") {
    if (!input.pickupDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate)) return { error: "Choose a pickup date." };
    if (input.pickupDate < earliestPickupDate(settings.noticeDays)) {
      return { error: `Pickup needs at least ${settings.noticeDays} days' notice. Pick a later date.` };
    }
    pickupAt = new Date(`${input.pickupDate}T19:00:00Z`); // about noon in San Francisco
  }

  const cart = await priceCartLib(input.lines);
  if (cart.lines.length === 0) return { error: "Your bag is empty." };
  if (!cart.ok) return { error: "Something in your bag is no longer available. Review it and try again." };

  const squareSourced = process.env.SHOP_SOURCE === "square";
  const shippingCents = input.fulfillment === "SHIPMENT" ? shippingCentsFor(settings, cart.subtotalCents) : 0;
  const publicRef = newRef();

  const order = await prisma.shopOrder.create({
    data: {
      publicRef,
      fulfillment: input.fulfillment,
      pickupAt,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || null,
      subtotalCents: cart.subtotalCents,
      shippingCents,
      totalCents: cart.subtotalCents + shippingCents,
      teamId,
      items: {
        create: cart.lines.map((l) => ({
          beanId: l.beanId,
          squareVariationId: squareSourced ? l.variantId : null,
          variantLabel: `${l.coffeeName}, ${l.label}`,
          grams: l.grams,
          quantity: l.qty,
          unitPriceCents: l.unitPriceCents,
        })),
      },
    },
  });

  try {
    const recipient = { displayName: name, emailAddress: email, phoneNumber: phone || undefined };
    const res = await squareClient().checkout.paymentLinks.create({
      idempotencyKey: order.id,
      order: {
        locationId: squareLocationId(),
        referenceId: publicRef,
        // Square-sourced: real catalog items, so Square itself takes the bags out of
        // inventory when the order is paid. Otherwise an ad hoc named line.
        lineItems: cart.lines.map((l) =>
          squareSourced
            ? { catalogObjectId: l.variantId, quantity: String(l.qty) }
            : {
                name: `${l.coffeeName}, ${l.label}`,
                quantity: String(l.qty),
                basePriceMoney: { amount: BigInt(l.unitPriceCents), currency: "USD" as const },
              }
        ),
        fulfillments: [
          input.fulfillment === "PICKUP"
            ? {
                type: "PICKUP",
                state: "PROPOSED",
                pickupDetails: {
                  recipient,
                  scheduleType: "SCHEDULED",
                  pickupAt: pickupAt!.toISOString(),
                  note: "We'll email to arrange the pickup or local delivery time.",
                },
              }
            : { type: "SHIPMENT", state: "PROPOSED", shipmentDetails: { recipient } },
        ],
      },
      checkoutOptions: {
        redirectUrl: `${shopBaseUrl()}/order/${publicRef}`,
        enableCoupon: false,
        allowTipping: input.fulfillment === "PICKUP",
        askForShippingAddress: input.fulfillment === "SHIPMENT",
        ...(shippingCents > 0
          ? { shippingFee: { name: "Shipping", charge: { amount: BigInt(shippingCents), currency: "USD" } } }
          : {}),
      },
    });
    const link = res.paymentLink;
    if (!link?.url || !link.orderId) throw new Error(JSON.stringify(res.errors ?? "no payment link returned"));
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { squareOrderId: link.orderId, paymentLinkId: link.id },
    });
    return { url: link.url };
  } catch (err) {
    console.error("Square checkout creation failed", order.id, err);
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { status: "CANCELED", attentionNote: "Could not create the Square checkout." },
    });
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
}

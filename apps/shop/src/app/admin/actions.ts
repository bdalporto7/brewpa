"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { syncFulfillmentToSquare } from "@/lib/square-fulfillment";
import { DETAIL_FIELDS, SIZE_PRESETS, addBags, createCoffee, deleteCoffee, readPool, saveCoffeeDetails, setBagCount, setCoffeeListed, setStockReference, uploadCoffeePhoto } from "@/lib/square-admin";

const STEPS = ["PAID", "READY", "FULFILLED"] as const;

/**
 * Moves a paid order along: Paid → Ready → Fulfilled (or back a step, or out of
 * "needs attention" once someone has sorted it). PENDING and CANCELED orders are
 * driven by Square, not by us, so they're refused here.
 */
export async function setOrderStatus(orderId: string, status: (typeof STEPS)[number]) {
  const user = await requireAdmin();
  if (!STEPS.includes(status)) throw new Error("Unknown status.");
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { id: orderId, teamId: user.teamId } });
  if (order.status === "PENDING" || order.status === "CANCELED") throw new Error("That order hasn't been paid.");
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { status, ...(status === "PAID" ? {} : { attentionNote: null }) },
  });
  // Mirror forward moves in Square. Our status is already saved, so a Square hiccup
  // is logged rather than blocking the person packing orders.
  if ((status === "READY" || status === "FULFILLED") && order.squareOrderId) {
    await syncFulfillmentToSquare(order.squareOrderId, status).catch((err) =>
      console.error("Could not update the Square fulfillment for", order.publicRef, err)
    );
  }
  revalidatePath("/admin/orders");
}

const str = (f: FormData, key: string): string | null => {
  const v = f.get(key)?.toString().trim();
  return v ? v : null;
};
const cents = (f: FormData, key: string, label: string): number => {
  const n = Number(f.get(key));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be $0 or more.`);
  return Math.round(n * 100);
};

/** Saves the storefront's site-wide text and ordering terms (creating the row on first save). */
export async function saveSiteSettings(formData: FormData) {
  const user = await requireAdmin();
  const noticeDays = Number(formData.get("noticeDays"));
  if (!Number.isInteger(noticeDays) || noticeDays < 0 || noticeDays > 30) {
    throw new Error("Pickup notice must be a whole number of days, 0 to 30.");
  }
  const required = (key: string, label: string) => {
    const v = str(formData, key);
    if (!v) throw new Error(`${label} can't be empty.`);
    return v;
  };
  const instagramUrl = str(formData, "instagramUrl");
  if (instagramUrl && !/^https:\/\//.test(instagramUrl)) throw new Error("Instagram link should start with https://");

  const data = {
    announcement: str(formData, "announcement"),
    localSummary: required("localSummary", "Local pickup/delivery line"),
    noticeDays,
    shippingFlatCents: cents(formData, "shippingFlat", "Shipping price"),
    freeShippingOverCents: cents(formData, "freeShippingOver", "Free-shipping threshold"),
    instagramUrl,
    aboutIntro: str(formData, "aboutIntro"),
    aboutBody: str(formData, "aboutBody"),
  };
  await prisma.shopSettings.upsert({
    where: { teamId: user.teamId },
    create: { teamId: user.teamId, ...data },
    update: data,
  });
  revalidatePath("/", "layout");
}

const refreshShop = () => revalidatePath("/", "layout");

/** Saves a coffee's description, backorder switch and detail fields into Square. */
export async function saveCoffee(itemId: string, formData: FormData) {
  await requireAdmin();
  const fields: Record<string, string> = {};
  for (const f of DETAIL_FIELDS) fields[f.key] = String(formData.get(f.key) ?? "");
  if (fields.roasted_on && Number.isNaN(Date.parse(fields.roasted_on))) throw new Error("Roasted on should be a date.");
  await saveCoffeeDetails(itemId, {
    description: String(formData.get("description") ?? ""),
    // Only touched when the form offers the switch (backorders are off for now).
    backorder: formData.has("backorderPresent") ? formData.get("backorder") === "on" : undefined,
    fields,
  });
  refreshShop();
}

export async function toggleCoffeeListed(itemId: string, listed: boolean) {
  await requireAdmin();
  await setCoffeeListed(itemId, listed);
  refreshShop();
}

/**
 * Adds roasted coffee (in ounces) to a coffee's pool. The coffee's "full stock
 * level" (the basis for the low-stock badge) rises to the new total if that's
 * higher than before, so topping up a nearly empty coffee doesn't hide that it's low.
 */
export async function addCoffeeOunces(itemId: string, poolId: string, ounces: number) {
  await requireAdmin();
  const before = await readPool(poolId);
  await addBags(poolId, ounces);
  await updateReference(itemId, Math.max(0, before) + ounces, "raise");
  refreshShop();
}

/** Sets a coffee's pool to an exact number of ounces and treats that as its new full stock level. */
export async function recountCoffeeOunces(itemId: string, poolId: string, ounces: number) {
  await requireAdmin();
  await setBagCount(poolId, ounces);
  await updateReference(itemId, ounces, "reset");
  refreshShop();
}

async function updateReference(itemId: string, ounces: number, mode: "raise" | "reset") {
  try {
    if (mode === "raise") {
      const { listAdminCoffees } = await import("@/lib/square-admin");
      const current = (await listAdminCoffees()).coffees.find((c) => c.id === itemId)?.stockRefOz ?? 0;
      if (ounces <= current) return;
    }
    await setStockReference(itemId, ounces);
  } catch (err) {
    // The stock itself is already saved; the badge just won't move this time.
    console.error("Could not update the full stock level for", itemId, err);
  }
}

/** Saves a photo (already shrunk in the browser) as the coffee's main picture in Square. */
export async function saveCoffeePhoto(itemId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo first.");
  await uploadCoffeePhoto(itemId, file);
  refreshShop();
}

/** Adds a new coffee to Square, set up for pooled stock, from the admin's "Add a coffee" form. */
export async function addCoffee(formData: FormData) {
  await requireAdmin();
  const sizes = SIZE_PRESETS.filter((s) => formData.get(`size.${s.oz}`) === "on").map((s) => {
    const dollars = Number(formData.get(`price.${s.oz}`));
    return { label: s.label, oz: s.oz, cents: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN };
  });
  const lb = Number(formData.get("stockLb") || 0);
  const oz = Number(formData.get("stockOz") || 0);
  if (![lb, oz].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Starting stock should be a number of pounds and ounces.");
  await createCoffee({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    sizes,
    poolOz: Math.round(lb * 16 + oz),
    listed: formData.get("listed") === "on",
  });
  refreshShop();
}

/** Removes a coffee from Square for good. */
export async function removeCoffee(itemId: string) {
  await requireAdmin();
  await deleteCoffee(itemId);
  refreshShop();
}

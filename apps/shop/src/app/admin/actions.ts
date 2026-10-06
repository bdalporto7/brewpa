"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

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
    tagline: required("tagline", "Tagline"),
    heroHeadline: required("heroHeadline", "Homepage headline"),
    heroBody: required("heroBody", "Homepage intro"),
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

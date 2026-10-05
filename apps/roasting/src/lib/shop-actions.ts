"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { DEFAULT_VARIANTS, slugify } from "@/lib/shop-stock";

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = raw.toString().trim();
  return value === "" ? null : value;
}

/** Slugs are globally unique (they're public URLs), so suffix -2, -3… on collision. */
async function uniqueSlug(base: string, excludeListingId?: string): Promise<string> {
  const root = slugify(base);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const taken = await prisma.beanListing.findUnique({ where: { slug: candidate } });
    if (!taken || taken.id === excludeListingId) return candidate;
  }
  throw new Error("Couldn't find a free URL for this coffee — try a different slug.");
}

/**
 * Creates the bean's shop listing (unlisted) with the standard bag sizes, so
 * the roaster can review copy/prices before flipping it live. Idempotent: a
 * bean that already has a listing just keeps it.
 */
export async function createShopListing(beanId: string) {
  const user = await requireUser();
  const bean = await prisma.bean.findFirstOrThrow({
    where: { id: beanId, teamId: user.teamId },
    include: { shopListing: true },
  });
  if (bean.shopListing) return;

  await prisma.beanListing.create({
    data: {
      beanId: bean.id,
      teamId: user.teamId,
      slug: await uniqueSlug(bean.name),
      description: bean.tastingNotes,
      variants: {
        create: DEFAULT_VARIANTS.map((v, i) => ({ ...v, sortOrder: i })),
      },
    },
  });
  revalidatePath(`/beans/${beanId}`);
  revalidatePath("/shop");
}

async function ownedListing(listingId: string, teamId: string) {
  return prisma.beanListing.findFirstOrThrow({
    where: { id: listingId, teamId },
    include: { variants: true },
  });
}

/** "Sell online" on/off — the one control the roaster will touch most, so it's its own action. */
export async function setListingListed(listingId: string, isListed: boolean) {
  const user = await requireUser();
  const listing = await ownedListing(listingId, user.teamId);
  if (isListed && !listing.variants.some((v) => v.active)) {
    throw new Error("Turn on at least one bag size before listing this coffee.");
  }
  await prisma.beanListing.update({ where: { id: listing.id }, data: { isListed } });
  revalidatePath(`/beans/${listing.beanId}`);
  revalidatePath("/shop");
}

/**
 * Saves listing copy plus every bag size. Variant fields arrive as
 * `variant.<id>.label|grams|price|active`; price is entered in dollars and
 * stored as integer cents.
 */
export async function updateShopListing(listingId: string, formData: FormData) {
  const user = await requireUser();
  const listing = await ownedListing(listingId, user.teamId);

  const slugInput = str(formData, "slug");
  const slug = slugInput && slugify(slugInput) !== listing.slug
    ? await uniqueSlug(slugInput, listing.id)
    : listing.slug;

  const variantUpdates = listing.variants.map((v) => {
    const label = str(formData, `variant.${v.id}.label`);
    const grams = Number(formData.get(`variant.${v.id}.grams`));
    const price = Number(formData.get(`variant.${v.id}.price`));
    const active = formData.get(`variant.${v.id}.active`) === "on";
    if (!label) throw new Error("Every bag size needs a label.");
    if (!Number.isFinite(grams) || grams <= 0) throw new Error(`"${label}" needs a weight in grams above 0.`);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`"${label}" needs a price above $0.`);
    return { id: v.id, label, grams, priceCents: Math.round(price * 100), active };
  });

  if (listing.isListed && !variantUpdates.some((v) => v.active)) {
    throw new Error("A listed coffee needs at least one active bag size — unlist it first to turn them all off.");
  }

  await prisma.$transaction([
    prisma.beanListing.update({
      where: { id: listing.id },
      data: {
        slug,
        headline: str(formData, "headline"),
        description: str(formData, "description"),
        roastStyle: str(formData, "roastStyle"),
        brewNotes: str(formData, "brewNotes"),
      },
    }),
    ...variantUpdates.map(({ id, ...data }) => prisma.listingVariant.update({ where: { id }, data })),
  ]);
  revalidatePath(`/beans/${listing.beanId}`);
  revalidatePath("/shop");
}

/**
 * Moves a listing one place up/down in the shop's order. Renumbers every
 * listing 0..n first, so old rows that all share sortOrder 0 still move
 * predictably.
 */
export async function moveListing(listingId: string, direction: "up" | "down") {
  const user = await requireUser();
  const listings = await prisma.beanListing.findMany({
    where: { teamId: user.teamId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const ids = listings.map((l) => l.id);
  const from = ids.indexOf(listingId);
  if (from === -1) throw new Error("That coffee isn't on the shop.");
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  await prisma.$transaction(ids.map((id, i) => prisma.beanListing.update({ where: { id }, data: { sortOrder: i } })));
  revalidatePath("/shop");
}

function dollarsToCents(formData: FormData, key: string, label: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be $0 or more.`);
  return Math.round(value * 100);
}

/** Saves the team's storefront settings (creating the row on first save). */
export async function saveShopSettings(formData: FormData) {
  const user = await requireUser();
  const noticeDays = Number(formData.get("noticeDays"));
  if (!Number.isInteger(noticeDays) || noticeDays < 0 || noticeDays > 30) {
    throw new Error("Roast-to-order notice must be a whole number of days, 0–30.");
  }
  const required = (key: string, label: string) => {
    const v = str(formData, key);
    if (!v) throw new Error(`${label} can't be empty.`);
    return v;
  };
  const instagramUrl = str(formData, "instagramUrl");
  if (instagramUrl && !/^https:\/\//.test(instagramUrl)) {
    throw new Error("Instagram link should start with https://");
  }

  const data = {
    announcement: str(formData, "announcement"),
    tagline: required("tagline", "Tagline"),
    heroHeadline: required("heroHeadline", "Homepage headline"),
    heroBody: required("heroBody", "Homepage intro"),
    localSummary: required("localSummary", "Local pickup/delivery line"),
    noticeDays,
    shippingFlatCents: dollarsToCents(formData, "shippingFlat", "Shipping price"),
    freeShippingOverCents: dollarsToCents(formData, "freeShippingOver", "Free-shipping threshold"),
    instagramUrl,
    aboutIntro: str(formData, "aboutIntro"),
    aboutBody: str(formData, "aboutBody"),
  };
  await prisma.shopSettings.upsert({
    where: { teamId: user.teamId },
    create: { teamId: user.teamId, ...data },
    update: data,
  });
  revalidatePath("/shop");
}

const ORDER_STATUS_STEPS = ["PAID", "READY", "FULFILLED"] as const;

/**
 * Moves a paid online order along: Paid → Ready → Fulfilled (or back a step,
 * or out of "needs attention" once a human has sorted it). PENDING and
 * CANCELED orders aren't touched — those are driven by Square, not by us.
 */
export async function setShopOrderStatus(orderId: string, status: (typeof ORDER_STATUS_STEPS)[number]) {
  const user = await requireUser();
  if (!ORDER_STATUS_STEPS.includes(status)) throw new Error("Unknown status.");
  const order = await prisma.shopOrder.findFirstOrThrow({ where: { id: orderId, teamId: user.teamId } });
  if (order.status === "PENDING" || order.status === "CANCELED") {
    throw new Error("That order hasn't been paid.");
  }
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { status, ...(status === "PAID" ? {} : { attentionNote: null }) },
  });
  revalidatePath("/shop/orders");
  revalidatePath("/shop");
}

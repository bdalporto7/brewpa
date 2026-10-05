import "server-only";
import { SquareClient, SquareEnvironment } from "square";
import { prisma } from "@/lib/prisma";

/**
 * Mirrors each listed coffee into Square's catalog as an item with one
 * variation per active bag size, so the same bags can be rung up on the
 * register at a pop-up. Our database stays the inventory source of truth:
 * Square inventory tracking is left off, and the shop's webhook subtracts
 * grams when a variation sells. Each variation's SKU is our ListingVariant id,
 * which is how a sale gets matched back to a bag size.
 */

export function squareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

function client(): SquareClient {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
}

export type SyncResult = { status: "synced" | "removed" | "skipped"; detail?: string };

export async function syncListingToSquare(listingId: string): Promise<SyncResult> {
  if (!squareConfigured()) return { status: "skipped", detail: "Square isn't connected to this app." };

  const listing = await prisma.beanListing.findUnique({
    where: { id: listingId },
    include: { bean: true, variants: { orderBy: { sortOrder: "asc" } } },
  });
  if (!listing) return { status: "skipped", detail: "Listing not found." };

  const square = client();
  const active = listing.variants.filter((v) => v.active);
  const shouldExist = listing.isListed && active.length > 0;

  if (!shouldExist) {
    if (listing.squareItemId) {
      await square.catalog.batchDelete({ objectIds: [listing.squareItemId] });
      await prisma.$transaction([
        prisma.beanListing.update({ where: { id: listing.id }, data: { squareItemId: null } }),
        prisma.listingVariant.updateMany({ where: { listingId: listing.id }, data: { squareVariationId: null } }),
      ]);
      return { status: "removed" };
    }
    return { status: "skipped", detail: "Not listed, nothing in Square." };
  }

  // Existing objects need their current version to be updated in place.
  let itemVersion: bigint | undefined;
  const variationVersions = new Map<string, bigint>();
  if (listing.squareItemId) {
    try {
      const existing = await square.catalog.object.get({ objectId: listing.squareItemId });
      const obj = existing.object;
      if (obj && !obj.isDeleted) {
        itemVersion = obj.version;
        if (obj.type === "ITEM") {
          for (const v of obj.itemData?.variations ?? []) if (v.id && v.version != null) variationVersions.set(v.id, v.version);
        }
      }
    } catch {
      // Deleted on the Square side — recreate below.
    }
  }
  const reuseItem = itemVersion != null && listing.squareItemId;
  const itemId = reuseItem ? (listing.squareItemId as string) : `#coffee-${listing.id}`;

  const result = await square.catalog.batchUpsert({
    idempotencyKey: `${listing.id}-${Date.now()}`,
    batches: [
      {
        objects: [
          {
            type: "ITEM",
            id: itemId,
            ...(reuseItem ? { version: itemVersion } : {}),
            presentAtAllLocations: true,
            itemData: {
              name: listing.bean.name,
              description: listing.headline ?? undefined,
              productType: "REGULAR",
              isTaxable: false,
              variations: active.map((v) => {
                const existingId = reuseItem && v.squareVariationId && variationVersions.has(v.squareVariationId) ? v.squareVariationId : null;
                return {
                  type: "ITEM_VARIATION" as const,
                  id: existingId ?? `#var-${v.id}`,
                  ...(existingId ? { version: variationVersions.get(existingId) } : {}),
                  presentAtAllLocations: true,
                  itemVariationData: {
                    itemId,
                    name: v.label,
                    sku: v.id,
                    pricingType: "FIXED_PRICING" as const,
                    priceMoney: { amount: BigInt(v.priceCents), currency: "USD" as const },
                    trackInventory: false,
                  },
                };
              }),
            },
          },
        ],
      },
    ],
  });

  const saved = result.objects?.find((o) => o.type === "ITEM");
  if (!saved || saved.type !== "ITEM" || !saved.id) throw new Error("Square didn't return the saved item.");
  const bySku = new Map<string, string>();
  for (const v of saved.itemData?.variations ?? []) {
    if (v.type === "ITEM_VARIATION" && v.id && v.itemVariationData?.sku) bySku.set(v.itemVariationData.sku, v.id);
  }
  await prisma.$transaction([
    prisma.beanListing.update({ where: { id: listing.id }, data: { squareItemId: saved.id } }),
    ...listing.variants.map((v) =>
      prisma.listingVariant.update({ where: { id: v.id }, data: { squareVariationId: v.active ? (bySku.get(v.id) ?? null) : null } })
    ),
  ]);
  return { status: "synced" };
}

/** Never lets a Square hiccup fail the save that triggered it. */
export async function syncListingToSquareQuietly(listingId: string): Promise<void> {
  try {
    await syncListingToSquare(listingId);
  } catch (err) {
    console.error("Square catalog sync failed for listing", listingId, err);
  }
}

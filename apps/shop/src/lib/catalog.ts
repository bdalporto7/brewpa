import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { backorderedGramsByBean } from "@/lib/backorders";
import { getSquareCoffees } from "@/lib/square-catalog";

/** Where coffees come from: our database (default) or Square's catalog and inventory. */
const fromSquare = () => process.env.SHOP_SOURCE === "square";
import { beanStock, variantAvailability, type Availability } from "@/lib/shop-stock";

/**
 * The only way pages read coffees. Returns a deliberately narrow public
 * shape — never the raw Bean row, which carries private fields (green
 * purchase price, supplier links, internal notes) that must not reach a
 * public page or its serialized props.
 */

export interface PublicVariant {
  id: string;
  label: string;
  grams: number;
  priceCents: number;
  availability: Availability;
  /** Bags this size could be filled right now (from the coffee's pool, or its own count). */
  stock?: number;
  /** Ounces one bag of this size takes from the coffee's pool, when stock is pooled. */
  ozEach?: number;
}

export interface PublicCoffee {
  /** Ounces of this coffee in stock, when stock is pooled (Square stock conversion). */
  poolOz?: number;
  /** True at 10% or less of the coffee's full stock level (and not sold out). */
  lowStock?: boolean;
  /** Keeps selling past zero; the pool goes negative and the roaster sees what's owed. */
  backorder?: boolean;
  slug: string;
  name: string;
  origin: string;
  producer: string | null;
  process: string;
  variety: string | null;
  roastStyle: string | null;
  headline: string | null;
  description: string | null;
  brewNotes: string | null;
  photoUrl: string | null;
  /** Most recent completed roast that still has coffee left — shown as "Roasted on". */
  roastedOn: Date | null;
  variants: PublicVariant[];
  /** Best availability across sizes, for the grid badge. */
  availability: Availability;
  fromPriceCents: number | null;
}

function teamId(): string {
  const id = process.env.SHOP_TEAM_ID;
  if (!id) throw new Error("SHOP_TEAM_ID must be set.");
  return id;
}

const listingInclude = {
  variants: true,
  bean: {
    include: {
      roastSessions: {
        select: {
          endedAt: true,
          greenWeightGrams: true,
          roastedWeightGrams: true,
          roastedRemainingGrams: true,
        },
      },
    },
  },
} as const;

type ListingRow = NonNullable<
  Awaited<ReturnType<typeof prisma.beanListing.findFirst<{ include: typeof listingInclude }>>>
>;

const RANK: Record<Availability, number> = { ready: 0, roast_to_order: 1, backorder: 2, sold_out: 3 };

function toPublic(row: ListingRow, backordered: Map<string, number>): PublicCoffee {
  const { bean } = row;
  const stock = beanStock(bean, bean.roastSessions, backordered.get(bean.id) ?? 0);
  const variants = row.variants
    .filter((v) => v.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({
      id: v.id,
      label: v.label,
      grams: v.grams,
      priceCents: v.priceCents,
      availability: variantAvailability(stock, v.grams, row.allowBackorder),
    }));
  const best = variants.reduce<Availability>(
    (acc, v) => (RANK[v.availability] < RANK[acc] ? v.availability : acc),
    "sold_out"
  );
  const roastedOn =
    bean.roastSessions
      .filter((s) => s.endedAt != null && (s.roastedRemainingGrams ?? 0) > 0)
      .map((s) => s.endedAt as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    slug: row.slug,
    name: bean.name,
    origin: bean.origin,
    producer: bean.producer,
    process: bean.process,
    variety: bean.variety,
    roastStyle: row.roastStyle,
    headline: row.headline,
    description: row.description ?? bean.tastingNotes,
    brewNotes: row.brewNotes,
    photoUrl: bean.photoUrl,
    roastedOn,
    variants,
    availability: best,
    fromPriceCents: variants.length ? Math.min(...variants.map((v) => v.priceCents)) : null,
  };
}

/** Every listed coffee, in-stock first, then by the roaster's sort order. */
export const getListedCoffees = cache(async (): Promise<PublicCoffee[]> => {
  if (fromSquare()) return getSquareCoffees();
  const rows = await prisma.beanListing.findMany({
    where: { teamId: teamId(), isListed: true },
    include: listingInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const backordered = await backorderedGramsByBean(rows.map((r) => r.beanId));
  return rows
    .map((r) => toPublic(r, backordered))
    .filter((c) => c.variants.length > 0)
    .sort((a, b) => RANK[a.availability] - RANK[b.availability]);
});

export const getCoffee = cache(async (slug: string): Promise<PublicCoffee | null> => {
  if (fromSquare()) return (await getSquareCoffees()).find((c) => c.slug === slug) ?? null;
  const row = await prisma.beanListing.findFirst({
    where: { slug, teamId: teamId(), isListed: true },
    include: listingInclude,
  });
  if (!row) return null;
  const coffee = toPublic(row, await backorderedGramsByBean([row.beanId]));
  return coffee.variants.length > 0 ? coffee : null;
});

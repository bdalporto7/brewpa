import "server-only";
import { prisma } from "@/lib/prisma";
import { beanStock, variantAvailability, type Availability } from "@/lib/shop-stock";

export interface PricedLine {
  variantId: string;
  beanId: string;
  slug: string;
  coffeeName: string;
  origin: string;
  photoUrl: string | null;
  label: string;
  grams: number;
  qty: number;
  unitPriceCents: number;
  lineCents: number;
  availability: Availability;
  /** Set when this line can't be bought as asked. */
  problem: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  /** True when every line is buyable. */
  ok: boolean;
}

const MAX_QTY = 10;

/**
 * Re-prices a cart from the database — the client's idea of price or stock is
 * never trusted. Stock is checked per bean across the whole cart, so two
 * sizes of one coffee can't together exceed what exists.
 */
export async function priceCart(input: { variantId: string; qty: number }[]): Promise<PricedCart> {
  const teamId = process.env.SHOP_TEAM_ID;
  if (!teamId) throw new Error("SHOP_TEAM_ID must be set.");
  const wanted = input
    .filter((l) => typeof l.variantId === "string" && Number.isInteger(l.qty) && l.qty > 0)
    .map((l) => ({ variantId: l.variantId, qty: Math.min(l.qty, MAX_QTY) }));
  if (wanted.length === 0) return { lines: [], subtotalCents: 0, ok: false };

  const variants = await prisma.listingVariant.findMany({
    where: { id: { in: wanted.map((w) => w.variantId) } },
    include: {
      listing: {
        include: {
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
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const gramsByBean = new Map<string, number>();
  const lines: PricedLine[] = [];
  for (const w of wanted) {
    const v = byId.get(w.variantId);
    if (!v) continue;
    const { listing } = v;
    const sellable = v.active && listing.isListed && listing.teamId === teamId;
    const stock = beanStock(listing.bean, listing.bean.roastSessions);
    lines.push({
      variantId: v.id,
      beanId: listing.beanId,
      slug: listing.slug,
      coffeeName: listing.bean.name,
      origin: listing.bean.origin,
      photoUrl: listing.bean.photoUrl,
      label: v.label,
      grams: v.grams,
      qty: w.qty,
      unitPriceCents: v.priceCents,
      lineCents: v.priceCents * w.qty,
      availability: variantAvailability(stock, v.grams),
      problem: sellable ? null : "No longer available",
    });
    if (sellable) gramsByBean.set(listing.beanId, (gramsByBean.get(listing.beanId) ?? 0) + v.grams * w.qty);
  }

  for (const line of lines) {
    if (line.problem) continue;
    const bean = byId.get(line.variantId)!.listing.bean;
    const stock = beanStock(bean, bean.roastSessions);
    const total = gramsByBean.get(line.beanId) ?? 0;
    if (line.availability === "sold_out") line.problem = "Sold out";
    else if (total > stock.roastedGrams + stock.roastableGrams) line.problem = "Not enough left for this quantity";
  }

  return {
    lines,
    subtotalCents: lines.reduce((s, l) => s + l.lineCents, 0),
    ok: lines.length > 0 && lines.every((l) => !l.problem),
  };
}

/** Today's date in San Francisco, as YYYY-MM-DD. */
function todayPT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}
/** First date a pickup can be booked: today in San Francisco plus the notice period. */
export function earliestPickupDate(noticeDays: number): string {
  const [y, m, d] = todayPT().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + noticeDays)).toISOString().slice(0, 10);
}


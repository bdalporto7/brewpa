import "server-only";
import { prisma } from "@/lib/prisma";
import { backorderedGramsByBean } from "@/lib/backorders";
import { getSquareCoffees } from "@/lib/square-catalog";
import { beanStock, variantAvailability, type Availability } from "@/lib/shop-stock";

export interface PricedLine {
  variantId: string;
  /** Our bean, when the coffee came from our database; null for Square-only coffees. */
  beanId: string | null;
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
  /** Most that can be bought (bags on hand), or null when unlimited (backorder). */
  maxQty: number | null;
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
  if (process.env.SHOP_SOURCE === "square") return priceCartFromSquare(wanted);

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
  const backordered = await backorderedGramsByBean([...new Set(variants.map((v) => v.listing.beanId))]);

  const gramsByBean = new Map<string, number>();
  const lines: PricedLine[] = [];
  for (const w of wanted) {
    const v = byId.get(w.variantId);
    if (!v) continue;
    const { listing } = v;
    const sellable = v.active && listing.isListed && listing.teamId === teamId;
    const stock = beanStock(listing.bean, listing.bean.roastSessions, backordered.get(listing.beanId) ?? 0);
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
      availability: variantAvailability(stock, v.grams, listing.allowBackorder),
      maxQty: null,
      problem: sellable ? null : "No longer available",
    });
    if (sellable) gramsByBean.set(listing.beanId, (gramsByBean.get(listing.beanId) ?? 0) + v.grams * w.qty);
  }

  for (const line of lines) {
    if (line.problem || !line.beanId) continue;
    const { listing } = byId.get(line.variantId)!;
    const stock = beanStock(listing.bean, listing.bean.roastSessions, backordered.get(line.beanId) ?? 0);
    const total = gramsByBean.get(line.beanId) ?? 0;
    if (line.availability === "sold_out") line.problem = "Sold out";
    else if (!listing.allowBackorder && total > stock.roastedGrams + stock.roastableGrams) {
      line.problem = "Not enough left for this quantity";
    }
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


/**
 * The Square-sourced cart: prices and bag counts come from Square's catalog and
 * inventory, and variant ids are Square variation ids. A bag size can't be
 * bought beyond what's on hand unless that coffee allows backorders.
 */
async function priceCartFromSquare(wanted: { variantId: string; qty: number }[]): Promise<PricedCart> {
  const coffees = await getSquareCoffees();
  const lines: PricedLine[] = [];
  const ozByCoffee = new Map<string, number>();
  for (const w of wanted) {
    const coffee = coffees.find((c) => c.variants.some((v) => v.id === w.variantId));
    const v = coffee?.variants.find((x) => x.id === w.variantId);
    if (!coffee || !v) continue; // no longer sold (or an id from before a catalog change)
    lines.push({
      variantId: v.id,
      beanId: null,
      slug: coffee.slug,
      coffeeName: coffee.name,
      origin: coffee.origin,
      photoUrl: coffee.photoUrl,
      label: v.label,
      grams: 0,
      qty: w.qty,
      unitPriceCents: v.priceCents,
      lineCents: v.priceCents * w.qty,
      availability: v.availability,
      maxQty: null,
      problem: null,
    });
    if (v.ozEach) ozByCoffee.set(coffee.slug, (ozByCoffee.get(coffee.slug) ?? 0) + v.ozEach * w.qty);
  }

  // Stock is one pool per coffee, so sizes are checked together: three 12 oz bags
  // and a 5 lb bag draw from the same ounces.
  for (const line of lines) {
    const coffee = coffees.find((c) => c.slug === line.slug)!;
    const v = coffee.variants.find((x) => x.id === line.variantId)!;
    if (v.availability === "sold_out") {
      line.problem = "Sold out";
      continue;
    }
    if (coffee.backorder || coffee.poolOz === undefined || !v.ozEach) {
      // Backorder (or unpooled legacy stock): per-size count only when not backordering.
      if (!coffee.backorder && coffee.poolOz === undefined && line.qty > (v.stock ?? 0)) line.problem = (v.stock ?? 0) > 0 ? `Only ${v.stock} left` : "Sold out";
      line.maxQty = coffee.backorder ? null : coffee.poolOz === undefined ? (v.stock ?? 0) : null;
      continue;
    }
    const othersOz = (ozByCoffee.get(coffee.slug) ?? 0) - v.ozEach * line.qty;
    const room = Math.max(0, Math.floor((coffee.poolOz - othersOz) / v.ozEach));
    line.maxQty = room;
    if (line.qty > room) line.problem = room > 0 ? `Only ${room} left with the rest of your bag` : "Not enough left with the rest of your bag";
  }
  return {
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.lineCents, 0),
    ok: lines.length > 0 && lines.every((l) => !l.problem),
  };
}

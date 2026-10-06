import "server-only";
import { cache } from "react";
import type { PublicCoffee, PublicVariant } from "@/lib/catalog";
import type { Availability } from "@/lib/shop-stock";
import { slugify } from "@/lib/shop-stock";
import { squareFetch, squareLocationId } from "@/lib/square";

/**
 * The shop's catalog as Square holds it: coffees are items in the "Shop"
 * category, bag sizes are their variations, bag counts come from Square's
 * inventory, and the coffee's details are custom fields (set up by
 * scripts/square-setup.mjs). Returns the same narrow public shape the pages
 * already render, so nothing else about the site changes.
 */

const SHOP_CATEGORY = "Shop";

interface SqObject {
  id: string;
  type: string;
  is_deleted?: boolean;
  custom_attribute_values?: Record<string, { string_value?: string }>;
  item_data?: {
    name?: string;
    description_plaintext?: string;
    description?: string;
    is_archived?: boolean;
    categories?: { id: string }[];
    image_ids?: string[];
    variations?: SqObject[];
  };
  item_variation_data?: { name?: string; price_money?: { amount?: number }; track_inventory?: boolean };
  image_data?: { url?: string };
}

async function searchAll(body: Record<string, unknown>): Promise<{ objects: SqObject[]; related: SqObject[] }> {
  const objects: SqObject[] = [];
  const related: SqObject[] = [];
  let cursor: string | undefined;
  do {
    const res = await squareFetch<{ objects?: SqObject[]; related_objects?: SqObject[]; cursor?: string }>("POST", "/v2/catalog/search", { ...body, cursor });
    objects.push(...(res.objects ?? []));
    related.push(...(res.related_objects ?? []));
    cursor = res.cursor;
  } while (cursor);
  return { objects, related };
}

async function counts(variationIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (variationIds.length === 0) return out;
  let cursor: string | undefined;
  do {
    const res = await squareFetch<{ counts?: { catalog_object_id: string; state: string; quantity: string }[]; cursor?: string }>(
      "POST",
      "/v2/inventory/counts/batch-retrieve",
      { catalog_object_ids: variationIds, location_ids: [squareLocationId()], states: ["IN_STOCK"], cursor }
    );
    for (const c of res.counts ?? []) out.set(c.catalog_object_id, (out.get(c.catalog_object_id) ?? 0) + Number(c.quantity));
    cursor = res.cursor;
  } while (cursor);
  return out;
}

const attr = (o: SqObject, key: string): string | null => {
  const v = o.custom_attribute_values?.[`cybar_${key}`]?.string_value?.trim();
  return v ? v : null;
};

const RANK: Record<Availability, number> = { ready: 0, roast_to_order: 1, backorder: 2, sold_out: 3 };

export const getSquareCoffees = cache(async (): Promise<PublicCoffee[]> => {
  const { objects, related } = await searchAll({ object_types: ["ITEM", "CATEGORY"], include_related_objects: true });
  const shopCat = objects.find((o) => o.type === "CATEGORY" && (o as unknown as { category_data?: { name?: string } }).category_data?.name === SHOP_CATEGORY);
  if (!shopCat) return [];

  const items = objects.filter(
    (o) => o.type === "ITEM" && !o.is_deleted && !o.item_data?.is_archived && o.item_data?.categories?.some((c) => c.id === shopCat.id)
  );
  const images = new Map([...objects, ...related].filter((o) => o.type === "IMAGE").map((o) => [o.id, o.image_data?.url ?? null]));
  const stock = await counts(items.flatMap((i) => (i.item_data?.variations ?? []).map((v) => v.id)));

  const used = new Set<string>();
  const coffees = items.map((item): PublicCoffee => {
    const d = item.item_data!;
    let slug = slugify(d.name ?? "coffee");
    if (used.has(slug)) slug = `${slug}-${item.id.slice(0, 4).toLowerCase()}`;
    used.add(slug);

    const backorder = attr(item, "backorder")?.toLowerCase() === "yes";
    const variants: PublicVariant[] = (d.variations ?? [])
      .filter((v) => !v.is_deleted && v.item_variation_data?.price_money?.amount != null)
      .sort((a, b) => (a.item_variation_data!.price_money!.amount ?? 0) - (b.item_variation_data!.price_money!.amount ?? 0))
      .map((v) => {
        const onHand = stock.get(v.id) ?? 0;
        const availability: Availability = onHand > 0 ? "ready" : backorder ? "backorder" : "sold_out";
        return { id: v.id, label: v.item_variation_data?.name ?? "Bag", grams: 0, priceCents: v.item_variation_data!.price_money!.amount!, availability, stock: onHand };
      });
    const best = variants.reduce<Availability>((acc, v) => (RANK[v.availability] < RANK[acc] ? v.availability : acc), "sold_out");
    const roasted = attr(item, "roasted_on");
    return {
      slug,
      name: d.name ?? "Coffee",
      origin: attr(item, "origin") ?? "",
      producer: attr(item, "producer"),
      process: attr(item, "process") ?? "",
      variety: attr(item, "variety"),
      roastStyle: attr(item, "roast_style"),
      headline: attr(item, "headline"),
      description: d.description_plaintext ?? d.description ?? null,
      brewNotes: attr(item, "brew_notes"),
      photoUrl: images.get(d.image_ids?.[0] ?? "") ?? null,
      roastedOn: roasted && !Number.isNaN(Date.parse(roasted)) ? new Date(roasted) : null,
      variants,
      availability: best,
      fromPriceCents: variants.length ? Math.min(...variants.map((v) => v.priceCents)) : null,
    };
  });

  return coffees.filter((c) => c.variants.length > 0).sort((a, b) => RANK[a.availability] - RANK[b.availability] || a.name.localeCompare(b.name));
});

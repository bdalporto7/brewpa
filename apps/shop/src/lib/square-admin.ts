import "server-only";
import { squareFetch, squareLocationId } from "@/lib/square";

/**
 * The shop admin's view of Square: every coffee item (listed or not), its bag
 * sizes with counts, and the writes the admin needs — details, show/hide, and
 * bag counts. Square stays the source of truth; nothing here is cached.
 */

export const SHOP_CATEGORY = "Shop";

interface SqObject {
  id: string;
  type: string;
  version?: number;
  is_deleted?: boolean;
  updated_at?: string;
  created_at?: string;
  present_at_all_locations?: boolean;
  custom_attribute_values?: Record<string, { name?: string; type?: string; string_value?: string; [k: string]: unknown }>;
  category_data?: { name?: string };
  item_data?: {
    name?: string;
    description?: string;
    description_plaintext?: string;
    is_archived?: boolean;
    categories?: { id: string; ordinal?: number }[];
    image_ids?: string[];
    variations?: SqObject[];
    [k: string]: unknown;
  };
  image_data?: { url?: string };
  item_variation_data?: {
    name?: string;
    price_money?: { amount?: number };
    sellable?: boolean;
    stockable?: boolean;
    stockable_conversion?: { stockable_quantity?: string; nonstockable_quantity?: string };
  };
  [k: string]: unknown;
}

import { DETAIL_FIELDS } from "@/lib/square-admin-fields";
export { DETAIL_FIELDS };
export { SIZE_PRESETS } from "@/lib/square-admin-fields";

export interface AdminVariation {
  id: string;
  name: string;
  priceCents: number;
  /** Ounces one bag of this size takes from the coffee's pool. */
  ozEach: number | null;
}
export interface AdminCoffee {
  id: string;
  /** The coffee's main photo in Square, if it has one. */
  photoUrl: string | null;
  name: string;
  description: string;
  listed: boolean;
  backorder: boolean;
  fields: Record<string, string>;
  /** The hidden stockable variation holding this coffee's pool, or null if it isn't set up for pooled stock. */
  poolId: string | null;
  /** Ounces of coffee in stock (negative means owed to customers). */
  poolOz: number;
  /** The coffee's full stock level in ounces (basis for the 10% low-stock badge), or null if never set. */
  stockRefOz: number | null;
  variations: AdminVariation[];
}

async function searchItems(): Promise<{ items: SqObject[]; shopCategoryId: string | null; images: Map<string, string> }> {
  const items: SqObject[] = [];
  const images = new Map<string, string>();
  let shopCategoryId: string | null = null;
  let cursor: string | undefined;
  do {
    const res = await squareFetch<{ objects?: SqObject[]; related_objects?: SqObject[]; cursor?: string }>("POST", "/v2/catalog/search", {
      object_types: ["ITEM", "CATEGORY"],
      include_related_objects: true,
      cursor,
    });
    for (const o of [...(res.objects ?? []), ...(res.related_objects ?? [])]) {
      if (o.type === "IMAGE" && o.image_data?.url) images.set(o.id, o.image_data.url);
      if (o.type === "CATEGORY" && o.category_data?.name === SHOP_CATEGORY) shopCategoryId = o.id;
      if (o.type === "ITEM" && !o.is_deleted && !o.item_data?.is_archived) items.push(o);
    }
    cursor = res.cursor;
  } while (cursor);
  return { items, shopCategoryId, images };
}

async function counts(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  let cursor: string | undefined;
  do {
    const res = await squareFetch<{ counts?: { catalog_object_id: string; quantity: string }[]; cursor?: string }>(
      "POST",
      "/v2/inventory/counts/batch-retrieve",
      { catalog_object_ids: ids, location_ids: [squareLocationId()], states: ["IN_STOCK"], cursor }
    );
    for (const c of res.counts ?? []) out.set(c.catalog_object_id, (out.get(c.catalog_object_id) ?? 0) + Number(c.quantity));
    cursor = res.cursor;
  } while (cursor);
  return out;
}

const attr = (o: SqObject, key: string) => o.custom_attribute_values?.[`cybar_${key}`]?.string_value ?? "";

export async function listAdminCoffees(): Promise<{ coffees: AdminCoffee[]; hasShopCategory: boolean }> {
  const { items, shopCategoryId, images } = await searchItems();
  const stock = await counts(items.flatMap((i) => (i.item_data?.variations ?? []).map((v) => v.id)));
  const coffees = items
    .filter((i) => i.item_data?.variations?.length)
    .map((i): AdminCoffee => {
      const all = (i.item_data!.variations ?? []).filter((v) => !v.is_deleted);
      const pool = all.find((v) => v.item_variation_data?.stockable === true && v.item_variation_data?.sellable === false);
      return {
        id: i.id,
        photoUrl: images.get(i.item_data!.image_ids?.[0] ?? "") ?? null,
        name: i.item_data!.name ?? "Untitled",
        description: i.item_data!.description_plaintext ?? i.item_data!.description ?? "",
        listed: !!shopCategoryId && !!i.item_data!.categories?.some((c) => c.id === shopCategoryId),
        backorder: attr(i, "backorder").toLowerCase() === "yes",
        fields: Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, attr(i, f.key)])),
        poolId: pool?.id ?? null,
        poolOz: pool ? (stock.get(pool.id) ?? 0) : 0,
        stockRefOz: Number(attr(i, "stock_ref")) > 0 ? Number(attr(i, "stock_ref")) : null,
        variations: all
          .filter((v) => v.item_variation_data?.sellable !== false)
          .map((v) => {
            const c = v.item_variation_data?.stockable_conversion;
            return {
              id: v.id,
              name: v.item_variation_data?.name ?? "Bag",
              priceCents: v.item_variation_data?.price_money?.amount ?? 0,
              ozEach: c?.stockable_quantity && c.nonstockable_quantity ? Number(c.stockable_quantity) / Number(c.nonstockable_quantity) : null,
            };
          })
          .sort((a, b) => a.priceCents - b.priceCents),
      };
    })
    // Only items this shop manages: set up for pooled stock, or already shown on the site. Everything
    // else in the Square account (the cafe menu, wholesale, older items) is left out so it can't be edited or removed here.
    .filter((c) => c.poolId !== null || c.listed)
    .sort((a, b) => Number(b.listed) - Number(a.listed) || a.name.localeCompare(b.name));
  return { coffees, hasShopCategory: !!shopCategoryId };
}

/** Retrieve → change → upsert the whole item, so bag sizes and everything else Square holds are kept. */
async function updateItem(itemId: string, change: (item: SqObject, shopCategoryId: string | null) => void) {
  const { shopCategoryId } = await searchItems();
  const got = await squareFetch<{ object?: SqObject }>("GET", `/v2/catalog/object/${itemId}`);
  const item = got.object;
  if (!item || item.type !== "ITEM") throw new Error("That coffee wasn't found in Square.");
  const managed =
    item.item_data?.variations?.some((v) => v.item_variation_data?.stockable === true && v.item_variation_data?.sellable === false) ||
    (!!shopCategoryId && !!item.item_data?.categories?.some((c) => c.id === shopCategoryId));
  if (!managed) throw new Error("That item isn't a shop coffee, so it can't be edited here.");
  change(item, shopCategoryId);
  await squareFetch("POST", "/v2/catalog/object", { idempotency_key: `${itemId}-${Date.now()}`, object: item });
}

export async function saveCoffeeDetails(
  itemId: string,
  input: { description: string; backorder?: boolean; fields: Record<string, string> }
) {
  await updateItem(itemId, (item) => {
    const values = { ...(item.custom_attribute_values ?? {}) };
    const set = (key: string, value: string) => {
      const k = `cybar_${key}`;
      if (value.trim()) values[k] = { ...(values[k] ?? {}), name: values[k]?.name ?? k, type: "STRING", string_value: value.trim() };
      else delete values[k];
    };
    for (const f of DETAIL_FIELDS) set(f.key, input.fields[f.key] ?? "");
    if (input.backorder !== undefined) set("backorder", input.backorder ? "yes" : "no");
    item.custom_attribute_values = values;
    item.item_data = { ...item.item_data, description: input.description.trim() || undefined };
  });
}

/** Shows or hides a coffee on the website by adding or removing it from the "Shop" category. */
export async function setCoffeeListed(itemId: string, listed: boolean) {
  await updateItem(itemId, (item, shopCategoryId) => {
    if (!shopCategoryId) throw new Error('Square has no "Shop" category yet. Run the one-time setup first.');
    const rest = (item.item_data?.categories ?? []).filter((c) => c.id !== shopCategoryId);
    item.item_data = { ...item.item_data, categories: listed ? [...rest, { id: shopCategoryId }] : rest };
  });
}

/** Adds ounces of coffee to a coffee's pool (Square keeps the running total). */
export async function addBags(variationId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) throw new Error("Enter an amount of coffee above zero.");
  await squareFetch("POST", "/v2/inventory/changes/batch-create", {
    idempotency_key: `add-${variationId}-${Date.now()}`,
    changes: [
      {
        type: "ADJUSTMENT",
        adjustment: {
          catalog_object_id: variationId,
          from_state: "NONE",
          to_state: "IN_STOCK",
          location_id: squareLocationId(),
          quantity: String(quantity),
          occurred_at: new Date().toISOString(),
        },
      },
    ],
  });
}

/** Sets a coffee's pool to exactly this many ounces (a recount). Can't be negative. */
export async function setBagCount(variationId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw new Error("Enter an amount of coffee, 0 or more.");
  await squareFetch("POST", "/v2/inventory/changes/batch-create", {
    idempotency_key: `set-${variationId}-${Date.now()}`,
    changes: [
      {
        type: "PHYSICAL_COUNT",
        physical_count: {
          catalog_object_id: variationId,
          state: "IN_STOCK",
          location_id: squareLocationId(),
          quantity: String(quantity),
          occurred_at: new Date().toISOString(),
        },
      },
    ],
  });
}

/** Records a coffee's full stock level (ounces), the basis for the low-stock badge. */
export async function setStockReference(itemId: string, ounces: number) {
  await updateItem(itemId, (item) => {
    const values = { ...(item.custom_attribute_values ?? {}) };
    values.cybar_stock_ref = { ...(values.cybar_stock_ref ?? {}), name: "cybar_stock_ref", type: "STRING", string_value: String(Math.round(ounces)) };
    item.custom_attribute_values = values;
  });
}

/** Current ounces in a coffee's pool, read fresh. */
export async function readPool(poolId: string): Promise<number> {
  return (await counts([poolId])).get(poolId) ?? 0;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads a photo to Square and makes it the coffee's main picture (shown on the site and the register). */
export async function uploadCoffeePhoto(itemId: string, file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP photo.");
  if (file.size > 4 * 1024 * 1024) throw new Error("That photo is too large. Try a smaller one.");
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN must be set.");
  const host = process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const form = new FormData();
  form.append(
    "request",
    new Blob([JSON.stringify({ idempotency_key: `photo-${itemId}-${Date.now()}`, object_id: itemId, is_primary: true, image: { type: "IMAGE", id: "#photo", image_data: { caption: "Coffee photo" } } })], { type: "application/json" })
  );
  form.append("image_file", file, file.name || "coffee.jpg");
  const res = await fetch(`${host}/v2/catalog/images`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Square-Version": "2025-10-16" }, body: form });
  const json = (await res.json()) as { errors?: unknown };
  if (!res.ok || json.errors) throw new Error("Square didn't accept that photo. Try a different one.");
}

const POOL_NAME = "Coffee in stock (oz)";

/** One custom unit per bag size ("12 oz bag"): Square allows only one sold size per unit type per item. */
async function unitFor(oz: number, known: Map<string, string>): Promise<string> {
  const name = `${oz} oz bag`;
  const hit = known.get(name);
  if (hit) return hit;
  const res = await squareFetch<{ catalog_object?: { id: string } }>("POST", "/v2/catalog/object", {
    idempotency_key: `unit-${oz}-${Date.now()}`,
    object: {
      type: "MEASUREMENT_UNIT",
      id: `#u${oz}`,
      measurement_unit_data: { measurement_unit: { type: "TYPE_CUSTOM", custom_unit: { name, abbreviation: `${oz}oz` } }, precision: 0 },
    },
  });
  known.set(name, res.catalog_object!.id);
  return res.catalog_object!.id;
}

/**
 * Creates a coffee in Square set up for pooled stock: one hidden "Coffee in stock
 * (oz)" variation holding the pool, and one sellable variation per chosen bag size
 * converting from it. Photos are added afterwards.
 */
export async function createCoffee(input: {
  name: string;
  description: string;
  sizes: { label: string; oz: number; cents: number }[];
  poolOz: number;
  listed: boolean;
}): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Give the coffee a name (up to 80 characters).");
  if (input.sizes.length === 0) throw new Error("Choose at least one bag size.");
  for (const s of input.sizes) if (!Number.isInteger(s.cents) || s.cents < 100) throw new Error(`${s.label} needs a price of at least $1.`);
  if (!Number.isInteger(input.poolOz) || input.poolOz < 0) throw new Error("Starting stock can't be negative.");

  const { items, shopCategoryId } = await searchItems();
  if (items.some((i) => (i.item_data?.name ?? "").trim().toLowerCase() === name.toLowerCase())) {
    throw new Error("A coffee with that name already exists.");
  }
  if (input.listed && !shopCategoryId) throw new Error('Square has no "Shop" category yet. Run the one-time setup first.');

  const units = new Map<string, string>();
  const found = await squareFetch<{ objects?: { id: string; measurement_unit_data?: { measurement_unit?: { custom_unit?: { name?: string } } } }[] }>(
    "POST",
    "/v2/catalog/search",
    { object_types: ["MEASUREMENT_UNIT"] }
  );
  for (const u of found.objects ?? []) {
    const n = u.measurement_unit_data?.measurement_unit?.custom_unit?.name;
    if (n) units.set(n, u.id);
  }

  const sizeVariations = [];
  for (const s of input.sizes) {
    sizeVariations.push({
      type: "ITEM_VARIATION",
      id: `#size-${s.oz}`,
      present_at_all_locations: true,
      item_variation_data: {
        item_id: "#coffee",
        name: s.label,
        pricing_type: "FIXED_PRICING",
        price_money: { amount: s.cents, currency: "USD" },
        track_inventory: true,
        sellable: true,
        stockable: false,
        measurement_unit_id: await unitFor(s.oz, units),
        stockable_conversion: { stockable_item_variation_id: "#pool", stockable_quantity: String(s.oz), nonstockable_quantity: "1" },
      },
    });
  }
  const custom: Record<string, { name: string; type: "STRING"; string_value: string }> = {
    cybar_backorder: { name: "cybar_backorder", type: "STRING", string_value: "no" },
  };
  if (input.poolOz > 0) custom.cybar_stock_ref = { name: "cybar_stock_ref", type: "STRING", string_value: String(input.poolOz) };

  const res = await squareFetch<{ objects?: SqObject[] }>("POST", "/v2/catalog/batch-upsert", {
    idempotency_key: `create-${name}-${Date.now()}`,
    batches: [
      {
        objects: [
          {
            type: "ITEM",
            id: "#coffee",
            present_at_all_locations: true,
            custom_attribute_values: custom,
            item_data: {
              name,
              description: input.description.trim() || undefined,
              product_type: "REGULAR",
              is_taxable: false,
              categories: input.listed && shopCategoryId ? [{ id: shopCategoryId }] : [],
              variations: [
                {
                  type: "ITEM_VARIATION",
                  id: "#pool",
                  present_at_all_locations: true,
                  item_variation_data: { item_id: "#coffee", name: POOL_NAME, pricing_type: "VARIABLE_PRICING", track_inventory: true, sellable: false, stockable: true },
                },
                ...sizeVariations,
              ],
            },
          },
        ],
      },
    ],
  });
  const saved = res.objects?.find((o) => o.type === "ITEM");
  if (!saved) throw new Error("Square didn't save the coffee.");
  const pool = saved.item_data?.variations?.find((v) => v.item_variation_data?.stockable === true && v.item_variation_data?.sellable === false);
  if (pool && input.poolOz > 0) await setBagCount(pool.id, input.poolOz);
  return saved.id;
}

/** Permanently removes a coffee from Square (and so from the site and register). Past orders keep their own record. */
export async function deleteCoffee(itemId: string) {
  // Only coffees this shop manages can be removed here, never other items in the Square account.
  const { coffees } = await listAdminCoffees();
  if (!coffees.some((c) => c.id === itemId)) throw new Error("That item isn't a shop coffee, so it can't be removed here.");
  await squareFetch("POST", "/v2/catalog/batch-delete", { object_ids: [itemId] });
}

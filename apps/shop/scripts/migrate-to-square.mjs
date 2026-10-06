// Copies each coffee's website content from our database into Square, so Square
// becomes the place it's edited. Re-runnable: items already in Square are
// updated in place. Run after square-setup.mjs:
//   node --env-file=.env.local scripts/migrate-to-square.mjs [--counts "slug:8 oz=10,slug:12 oz=4"]
// --counts sets how many of each bag size are on hand (otherwise sizes are
// created at 0 and only new items are touched; existing counts are never reset).
import { createClient } from "@libsql/client";
import { call, upload, locationId, SHOP_CATEGORY } from "./square-lib.mjs";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const rows = async (sql) => (await db.execute(sql)).rows.map((r) => ({ ...r }));

const countsArg = process.argv.indexOf("--counts");
const counts = new Map();
if (countsArg > -1) for (const part of process.argv[countsArg + 1].split(",")) {
  const [key, n] = part.split("=");
  counts.set(key.trim(), Number(n));
}

const cat = (await call("POST", "/v2/catalog/search", { object_types: ["CATEGORY"] })).objects?.find((o) => o.category_data?.name === SHOP_CATEGORY);
if (!cat) throw new Error('Run square-setup.mjs first (no "Shop" category).');

const listings = await rows(`select l.id, l.slug, l.isListed, l.headline, l.description, l.roastStyle, l.brewNotes, l.allowBackorder, l.squareItemId,
  b.name, b.origin, b.producer, b.process, b.variety, b.photoUrl, b.tastingNotes
  from BeanListing l join Bean b on b.id = l.beanId order by l.sortOrder, l.createdAt`);

for (const l of listings) {
  const variants = await rows(`select id, label, grams, priceCents, squareVariationId from ListingVariant where listingId='${l.id}' and active=1 order by sortOrder`);
  let version, varVersions = new Map(), imageIds = [];
  if (l.squareItemId) {
    try {
      const cur = (await call("GET", `/v2/catalog/object/${l.squareItemId}`)).object;
      if (cur && !cur.is_deleted) {
        version = cur.version;
        imageIds = cur.item_data?.image_ids ?? [];
        for (const v of cur.item_data?.variations ?? []) varVersions.set(v.id, v.version);
      }
    } catch { /* gone in Square: recreate */ }
  }
  const itemId = version ? l.squareItemId : `#coffee-${l.id}`;
  const attrs = { cybar_headline: l.headline, cybar_origin: l.origin, cybar_producer: l.producer, cybar_process: l.process,
    cybar_variety: l.variety, cybar_roast_style: l.roastStyle, cybar_brew_notes: l.brewNotes, cybar_backorder: l.allowBackorder ? "yes" : "no" };
  const result = await call("POST", "/v2/catalog/batch-upsert", {
    idempotency_key: `mig-${l.id}-${Date.now()}`,
    batches: [{ objects: [{
      type: "ITEM", id: itemId, ...(version ? { version } : {}), present_at_all_locations: true,
      custom_attribute_values: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v).map(([k, v]) => [k, { name: k, type: "STRING", string_value: String(v) }])),
      item_data: {
        name: l.name, description: l.description ?? l.tastingNotes ?? undefined, product_type: "REGULAR", is_taxable: false,
        categories: [{ id: cat.id }],
        variations: variants.map((v) => {
          const keep = version && v.squareVariationId && varVersions.has(v.squareVariationId) ? v.squareVariationId : null;
          return { type: "ITEM_VARIATION", id: keep ?? `#v-${v.id}`, ...(keep ? { version: varVersions.get(keep) } : {}), present_at_all_locations: true,
            item_variation_data: { item_id: itemId, name: v.label, sku: v.id, pricing_type: "FIXED_PRICING",
              price_money: { amount: v.priceCents, currency: "USD" }, track_inventory: true } };
        }),
      },
    }] }],
  });
  const saved = result.objects.find((o) => o.type === "ITEM");
  const bySku = new Map(saved.item_data.variations.map((v) => [v.item_variation_data.sku, v.id]));

  await db.batch([
    { sql: "update BeanListing set squareItemId=? where id=?", args: [saved.id, l.id] },
    ...variants.map((v) => ({ sql: "update ListingVariant set squareVariationId=? where id=?", args: [bySku.get(v.id), v.id] })),
  ], "write");

  if (l.photoUrl && imageIds.length === 0) {
    const img = await fetch(l.photoUrl);
    const type = img.headers.get("content-type") ?? "image/jpeg";
    await upload("/v2/catalog/images", { idempotency_key: `img-${l.id}`, object_id: saved.id, image: { type: "IMAGE", id: "#img", image_data: { caption: l.name } } },
      { bytes: await img.arrayBuffer(), type, name: `${l.slug}.${type.split("/")[1] ?? "jpg"}` });
    console.log("  photo uploaded");
  }

  for (const v of variants) {
    const n = counts.get(`${l.slug}:${v.label}`);
    if (n === undefined) continue;
    await call("POST", "/v2/inventory/changes/batch-create", { idempotency_key: `cnt-${v.id}-${Date.now()}`,
      changes: [{ type: "PHYSICAL_COUNT", physical_count: { catalog_object_id: bySku.get(v.id), state: "IN_STOCK", location_id: locationId, quantity: String(n), occurred_at: new Date().toISOString() } }] });
    console.log(`  ${v.label}: count set to ${n}`);
  }
  console.log(`${l.name}: ${l.isListed ? "listed" : "NOT listed in DB"} -> Square item ${saved.id}`);
}

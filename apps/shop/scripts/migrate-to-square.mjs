// Copies each coffee's website content from our database into Square, and sets
// each coffee up so its bag sizes share ONE pool of coffee measured in ounces:
//   - a hidden "stockable" variation holds the pool ("Coffee in stock (oz)"),
//   - each bag size is a sellable variation that converts from it (a 12 oz bag
//     takes 12 from the pool), whether it sells on the website or at the register.
// Square allows only one sold size per unit type per item, so each size gets its
// own custom unit ("12 oz bag"). Re-runnable; existing pools are never reset.
//   node --env-file=.env.local scripts/migrate-to-square.mjs [--oz "slug=320,slug2=96"]
//   --oz sets the pool (in ounces) for a coffee; 20 lb = 320 oz.
import { createClient } from "@libsql/client";
import { call, upload, locationId, SHOP_CATEGORY } from "./square-lib.mjs";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const rows = async (sql) => (await db.execute(sql)).rows.map((r) => ({ ...r }));

const ozArg = process.argv.indexOf("--oz");
const pools = new Map();
if (ozArg > -1) for (const part of process.argv[ozArg + 1].split(",")) { const [k, n] = part.split("="); pools.set(k.trim(), Number(n)); }

const POOL_NAME = "Coffee in stock (oz)";
const ozOf = (grams) => Math.max(1, Math.round(grams / 28.3495));

const cat = (await call("POST", "/v2/catalog/search", { object_types: ["CATEGORY"] })).objects?.find((o) => o.category_data?.name === SHOP_CATEGORY);
if (!cat) throw new Error('Run square-setup.mjs first (no "Shop" category).');

// One custom unit per bag size, shared by every coffee ("4 oz bag", "12 oz bag", ...).
const unitIds = new Map();
const existingUnits = (await call("POST", "/v2/catalog/search", { object_types: ["MEASUREMENT_UNIT"] })).objects ?? [];
for (const u of existingUnits) { const n = u.measurement_unit_data?.measurement_unit?.custom_unit?.name; if (n) unitIds.set(n, u.id); }
async function unitFor(oz) {
  const name = `${oz} oz bag`;
  if (!unitIds.has(name)) {
    const r = await call("POST", "/v2/catalog/object", { idempotency_key: `unit-${oz}-${Date.now()}`, object: { type: "MEASUREMENT_UNIT", id: `#u${oz}`,
      measurement_unit_data: { measurement_unit: { type: "TYPE_CUSTOM", custom_unit: { name, abbreviation: `${oz}oz` } }, precision: 0 } } });
    unitIds.set(name, r.catalog_object.id);
  }
  return unitIds.get(name);
}

const listings = await rows(`select l.id, l.slug, l.isListed, l.headline, l.description, l.roastStyle, l.brewNotes, l.allowBackorder, l.squareItemId,
  b.name, b.origin, b.producer, b.process, b.variety, b.photoUrl, b.tastingNotes
  from BeanListing l join Bean b on b.id = l.beanId order by l.sortOrder, l.createdAt`);

for (const l of listings) {
  const variants = await rows(`select id, label, grams, priceCents from ListingVariant where listingId='${l.id}' and active=1 order by sortOrder`);
  const attrs = { cybar_headline: l.headline, cybar_origin: l.origin, cybar_producer: l.producer, cybar_process: l.process,
    cybar_variety: l.variety, cybar_roast_style: l.roastStyle, cybar_brew_notes: l.brewNotes, cybar_backorder: l.allowBackorder ? "yes" : "no" };
  const customAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v).map(([k, v]) => [k, { name: k, type: "STRING", string_value: String(v) }]));

  // Existing item: reuse its pool and any size that already converts; otherwise build fresh.
  let existing = null;
  if (l.squareItemId) { try { const o = (await call("GET", `/v2/catalog/object/${l.squareItemId}`)).object; if (o && !o.is_deleted) existing = o; } catch { /* gone */ } }
  const exVars = existing?.item_data?.variations ?? [];
  const keptRef = existing?.custom_attribute_values?.cybar_stock_ref;
  const newOz = pools.get(l.slug);
  if (newOz !== undefined) customAttrs.cybar_stock_ref = { name: "cybar_stock_ref", type: "STRING", string_value: String(newOz) };
  else if (keptRef) customAttrs.cybar_stock_ref = keptRef;
  const poolVar = exVars.find((v) => v.item_variation_data?.stockable === true && v.item_variation_data?.sellable === false);
  const imageIds = existing?.item_data?.image_ids ?? [];

  async function buildAndSave(reuse) {
    const itemId = reuse && existing ? existing.id : `#coffee-${l.id}`;
    const poolId = reuse && poolVar ? poolVar.id : "#pool";
    const sizeVars = [];
    for (const v of variants) {
      const oz = ozOf(v.grams);
      const keep = reuse ? exVars.find((x) => x.item_variation_data?.sku === v.id && x.item_variation_data?.stockable_conversion) : null;
      sizeVars.push({ type: "ITEM_VARIATION", id: keep ? keep.id : `#s-${v.id}`, ...(keep ? { version: keep.version } : {}), present_at_all_locations: true,
        item_variation_data: { item_id: itemId, name: v.label, sku: v.id, pricing_type: "FIXED_PRICING", price_money: { amount: v.priceCents, currency: "USD" },
          track_inventory: true, sellable: true, stockable: false, measurement_unit_id: await unitFor(oz),
          stockable_conversion: { stockable_item_variation_id: poolId, stockable_quantity: String(oz), nonstockable_quantity: "1" } } });
    }
    const pool = { type: "ITEM_VARIATION", id: poolId, ...(reuse && poolVar ? { version: poolVar.version } : {}), present_at_all_locations: true,
      item_variation_data: { item_id: itemId, name: POOL_NAME, pricing_type: "VARIABLE_PRICING", track_inventory: true, sellable: false, stockable: true } };
    const r = await call("POST", "/v2/catalog/batch-upsert", { idempotency_key: `mig-${l.id}-${Date.now()}`, batches: [{ objects: [{
      type: "ITEM", id: itemId, ...(reuse && existing ? { version: existing.version } : {}), present_at_all_locations: true, custom_attribute_values: customAttrs,
      item_data: { name: l.name, description: l.description ?? l.tastingNotes ?? undefined, product_type: "REGULAR", is_taxable: false, categories: [{ id: cat.id }],
        variations: [pool, ...sizeVars] } }] }] });
    return r.objects.find((o) => o.type === "ITEM");
  }

  let saved;
  try {
    saved = await buildAndSave(true);
  } catch (err) {
    if (!existing) throw err;
    // Square won't convert existing sizes in place: rebuild this one item from scratch.
    console.log(`  rebuilding ${l.name} (${String(err.message).slice(0, 90)}...)`);
    await call("POST", "/v2/catalog/batch-delete", { object_ids: [existing.id] });
    existing = null; imageIds.length = 0;
    saved = await buildAndSave(false);
  }
  const vars = saved.item_data.variations;
  const bySku = new Map(vars.filter((v) => v.item_variation_data.sku).map((v) => [v.item_variation_data.sku, v.id]));
  const poolId = vars.find((v) => v.item_variation_data.stockable === true && v.item_variation_data.sellable === false).id;

  await db.batch([
    { sql: "update BeanListing set squareItemId=? where id=?", args: [saved.id, l.id] },
    ...variants.map((v) => ({ sql: "update ListingVariant set squareVariationId=? where id=?", args: [bySku.get(v.id), v.id] })),
  ], "write");

  if (l.photoUrl && imageIds.length === 0) {
    const img = await fetch(l.photoUrl); const type = img.headers.get("content-type") ?? "image/jpeg";
    await upload("/v2/catalog/images", { idempotency_key: `img-${l.id}`, object_id: saved.id, image: { type: "IMAGE", id: "#img", image_data: { caption: l.name } } },
      { bytes: await img.arrayBuffer(), type, name: `${l.slug}.${type.split("/")[1] ?? "jpg"}` });
    console.log("  photo uploaded");
  }
  const oz = pools.get(l.slug);
  if (oz !== undefined) {
    await call("POST", "/v2/inventory/changes/batch-create", { idempotency_key: `pool-${l.id}-${Date.now()}`,
      changes: [{ type: "PHYSICAL_COUNT", physical_count: { catalog_object_id: poolId, state: "IN_STOCK", location_id: locationId, quantity: String(oz), occurred_at: new Date().toISOString() } }] });
    console.log(`  pool set to ${oz} oz`);
  }
  console.log(`${l.name}: ${l.isListed ? "listed" : "NOT listed in DB"} -> Square item ${saved.id}`);
}

// One-time (re-runnable) Square setup for the shop: the custom fields a coffee
// carries on the website, and the "Roasted Coffee" category that marks which items are
// listed. Idempotent: anything that exists is left alone.
import { call, FIELDS, SHOP_CATEGORY } from "./square-lib.mjs";

const existing = await call("POST", "/v2/catalog/search", { object_types: ["CUSTOM_ATTRIBUTE_DEFINITION", "CATEGORY"] });
const defs = (existing.objects ?? []).filter((o) => o.type === "CUSTOM_ATTRIBUTE_DEFINITION");
const wanted = new Set(FIELDS.map((f) => f.key));
for (const d of defs) {
  const key = d.custom_attribute_definition_data.key;
  if (key.startsWith("cybar_") && !wanted.has(key)) {
    await call("DELETE", `/v2/catalog/object/${d.id}`);
    console.log("removed", key);
  }
}
const have = new Set((existing.objects ?? []).filter((o) => o.type === "CUSTOM_ATTRIBUTE_DEFINITION").map((o) => o.custom_attribute_definition_data.key));
const legacy = (existing.objects ?? []).find((o) => o.type === "CATEGORY" && o.category_data?.name === "Shop");
if (legacy && !(existing.objects ?? []).some((o) => o.type === "CATEGORY" && o.category_data?.name === SHOP_CATEGORY)) {
  await call("POST", "/v2/catalog/object", { idempotency_key: `rename-${Date.now()}`, object: { ...legacy, category_data: { ...legacy.category_data, name: SHOP_CATEGORY } } });
  legacy.category_data.name = SHOP_CATEGORY;
  console.log(`renamed category "Shop" -> "${SHOP_CATEGORY}"`);
}
let category = (existing.objects ?? []).find((o) => o.type === "CATEGORY" && o.category_data?.name === SHOP_CATEGORY);

for (const f of FIELDS) {
  if (have.has(f.key)) { console.log("exists ", f.key); continue; }
  await call("POST", "/v2/catalog/object", {
    idempotency_key: `def-${f.key}-${Date.now()}`,
    object: {
      type: "CUSTOM_ATTRIBUTE_DEFINITION",
      id: `#def-${f.key}`,
      custom_attribute_definition_data: {
        type: "STRING",
        name: f.name,
        key: f.key,
        allowed_object_types: ["ITEM"],
        seller_visibility: "SELLER_VISIBILITY_READ_WRITE_VALUES",
        app_visibility: "APP_VISIBILITY_READ_WRITE_VALUES",
      },
    },
  });
  console.log("created", f.key);
}
if (!category) {
  const r = await call("POST", "/v2/catalog/object", {
    idempotency_key: `cat-${Date.now()}`,
    object: { type: "CATEGORY", id: "#shop", category_data: { name: SHOP_CATEGORY } },
  });
  category = r.catalog_object;
  console.log(`created category "${SHOP_CATEGORY}"`);
} else console.log(`exists  category "${SHOP_CATEGORY}"`);
console.log("category id:", category.id);

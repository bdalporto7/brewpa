// Tiny Square REST helper shared by the setup/migration scripts. Run them with
//   node --env-file=.env.local scripts/<script>.mjs
// (sandbox until SQUARE_ENVIRONMENT=production).
const production = process.env.SQUARE_ENVIRONMENT === "production";
export const base = production ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
export const locationId = process.env.SQUARE_LOCATION_ID;
const headers = { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2025-10-16" };

export async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.errors) throw new Error(`${method} ${path}: ${JSON.stringify(json.errors)}`);
  return json;
}

export async function upload(path, fields, file) {
  const fd = new FormData();
  fd.append("request", new Blob([JSON.stringify(fields)], { type: "application/json" }));
  fd.append("image_file", new Blob([file.bytes], { type: file.type }), file.name);
  const res = await fetch(base + path, { method: "POST", headers, body: fd });
  const json = await res.json();
  if (json.errors) throw new Error(`upload ${path}: ${JSON.stringify(json.errors)}`);
  return json;
}

export const SHOP_CATEGORY = "Roasted Coffee";

/**
 * The fields a coffee carries on the website, as Square custom attributes.
 * Square allows an app only 10 read/write custom fields, so keep this short.
 */
export const FIELDS = [
  ["headline", "Headline"],
  ["origin", "Origin"],
  ["producer", "Producer"],
  ["process", "Process"],
  ["variety", "Variety"],
  ["roast_style", "Roast style"],
  ["brew_notes", "Brew notes"],
  ["roasted_on", "Roasted on (YYYY-MM-DD)"],
  ["backorder", "Keep selling when out of stock (yes/no)"],
  ["stock_ref", "Full stock level (oz)"],
].map(([key, name]) => ({ key: `cybar_${key}`, name }));

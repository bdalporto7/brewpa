# Cybar Coffee shop (apps/shop)

The public storefront: a separate Next.js app (own Vercel project, `cybar-shop`,
Root Directory `apps/shop`) that reads the **same Turso database** as
`apps/roasting`. The roasting app owns the schema and migrations; this app
copies the schema at install time (`scripts/sync-schema.mjs`, run by
`postinstall`) and never migrates anything itself.

## What the team controls (from the roasting app)

- `/shop` in the roasting app: which coffees are listed and their order, plus
  site settings (announcement, homepage and About copy, pickup/local text,
  notice days, shipping price and free-shipping threshold).
- Each bean's page has an "Online shop" card for that coffee's headline,
  description, roast style, bag sizes and prices.
- `/shop/orders` in the roasting app: paid online orders, what needs roasting,
  and Paid → Ready → Fulfilled.

## How an order flows

1. `src/lib/checkout.ts` re-prices the bag from the database (never trusts the
   browser) and checks stock per bean across the whole bag.
2. `src/app/cart/actions.ts` creates a `ShopOrder` (PENDING) and a Square
   payment link with one fulfillment (PICKUP or SHIPMENT). Shipping is charged
   from the same settings the site displays. Order line items are ad hoc
   (name + price), not Square catalog items.
3. The customer pays on Square's page and returns to `/order/[ref]`.
4. Square calls `/api/square/webhook` (`payment.updated`). The signature is
   verified against the raw body; each event id is stored so repeats are
   no-ops. `src/lib/allocate.ts` then marks the order PAID and takes stock out
   in one transaction: roasted grams first (oldest roast first, recorded as
   `Sale` rows tied to the order), the rest from green stock at the bean's
   historical roast yield. If stock ran out in between, the order is still
   PAID but flagged NEEDS_ATTENTION.

Stock math (`src/lib/shop-stock.ts`) is a copy of the one in `apps/roasting`;
keep them in sync.

## Environment

See `.env.example`. Square credentials are secrets: set them with
`vercel env add` (Production and Preview) and in `.env.local`, never in git.
Sandbox until `SQUARE_ENVIRONMENT=production`. The webhook URL registered in
Square must match `SHOP_BASE_URL` + `/api/square/webhook` exactly (or set
`SQUARE_WEBHOOK_URL`). Env changes only take effect on a new deployment.

## Square as the source of truth (`SHOP_SOURCE=square`)

With `SHOP_SOURCE=square` the shop stops reading coffees from our database:
coffees are Square catalog items in the **"Shop"** category, bag sizes are their
variations (inventory tracking on), bag counts come from Square's inventory,
and details (headline, origin, producer, process, variety, roast style, brew
notes, roasted-on, "keep selling when out of stock") are Square custom fields.
`scripts/square-setup.mjs` creates the fields and category;
`scripts/migrate-to-square.mjs` copies coffees (and optionally starting counts)
from our database. Both run with `node --env-file=.env.local scripts/<name>.mjs`,
are re-runnable, and target the sandbox until `SQUARE_ENVIRONMENT=production`.
Square allows an app only 10 custom fields, so there are 9. URLs come from the
coffee name; order is availability then name.

Checkout then builds the Square order from real catalog items, and **Square
itself subtracts the bags when the order is paid** (verified in the sandbox for
payment links and for register/API orders; it lags a few seconds). Our webhook
therefore only marks the order PAID and must never also draw stock: order items
with a `squareVariationId` are skipped by `allocate.ts`, and register-sale
handling is off while `SHOP_SOURCE=square`. A cart can't exceed the bags on
hand unless the coffee allows backorders; a negative Square count is bags owed.
`ShopOrderItem.beanId` is optional for this reason. The database path
(grams, roast sessions, backorder grams) still exists for `SHOP_SOURCE` unset
and is slated for removal after the cutover.

## Roast backlog

A roast-to-order bag sets its green coffee aside at payment (`gramsToRoast` on
the order item) so the shop can't oversell it. `/shop/orders` in the roasting
app lists that as the roast backlog (per coffee: orders waiting, roasted grams,
green to load, earliest due date), and the dashboard shows a banner while any
exist. Roast the coffee normally and log its roasted weight; then **Mark ready**
on the order (`src/lib/shop-fulfilment.ts` in roasting) gives the set-aside green
back and takes the same grams out of the new roasted stock as `Sale` rows on the
order. It refuses, saying how much is missing, if that roasted weight isn't in
stock yet. Without this handoff, roasting the coffee normally would take the
green twice.

## Pop-up (register) sales

`apps/roasting` copies each listed coffee into Square's catalog (one item, one
variation per bag size, SKU = our `ListingVariant.id`) every time a listing is
saved, and from the "Sync to Square register" button on its `/shop` page
(`src/lib/square-sync.ts` there). Unlisting a coffee removes it from Square.
When a register payment completes, the webhook sees an order that isn't one of
ours, fetches it from Square, and takes the matching grams out of roasted
stock (oldest roast first, recorded as `Sale` rows). Register sales never
roast to order, and non-coffee lines (drinks, merch) are ignored. The roasting
project therefore also needs `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT` and
`SQUARE_LOCATION_ID`.

## Not built yet

- Refunds putting coffee back in stock (`refund.created`).
- Cancelling a paid order from the roasting app.

## Commands

```bash
npm run dev    # localhost:3001
npm run build
npx tsc --noEmit
npm run lint
```

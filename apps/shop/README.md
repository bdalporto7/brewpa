# Cybar Coffee shop (apps/shop)

The public storefront: a separate Next.js app (own Vercel project, `cybar-shop`,
Root Directory `apps/shop`) that reads the **same Turso database** as
`apps/roasting`. The roasting app owns the schema and migrations; this app
copies the schema at install time (`scripts/sync-schema.mjs`, run by
`postinstall`) and never migrates anything itself.

## Shop admin (`/admin`, in this app)

Sign in with Google or GitHub; only emails on the `AllowedUser` list (the same
table the roasting app manages) get a session (`src/auth.ts`, `src/lib/admin.ts`;
every admin Server Action re-checks `requireAdmin()`). **Orders**
(`/admin/orders`): paid orders grouped New / Ready / Completed / Needs
attention, with the shipping address (read back from Square when the order is
paid, with a retry when the page opens), and Mark ready / picked up / shipped.
Forward moves are mirrored to Square's fulfillment state
(`src/lib/square-fulfillment.ts`: PROPOSED → RESERVED → PREPARED → COMPLETED);
"move back" isn't mirrored because Square can't reopen a completed fulfillment.
**Coffees** (`/admin/coffees`): "Add a coffee" (name, description, bag sizes and prices from the five presets, optional starting pool; creates the pooled structure in Square via `createCoffee`) and "Remove" (permanent delete from Square, with a confirm), plus every coffee in Square with show/hide (adds or
removes the "Roasted Coffee" category), per-size bag counts (add packed bags, or recount;
a negative count shows as "N owed"), and the details form (description, headline,
origin, producer, process, variety, roast style, roasted-on, brew notes, and the
backorder switch), all written straight to Square (`src/lib/square-admin.ts`,
a retrieve → change → upsert of the whole item so bag sizes are never dropped).
Photos: a coffee's first Square image is what the site shows; the admin's photo uploader shrinks the picture in the browser and saves it to Square as the main photo (`uploadCoffeePhoto`), so adding one in either place shows up in both. Square-hosted image URLs must be allowed in `next.config.ts` (`items-images-production.s3.us-west-2.amazonaws.com` is an assumption until verified with a real production upload). Prices and sizes are still edited in Square itself. **Site text** (`/admin/settings`): announcement, homepage, About, pickup notice
and shipping terms (`ShopSettings`). OAuth callback URLs
`https://<shop domain>/api/auth/callback/github` and `/google` must be added to
the existing OAuth apps. For local work set `SHOP_DEV_LOGIN=1` to get a
development-only test login (never present in production builds).
Square's sandbox payment simulation doesn't collect a shipping address, so that
path is covered by a unit-style check of the parser, not an end-to-end run.

## Legal pages

`/privacy`, `/terms` and `/returns` are linked from the footer and the checkout
button. **They are drafts written to match what the site does (no analytics or
ad cookies; cart in browser storage; payments on Square) and have not been
reviewed by a lawyer.** Policy choices in them (7-day problem window, no
cancellation once roasted, California governing law) are the owner's to confirm.
`SHOP_CONTACT_EMAIL` sets the contact address shown; without it they point to
Instagram. If analytics or other trackers are added, add a consent banner and
update `/privacy`.

## What the team controls

Everything is done in this app's `/admin` (above) and in Square itself. The
roasting app has no shop UI any more — its Shop tab, per-bean "Online shop" card,
Square sync, order fulfilment page and dashboard backlog banner were removed
(2026-10) once the live site moved to Square as the source of truth. It still
owns the database schema, including the shop tables this app uses.

Consequence: the older database-backed listings (`BeanListing` / `ListingVariant`,
used when `SHOP_SOURCE` is not `square`) can no longer be created or edited
anywhere, so that mode is effectively retired; its code in this app is a candidate
for removal.

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

## Environment

See `.env.example`. Square credentials are secrets: set them with
`vercel env add` (Production and Preview) and in `.env.local`, never in git.
Sandbox until `SQUARE_ENVIRONMENT=production`. The webhook URL registered in
Square must match `SHOP_BASE_URL` + `/api/square/webhook` exactly (or set
`SQUARE_WEBHOOK_URL`). Env changes only take effect on a new deployment.

## Square as the source of truth (`SHOP_SOURCE=square`)

With `SHOP_SOURCE=square` the shop stops reading coffees from our database:
coffees are Square catalog items in the **"Roasted Coffee"** category, bag sizes are their
variations, stock is **one pool of coffee in ounces per coffee** (see below),
and details (headline, origin, producer, process, variety, roast style, brew
notes, roasted-on, backorder switch, full stock level) are Square custom fields.
`scripts/square-setup.mjs` creates the fields and category;
`scripts/migrate-to-square.mjs` copies coffees (and optionally starting counts)
from our database. Both run with `node --env-file=.env.local scripts/<name>.mjs`,
are re-runnable, and target the sandbox until `SQUARE_ENVIRONMENT=production`.
Square allows an app only 10 custom fields, and all 10 are in use. URLs come from the
coffee name; order is availability then name.

**Pooled stock** uses Square's stock conversion: each coffee has a hidden
stockable variation "Coffee in stock (oz)" holding the pool, and every bag size
is a sellable variation converting from it (a 12 oz bag takes 12 from the pool).
Square allows only one sold size per unit type per item, so each size has its own
custom unit ("12 oz bag"). The shop computes bags per size as floor(pool / oz per
bag) and checks a cart's sizes together against the pool
(`src/lib/checkout.ts`). In the admin, stock is entered in pounds and ounces
(`src/lib/pool-format.ts`). **Backorders are off**: a sold-out coffee can't be
ordered. The code is kept behind `SHOP_BACKORDERS=1` (the `cybar_backorder` field
is ignored otherwise). **Low stock**: each coffee records a full stock level
(`cybar_stock_ref`, ounces): a recount resets it, and adding coffee raises it if the
new total is higher. The site shows a "Low stock" badge at 10% or less of it.
Register sales can still push a pool below zero; the admin shows "short by".

Checkout then builds the Square order from real catalog items, and **Square
itself subtracts the ounces when the order is paid** (verified in the sandbox for
payment links and for register/API orders; it lags a few seconds). Our webhook
therefore only marks the order PAID and must never also draw stock: order items
with a `squareVariationId` are skipped by `allocate.ts`, and register-sale
handling is off while `SHOP_SOURCE=square`. A cart can't exceed the bags on
hand unless the coffee allows backorders; a negative Square count is bags owed.
`ShopOrderItem.beanId` is optional for this reason. The database path
(grams, roast sessions, backorder grams) still exists for `SHOP_SOURCE` unset
and is slated for removal after the cutover.

### Production setup (done 2026-10-05)

Run against the real Square account with
`node --env-file=.env.local --env-file=.env.live scripts/<script>.mjs`
(`.env.live` holds the production Square values and is gitignored): `square-setup.mjs`
(custom fields + the "Roasted Coffee" category, which is what marks a coffee as shown on the site and is also its section on the register) then `migrate-to-square.mjs --hidden` (creates the
coffees hidden, stock 0). In production the migration matches coffees **by name**
and never writes Square ids back to our database (those ids are the sandbox's).
The admin only lists coffees this shop manages (a pool variation, or in the Shop
category) and refuses to edit or remove anything else, because the real account also
holds the cafe menu and wholesale items. Going live = copy the `.env.live` values to
Vercel (replacing the sandbox ones), set `SHOP_SOURCE=square`, redeploy, add stock,
and show the coffees.

## Roast backlog and pop-up sales (removed)

These were the roasting-app halves of the gram-based model: a roast-to-order
backlog page with a "Mark ready" handoff (`shop-fulfilment.ts`), and a mirror of
each listing into Square's catalog for register sales (`square-sync.ts`). Both are
gone with the roasting app's shop code. In Square mode, Square holds the stock and
subtracts it itself for online and register sales alike (see "Square as the source
of truth"), orders are handled in this app's `/admin/orders`, and the roasting
project no longer needs `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT` or
`SQUARE_LOCATION_ID` (they can be removed from its Vercel environment).

## Not built yet

- Refunds putting coffee back in stock (`refund.created`).
- Cancelling a paid order from an admin.
- Customer accounts / order lookup (guest checkout only today).

## Commands

```bash
npm run dev    # localhost:3001
npm run build
npx tsc --noEmit
npm run lint
```

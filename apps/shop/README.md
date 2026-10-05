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

## Not built yet

- Pop-up (in-person) Square sales drawing down stock: needs the coffee bags as
  Square catalog items, then handling non-online payments in the webhook.
- Refunds putting coffee back in stock (`refund.created`).
- Cancelling a paid order from the roasting app.

## Commands

```bash
npm run dev    # localhost:3001
npm run build
npx tsc --noEmit
npm run lint
```

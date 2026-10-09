/**
 * Client-safe connector surface — the only inventory-connector module that
 * client components may import. Everything here is free of server-only
 * modules (Prisma, next/headers, AI SDKs, node builtins), so bundling it
 * for the browser can never crash page hydration.
 *
 * Rule: "use client" components import from "@/lib/inventory-connector/client"
 * (values) or "@/lib/inventory-connector/actions" (server actions, which
 * Next.js turns into RPC stubs). They must NEVER import from
 * "@/lib/inventory-connector/queries" — that module instantiates Prisma at
 * import time, which throws in the browser and takes the whole page down.
 * queries.ts re-exports the shared bits below so server code has one
 * import site.
 */

export { ROAST_LEVELS } from "@/lib/constants";
export { formatCurrency } from "@/lib/format";

export const INVENTORY_WIDGETS = [
  { key: "stats", label: "Totals" },
  { key: "alerts", label: "Needs attention" },
  { key: "lots", label: "Your lots" },
  { key: "roasts", label: "Recent roasts" },
  { key: "plan", label: "This month's plan" },
  { key: "costs", label: "Inventory value" },
] as const;

export type InventoryWidgetKey = (typeof INVENTORY_WIDGETS)[number]["key"];

import "server-only";
import { SquareClient, SquareEnvironment } from "square";

/**
 * Square client for checkout. Sandbox until SQUARE_ENVIRONMENT=production.
 * Our database is the inventory system of record; Square only takes payment.
 */
export function squareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN must be set.");
  return new SquareClient({
    token,
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
}

export function squareLocationId(): string {
  const id = process.env.SQUARE_LOCATION_ID;
  if (!id) throw new Error("SQUARE_LOCATION_ID must be set.");
  return id;
}

export function shopBaseUrl(): string {
  return (process.env.SHOP_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/**
 * The exact URL registered in Square's webhook subscription — signatures cover it.
 * Built from the path that was actually called, so the sandbox subscription
 * (/api/square/webhook) and the production one (/api/square/webhook/prod) each
 * verify against their own URL. SQUARE_WEBHOOK_URL overrides it for one-off setups.
 */
export function webhookUrl(pathname = "/api/square/webhook"): string {
  return process.env.SQUARE_WEBHOOK_URL ?? `${shopBaseUrl()}${pathname}`;
}

/** Plain REST call to Square (used where the SDK's paging types get in the way). */
export async function squareFetch<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN must be set.");
  const host = process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const res = await fetch(host + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Square-Version": "2025-10-16", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { errors?: unknown };
  if (!res.ok || json.errors) throw new Error(`Square ${method} ${path} failed: ${JSON.stringify(json.errors ?? res.status)}`);
  return json;
}

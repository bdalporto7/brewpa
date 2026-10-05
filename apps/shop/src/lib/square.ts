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

/** The exact URL registered in Square's webhook subscription — signatures cover it. */
export function webhookUrl(): string {
  return process.env.SQUARE_WEBHOOK_URL ?? `${shopBaseUrl()}/api/square/webhook`;
}

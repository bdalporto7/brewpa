import { reconcilePendingOrders } from "@/lib/order-sync";

export const dynamic = "force-dynamic";

/**
 * Daily safety net (Vercel Cron): settles paid orders whose Square notification
 * never arrived and cancels checkouts abandoned for days. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await reconcilePendingOrders());
}

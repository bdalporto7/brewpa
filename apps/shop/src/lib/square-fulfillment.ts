import "server-only";
import { squareFetch, squareLocationId } from "@/lib/square";

/**
 * Keeps the order's fulfillment status in Square in step with ours, so Square's
 * dashboard and reports show it as prepared and then completed (picked up or
 * shipped). Square only moves forward through PROPOSED → RESERVED → PREPARED →
 * COMPLETED, one step per update, so we walk it. Going "back a step" in our
 * admin isn't mirrored: a completed Square fulfillment can't be reopened.
 */
const ORDER = ["PROPOSED", "RESERVED", "PREPARED", "COMPLETED"] as const;
type State = (typeof ORDER)[number];

interface SqOrderRes {
  order?: { version?: number; fulfillments?: { uid?: string; state?: string }[] };
}

export async function syncFulfillmentToSquare(squareOrderId: string, status: "READY" | "FULFILLED"): Promise<void> {
  const target: State = status === "READY" ? "PREPARED" : "COMPLETED";
  const current = await squareFetch<SqOrderRes>("GET", `/v2/orders/${squareOrderId}`);
  const f = current.order?.fulfillments?.[0];
  if (!f?.uid) return; // nothing to update
  let state = f.state as State;
  let version = current.order!.version!;
  if (!ORDER.includes(state)) return; // e.g. CANCELED or FAILED: leave it alone
  while (ORDER.indexOf(state) < ORDER.indexOf(target)) {
    const next = ORDER[ORDER.indexOf(state) + 1];
    const res = await squareFetch<SqOrderRes>("PUT", `/v2/orders/${squareOrderId}`, {
      idempotency_key: `${squareOrderId}-${next}-${version}`,
      order: { location_id: squareLocationId(), version, fulfillments: [{ uid: f.uid, state: next }] },
    });
    state = next;
    version = res.order?.version ?? version + 1;
  }
}

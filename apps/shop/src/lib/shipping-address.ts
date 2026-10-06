import "server-only";
import { prisma } from "@/lib/prisma";
import { squareFetch } from "@/lib/square";

interface SqAddress {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  administrative_district_level_1?: string;
  postal_code?: string;
  country?: string;
}

export interface ShippingAddress {
  name: string | null;
  phone: string | null;
  lines: string[];
}

interface SqOrder {
  fulfillments?: { type?: string; shipment_details?: { recipient?: { display_name?: string; phone_number?: string; address?: SqAddress } } }[];
}

/** Pure: pulls the shipping recipient and address out of a Square order, or null if none was given. */
export function addressFromSquareOrder(order: SqOrder | undefined): ShippingAddress | null {
  const recipient = order?.fulfillments?.find((f) => f.type === "SHIPMENT")?.shipment_details?.recipient;
  const a = recipient?.address;
  if (!a?.address_line_1) return null;
  return {
    name: recipient?.display_name ?? null,
    phone: recipient?.phone_number ?? null,
    lines: [
      a.address_line_1,
      a.address_line_2,
      [a.locality, [a.administrative_district_level_1, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      a.country && a.country !== "US" ? a.country : undefined,
    ].filter((x): x is string => Boolean(x)),
  };
}

/**
 * Square collects the shipping address on its checkout page, so we read it back
 * from the paid order and keep it with ours — the roaster shouldn't have to dig
 * through Square to find where a bag goes. Best-effort: a failure leaves it
 * unset and the admin page tries again when the order is opened.
 */
export async function captureShippingAddress(orderId: string, squareOrderId: string): Promise<ShippingAddress | null> {
  const res = await squareFetch<{ order?: SqOrder }>("GET", `/v2/orders/${squareOrderId}`);
  const parsed = addressFromSquareOrder(res.order);
  if (!parsed) return null;
  await prisma.shopOrder.update({ where: { id: orderId }, data: { shippingAddress: JSON.stringify(parsed) } });
  return parsed;
}

export function parseShippingAddress(json: string | null): ShippingAddress | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ShippingAddress;
  } catch {
    return null;
  }
}

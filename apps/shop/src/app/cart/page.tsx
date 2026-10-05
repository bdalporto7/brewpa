import type { Metadata } from "next";
import CartView from "@/components/CartView";
import { earliestPickupDate } from "@/lib/checkout";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Your bag" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const s = await getSiteSettings();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <h1 className="text-5xl font-extrabold tracking-tight">Your bag</h1>
      <CartView
        settings={{
          noticeDays: s.noticeDays,
          shippingFlatCents: s.shippingFlatCents,
          freeShippingOverCents: s.freeShippingOverCents,
          localSummary: s.localSummary,
        }}
        earliestPickup={earliestPickupDate(s.noticeDays)}
      />
    </div>
  );
}

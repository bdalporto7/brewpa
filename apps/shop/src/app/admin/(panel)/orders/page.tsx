import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";
import { formatCents } from "@/lib/shop-stock";
import { captureShippingAddress, parseShippingAddress, type ShippingAddress } from "@/lib/shipping-address";
import OrderActions from "@/components/OrderActions";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", ...opts });

export default async function OrdersPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  const orders = await prisma.shopOrder.findMany({
    where: { teamId: user.teamId, status: { in: ["NEEDS_ATTENTION", "PAID", "READY", "FULFILLED"] } },
    include: { items: true },
    orderBy: { paidAt: "desc" },
    take: 100,
  });

  // The address is saved when payment arrives; if that read failed, try again now.
  const addresses = new Map<string, ShippingAddress | null>();
  for (const o of orders) {
    let a = parseShippingAddress(o.shippingAddress);
    if (!a && o.fulfillment === "SHIPMENT" && o.squareOrderId) {
      a = await captureShippingAddress(o.id, o.squareOrderId).catch(() => null);
    }
    addresses.set(o.id, a);
  }

  const groups: { title: string; hint?: string; list: typeof orders }[] = [
    { title: "Needs attention", list: orders.filter((o) => o.status === "NEEDS_ATTENTION") },
    { title: "New orders", hint: "Paid, waiting for you to pack them.", list: orders.filter((o) => o.status === "PAID") },
    { title: "Ready", hint: "Packed and waiting for pickup, delivery or the post.", list: orders.filter((o) => o.status === "READY") },
    { title: "Completed", list: orders.filter((o) => o.status === "FULFILLED").slice(0, 20) },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Orders</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Paid orders from the shop. Square takes the bags out of stock when an order is paid, so this page is for
          packing and handing them over.
        </p>
      </div>

      {orders.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
          <p className="text-lg font-bold">No paid orders yet.</p>
          <p className="mt-1 text-muted">New orders show up here as soon as they&apos;re paid.</p>
        </div>
      )}

      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <section key={g.title}>
              <h2 className="text-2xl font-extrabold tracking-tight">{g.title}</h2>
              {g.hint && <p className="mt-1 text-sm text-muted">{g.hint}</p>}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {g.list.map((o) => {
                  const addr = addresses.get(o.id);
                  return (
                    <article key={o.id} className="rounded-lg border-2 border-[var(--border-strong)] bg-surface p-4 shadow-[3px_3px_0_var(--shadow-ink)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm text-muted">
                            {o.publicRef}
                            {o.paidAt ? ` · ${dateFmt(o.paidAt, { month: "short", day: "numeric" })}` : ""}
                          </p>
                          <p className="text-lg font-bold">{o.customerName}</p>
                          <p className="text-sm text-muted">
                            <a href={`mailto:${o.customerEmail}`} className="underline underline-offset-4">{o.customerEmail}</a>
                            {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                          </p>
                        </div>
                        <p className="font-mono text-lg font-bold">{formatCents(o.totalCents ?? o.subtotalCents + o.shippingCents)}</p>
                      </div>

                      <ul className="mt-3 divide-y divide-border text-sm">
                        {o.items.map((i) => (
                          <li key={i.id} className="py-1.5">{i.quantity} × {i.variantLabel}</li>
                        ))}
                      </ul>

                      <div className="mt-3 rounded-md bg-background px-3 py-2 text-sm">
                        {o.fulfillment === "PICKUP" ? (
                          <p>
                            <span className="font-semibold">Pickup or local delivery</span>, around{" "}
                            {o.pickupAt ? dateFmt(o.pickupAt, { weekday: "short", month: "short", day: "numeric" }) : "a date to arrange"}
                          </p>
                        ) : addr ? (
                          <div>
                            <p className="font-semibold">Ship to</p>
                            {addr.name && <p>{addr.name}</p>}
                            {addr.lines.map((l) => <p key={l}>{l}</p>)}
                          </div>
                        ) : (
                          <p><span className="font-semibold">Ship</span>: address not available yet, check the order in Square.</p>
                        )}
                      </div>

                      {o.attentionNote && <p className="mt-3 rounded-md border-2 border-accent px-3 py-2 text-sm font-semibold">{o.attentionNote}</p>}
                      <div className="mt-4"><OrderActions orderId={o.id} status={o.status} /></div>
                    </article>
                  );
                })}
              </div>
            </section>
          )
      )}
    </div>
  );
}

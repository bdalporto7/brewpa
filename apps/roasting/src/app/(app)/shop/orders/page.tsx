import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { formatCents, roastYield } from "@/lib/shop-stock";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ShopOrderActions from "@/components/shop/ShopOrderActions";

export const dynamic = "force-dynamic";

type Order = Awaited<ReturnType<typeof loadOrders>>[number];

function loadOrders(teamId: string) {
  return prisma.shopOrder.findMany({
    where: { teamId, status: { in: ["NEEDS_ATTENTION", "PAID", "READY", "FULFILLED"] } },
    include: {
      items: {
        include: {
          bean: {
            select: {
              name: true,
              roastSessions: { select: { endedAt: true, greenWeightGrams: true, roastedWeightGrams: true } },
            },
          },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    take: 80,
  });
}

function when(order: Order): string {
  if (order.fulfillment === "PICKUP") {
    const d = order.pickupAt?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
    return `Pickup or local delivery, around ${d ?? "a date to arrange"}`;
  }
  return "Ship (address is on the order in Square)";
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card interactive={false} className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-muted">{order.publicRef}</p>
          <p className="text-lg font-bold">{order.customerName}</p>
          <p className="text-sm text-muted">
            <a href={`mailto:${order.customerEmail}`} className="underline underline-offset-4">{order.customerEmail}</a>
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}
          </p>
        </div>
        <p className="font-mono text-lg font-bold">{formatCents(order.totalCents ?? order.subtotalCents)}</p>
      </div>

      <p className="mt-2 text-sm">{when(order)}</p>

      <ul className="mt-3 divide-y divide-border text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex flex-wrap justify-between gap-2 py-1.5">
            <span>{i.quantity} × {i.variantLabel}</span>
            <span className="text-muted">
              {i.gramsToRoast > 0
                ? `roast ${Math.round(i.gramsToRoast)} g${i.gramsFromRoasted > 0 ? `, ${Math.round(i.gramsFromRoasted)} g from stock` : ""}`
                : "from roasted stock"}
            </span>
          </li>
        ))}
      </ul>

      {order.attentionNote && <p className="mt-3 rounded-md border-2 border-danger px-3 py-2 text-sm font-semibold">{order.attentionNote}</p>}
      <div className="mt-4">
        <ShopOrderActions orderId={order.id} status={order.status} />
      </div>
    </Card>
  );
}

function Group({ title, list, empty }: { title: string; list: Order[]; empty?: string }) {
  if (list.length === 0 && !empty) return null;
  return (
    <section>
      <div className="mb-3">
        <SectionHeading>{title}</SectionHeading>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ShopOrdersPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();
  const orders = await loadOrders(user.teamId);

  const attention = orders.filter((o) => o.status === "NEEDS_ATTENTION");
  const fresh = orders.filter((o) => o.status === "PAID");
  const ready = orders.filter((o) => o.status === "READY");
  const done = orders.filter((o) => o.status === "FULFILLED").slice(0, 20);

  // The roast backlog: per coffee, what open orders still need roasted, the
  // green to load for it, and the earliest date any of those orders is due.
  const backlog = new Map<string, { name: string; orders: Set<string>; roastedG: number; greenG: number; due: Date | null }>();
  for (const o of [...attention, ...fresh]) {
    const noticeDue = new Date((o.paidAt ?? o.createdAt).getTime() + 2 * 86400000);
    const due = o.fulfillment === "PICKUP" && o.pickupAt ? o.pickupAt : noticeDue;
    for (const i of o.items) {
      if (i.gramsToRoast <= 0.01) continue;
      const row = backlog.get(i.beanId) ?? { name: i.bean.name, orders: new Set<string>(), roastedG: 0, greenG: 0, due: null };
      row.orders.add(o.id);
      row.roastedG += i.gramsToRoast;
      row.greenG += i.gramsToRoast / roastYield(i.bean.roastSessions);
      if (!row.due || due < row.due) row.due = due;
      backlog.set(i.beanId, row);
    }
  }
  const backlogRows = [...backlog.values()].sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/shop" className="text-sm text-muted underline underline-offset-4">Shop</Link>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Online orders</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Paid orders from the shop. Coffee is already taken out of stock when an order is paid; this page is for
          getting it roasted, packed and handed over.
        </p>
      </div>

      {backlogRows.length > 0 && (
        <section>
          <div className="mb-3">
            <SectionHeading>Roast backlog</SectionHeading>
          </div>
          <Card interactive={false} className="p-4">
            <p className="mb-3 text-sm text-muted">
              Coffee that paid orders are waiting on. Roast it as usual, log the roasted weight, then mark those orders
              Ready and the new batch is assigned to them.
            </p>
            <ul className="divide-y divide-border">
              {backlogRows.map((r) => (
                <li key={r.name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2">
                  <div>
                    <p className="font-bold">{r.name}</p>
                    <p className="text-sm text-muted">
                      {r.orders.size} {r.orders.size === 1 ? "order" : "orders"}
                      {r.due ? `, first needed ${r.due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}` : ""}
                    </p>
                  </div>
                  <p className="font-mono text-sm">
                    {Math.round(r.roastedG)} g roasted <span className="text-muted">· load about {Math.round(r.greenG)} g green</span>
                  </p>
                </li>
              ))}
            </ul>
            <Link href="/roasts" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
              Start a roast
            </Link>
          </Card>
        </section>
      )}

      <Group title="Needs attention" list={attention} />
      <Group title="New orders" list={fresh} empty="No new orders." />
      <Group title="Ready for pickup or shipping" list={ready} />
      <Group title="Completed" list={done} />
    </div>
  );
}

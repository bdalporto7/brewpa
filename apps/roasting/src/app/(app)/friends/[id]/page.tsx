import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import SectionHeading from "@/components/ui/SectionHeading";
import FriendHeader from "@/components/friends/FriendHeader";
import { DROP_ORDER_ROAST_STYLE_LABELS } from "@/lib/constants";

export default async function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [friend, otherFriends] = await Promise.all([
    prisma.friend.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { soldAt: "desc" },
          include: { roastSession: { include: { bean: true } } },
        },
        dropOrders: {
          orderBy: { createdAt: "desc" },
          include: { drop: true, items: { include: { bean: true } } },
        },
      },
    }),
    prisma.friend.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" } }),
  ]);

  if (!friend) notFound();

  const totalGrams = Math.round(friend.sales.reduce((sum, s) => sum + s.weightGrams, 0) * 10) / 10;
  const totalSpent = friend.sales.reduce((sum, s) => sum + (s.price ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <FriendHeader friend={friend} otherFriends={otherFriends} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Roast drops" value={String(friend.sales.length)} />
        <Stat label="Total received" value={`${totalGrams}g`} />
        <Stat label="Total paid" value={totalSpent > 0 ? `$${totalSpent.toFixed(2)}` : "—"} />
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>Pre-orders</SectionHeading>
        </div>
        {friend.dropOrders.length === 0 ? (
          <p className="text-sm text-muted">No pre-orders from {friend.name} yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {friend.dropOrders.map((order) => (
              <Link key={order.id} href={`/drops/${order.dropId}`}>
                <Card className="p-4 transition hover:border-accent">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium">{order.drop.name}</h3>
                    <span className="text-xs text-muted">{format(order.createdAt, "MMM d, yyyy")}</span>
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm text-foreground/80">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.bean.name} ·{" "}
                        {DROP_ORDER_ROAST_STYLE_LABELS[item.roastStyle as keyof typeof DROP_ORDER_ROAST_STYLE_LABELS] ??
                          item.roastStyle}
                        {item.paid && " · Paid"}
                        {item.saleId && " · Fulfilled"}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>Roast drops</SectionHeading>
        </div>
        {friend.sales.length === 0 ? (
          <p className="text-sm text-muted">No roast drops logged for {friend.name} yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {friend.sales.map((sale) => (
              <Link key={sale.id} href={`/roasts/${sale.roastSessionId}`}>
                <Card className="p-4 transition hover:border-accent">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium">
                      {sale.roastSession.bean.name}
                      {sale.roastSession.roastLevel && (
                        <span className="font-normal text-muted"> — {sale.roastSession.roastLevel}</span>
                      )}
                    </h3>
                    <span className="font-mono text-sm">{Math.round(sale.weightGrams * 10) / 10}g</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {format(sale.soldAt, "MMM d, yyyy")}
                    {sale.price != null && ` · $${sale.price.toFixed(2)}`}
                  </p>
                  {sale.notes && <p className="mt-2 text-sm text-foreground/80">{sale.notes}</p>}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

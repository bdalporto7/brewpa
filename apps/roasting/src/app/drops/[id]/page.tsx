import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import DropHeaderControls from "@/components/drops/DropHeaderControls";
import CopyDropLink from "@/components/drops/CopyDropLink";
import DropOrdersPanel from "@/components/drops/DropOrdersPanel";
import Stat from "@/components/ui/Stat";

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drop = await prisma.drop.findUnique({
    where: { id },
    include: {
      beans: { orderBy: { name: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          friend: true,
          items: { include: { bean: true, sale: { include: { roastSession: true } } } },
        },
      },
    },
  });

  if (!drop) notFound();

  // One drop can offer several beans, and each order item can fulfill
  // against any completed roast of *its own* bean — can't join this into
  // the query above since it needs every beanId the drop offers, only
  // known once that query resolves.
  const eligibleRoastsByBean: Record<string, Awaited<ReturnType<typeof prisma.roastSession.findMany>>> = {};
  await Promise.all(
    drop.beans.map(async (bean) => {
      eligibleRoastsByBean[bean.id] = await prisma.roastSession.findMany({
        where: { beanId: bean.id, endedAt: { not: null }, roastedRemainingGrams: { gt: 0 } },
        orderBy: { startedAt: "desc" },
      });
    })
  );

  const itemCount = drop.orders.reduce((sum, o) => sum + o.items.length, 0);
  const fulfilledCount = drop.orders.reduce((sum, o) => sum + o.items.filter((i) => i.saleId).length, 0);
  const paidCount = drop.orders.reduce((sum, o) => sum + o.items.filter((i) => i.paid).length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">{drop.name}</h1>
          <p className="text-sm text-muted">Opened {format(drop.createdAt, "MMM d, yyyy")}</p>
        </div>
        <DropHeaderControls dropId={drop.id} isClosed={!!drop.closedAt} />
      </div>

      <CopyDropLink accessToken={drop.accessToken} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={String(drop.orders.length)} />
        <Stat label="Picks" value={String(itemCount)} />
        <Stat label="Fulfilled" value={`${fulfilledCount}/${itemCount}`} />
        <Stat label="Paid" value={`${paidCount}/${itemCount}`} />
      </div>

      {drop.notes && <p className="text-sm text-foreground/80">{drop.notes}</p>}

      <p className="text-sm text-muted">
        Beans: {drop.beans.map((b) => b.name).join(", ")}
      </p>

      <DropOrdersPanel dropId={drop.id} orders={drop.orders} eligibleRoastsByBean={eligibleRoastsByBean} />
    </div>
  );
}

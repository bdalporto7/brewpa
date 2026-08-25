import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import DropHeaderControls from "@/components/friends/DropHeaderControls";
import DropClaimsPanel from "@/components/friends/DropClaimsPanel";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [drop, friends] = await Promise.all([
    prisma.drop.findUnique({
      where: { id },
      include: {
        bean: true,
        claims: {
          orderBy: { claimedAt: "desc" },
          include: { friend: true, sale: { include: { roastSession: true } } },
        },
      },
    }),
    prisma.friend.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!drop) notFound();

  const eligibleRoasts = await prisma.roastSession.findMany({
    where: { beanId: drop.beanId, endedAt: { not: null }, roastedRemainingGrams: { gt: 0 } },
    orderBy: { startedAt: "desc" },
  });

  const claimedRaw = drop.claims.reduce((sum, c) => sum + c.gramsClaimed, 0);
  const claimed = Math.round(claimedRaw * 10) / 10;
  const total = Math.round(drop.totalGrams * 10) / 10;
  const remainingGrams = Math.max(0, drop.totalGrams - claimedRaw);
  const paidCount = drop.claims.filter((c) => c.paid).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            <Link href={`/beans/${drop.bean.id}`} className="hover:text-accent">
              {drop.bean.name}
            </Link>
          </h1>
          <p className="text-sm text-muted">
            Opened {format(drop.createdAt, "MMM d, yyyy")}
            {drop.pricePerGram != null && ` · $${drop.pricePerGram.toFixed(2)}/g`}
          </p>
        </div>
        <DropHeaderControls dropId={drop.id} isClosed={!!drop.closedAt} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={`${total}g`} />
        <Stat label="Claimed" value={`${claimed}g`} />
        <Stat label="Remaining" value={`${Math.round(remainingGrams * 10) / 10}g`} />
        <Stat label="Paid" value={`${paidCount}/${drop.claims.length}`} />
      </div>

      {drop.notes && <p className="text-sm text-foreground/80">{drop.notes}</p>}

      <DropClaimsPanel
        drop={drop}
        claims={drop.claims}
        friends={friends}
        remainingGrams={remainingGrams}
        eligibleRoasts={eligibleRoasts}
      />
    </div>
  );
}

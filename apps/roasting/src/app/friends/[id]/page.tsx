import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import SectionHeading from "@/components/ui/SectionHeading";
import FriendHeader from "@/components/friends/FriendHeader";

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
        dropClaims: {
          orderBy: { claimedAt: "desc" },
          include: { drop: { include: { bean: true } } },
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
          <SectionHeading>Drop claims</SectionHeading>
        </div>
        {friend.dropClaims.length === 0 ? (
          <p className="text-sm text-muted">No drop claims for {friend.name} yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {friend.dropClaims.map((claim) => (
              <Link key={claim.id} href={`/drops/${claim.dropId}`}>
                <Card className="p-4 transition hover:border-accent">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium">{claim.drop.bean.name}</h3>
                    <span className="font-mono text-sm">{Math.round(claim.gramsClaimed * 10) / 10}g</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {format(claim.claimedAt, "MMM d, yyyy")}
                    {claim.price != null && ` · $${claim.price.toFixed(2)}`}
                    {claim.paid && " · Paid"}
                    {claim.saleId && " · Fulfilled"}
                  </p>
                  {claim.notes && <p className="mt-2 text-sm text-foreground/80">{claim.notes}</p>}
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

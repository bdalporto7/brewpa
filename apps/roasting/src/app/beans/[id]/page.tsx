import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import BeanHeader from "@/components/beans/BeanHeader";
import BeanStockBar from "@/components/beans/BeanStockBar";
import BeanMeta from "@/components/beans/BeanMeta";
import SupplierTastingNotes from "@/components/beans/SupplierTastingNotes";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";
import DropCard from "@/components/friends/DropCard";
import StartDropToggle from "@/components/friends/StartDropToggle";
import BrewCard from "@/components/brews/BrewCard";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import Eyebrow from "@/components/ui/Eyebrow";
import SectionHeading from "@/components/ui/SectionHeading";
import { estimateDaysUntilEmpty } from "@/lib/inventoryVelocity";

/**
 * `bean` and `user` are independent fetches, run in parallel — but `brews`
 * has to come after, since it needs `user.id` from that same Promise.all
 * (can't join the parallel batch, it depends on one of its results). Stats
 * below only count `completed` (endedAt set) roasts, since a pending/live
 * session has no final roasted weight or rating to average in yet.
 */
export default async function BeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bean, user] = await Promise.all([
    prisma.bean.findUnique({
      where: { id },
      include: {
        roastSessions: {
          include: { bean: true },
          orderBy: { startedAt: "desc" },
        },
        drops: {
          include: { bean: true, claims: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getCurrentAllowedUser(),
  ]);

  if (!bean || !user) notFound();

  const brews = await prisma.brew.findMany({
    where: { userId: user.id, roastSession: { beanId: bean.id } },
    orderBy: { brewedAt: "desc" },
    include: { roastSession: { include: { bean: true } } },
  });

  const daysUntilEmpty = estimateDaysUntilEmpty(bean.remainingGrams, bean.roastSessions);
  const completed = bean.roastSessions.filter((s) => s.endedAt != null);
  const roastedTotal = completed.reduce((sum, s) => sum + (s.roastedRemainingGrams ?? 0), 0);
  const rated = completed.filter((s) => s.rating != null);
  const avgRating =
    rated.length > 0 ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length : null;

  return (
    <div className="flex flex-col gap-6">
      <BeanHeader bean={bean} />

      <Card interactive={false} className="p-4">
        <Eyebrow className="mb-2">Green stock</Eyebrow>
        <BeanStockBar bean={bean} />
        {daysUntilEmpty != null && (
          <p className="mt-1 text-xs text-muted">
            ~{Math.round(daysUntilEmpty)} days left at your recent roasting pace
          </p>
        )}
        <div className="mt-3">
          <BeanMeta bean={bean} />
        </div>
      </Card>

      <SupplierTastingNotes bean={bean} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Roasted on hand" value={`${Math.round(roastedTotal * 10) / 10}g`} />
        <Stat label="Total roasts" value={String(completed.length)} />
        <Stat label="Avg. rating" value={avgRating != null ? avgRating.toFixed(1) : "—"} />
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>Drops</SectionHeading>
        </div>
        {bean.drops.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No drops opened for this bean yet.</p>
        ) : (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bean.drops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
        <StartDropToggle beans={bean.remainingGrams > 0 ? [bean] : []} lockedBeanId={bean.id} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>Your brews</SectionHeading>
          <Link href="/brews" className="text-sm text-muted hover:text-foreground">
            Log a brew →
          </Link>
        </div>
        {brews.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t brewed this coffee yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {brews.map((brew) => (
              <BrewCard key={brew.id} brew={brew} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>Roast history</SectionHeading>
        </div>
        {bean.roastSessions.length === 0 ? (
          <p className="text-sm text-muted">No roasts logged for this bean yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {bean.roastSessions.map((session) => (
              <RoastSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

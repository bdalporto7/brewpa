import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BeanHeader from "@/components/BeanHeader";
import BeanStockBar from "@/components/BeanStockBar";
import BeanMeta from "@/components/BeanMeta";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";
import DropCard from "@/components/friends/DropCard";
import StartDropToggle from "@/components/friends/StartDropToggle";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function BeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bean = await prisma.bean.findUnique({
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
  });

  if (!bean) notFound();

  const completed = bean.roastSessions.filter((s) => s.endedAt != null);
  const roastedTotal = completed.reduce((sum, s) => sum + (s.roastedRemainingGrams ?? 0), 0);
  const rated = completed.filter((s) => s.rating != null);
  const avgRating =
    rated.length > 0 ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length : null;

  return (
    <div className="flex flex-col gap-6">
      <BeanHeader bean={bean} />

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Green stock</p>
        <BeanStockBar bean={bean} />
        <div className="mt-3">
          <BeanMeta bean={bean} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Roasted on hand" value={`${Math.round(roastedTotal * 10) / 10}g`} />
        <Stat label="Total roasts" value={String(completed.length)} />
        <Stat label="Avg. rating" value={avgRating != null ? avgRating.toFixed(1) : "—"} />
      </div>

      <div>
        <h2 className="mb-3 font-medium">Drops</h2>
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
        <h2 className="mb-3 font-medium">Roast history</h2>
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

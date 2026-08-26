import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { Flame, Sprout, Coffee } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Timer from "@/components/roasts/Timer";
import Button from "@/components/ui/Button";
import InventoryCard from "@/components/InventoryCard";
import DropCard from "@/components/friends/DropCard";
import StartDropToggle from "@/components/friends/StartDropToggle";
import SectionHeading from "@/components/ui/SectionHeading";

export default async function DashboardPage() {
  const [
    activeSession,
    beanCount,
    endedSessions,
    roastsThisMonth,
    recentSessions,
    greenBeans,
    beansWithRoasts,
    activeDrops,
  ] = await Promise.all([
    prisma.roastSession.findFirst({ where: { endedAt: null }, include: { bean: true } }),
    prisma.bean.count(),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null } },
      select: { rating: true, roastLevel: true, roastedRemainingGrams: true },
    }),
    prisma.roastSession.count({ where: { startedAt: { gte: startOfMonth(new Date()) } } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.bean.findMany({ where: { remainingGrams: { gt: 0 } }, orderBy: { remainingGrams: "desc" } }),
    prisma.bean.findMany({
      include: {
        roastSessions: {
          where: { endedAt: { not: null }, roastedWeightGrams: { not: null } },
          select: { roastedRemainingGrams: true },
        },
      },
    }),
    prisma.drop.findMany({
      where: { closedAt: null },
      include: { bean: true, claims: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rated = endedSessions.filter((r) => r.rating != null);
  const avgRating =
    rated.length > 0 ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length : null;

  const levelCounts = new Map<string, number>();
  for (const r of endedSessions) {
    if (!r.roastLevel) continue;
    levelCounts.set(r.roastLevel, (levelCounts.get(r.roastLevel) ?? 0) + 1);
  }
  const favoriteLevel = [...levelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const greenTotal = round1(greenBeans.reduce((sum, b) => sum + b.remainingGrams, 0));

  const roastedByBean = beansWithRoasts
    .map((b) => ({
      bean: b,
      remainingGrams: round1(b.roastSessions.reduce((sum, s) => sum + (s.roastedRemainingGrams ?? 0), 0)),
    }))
    .filter((r) => r.remainingGrams > 0)
    .sort((a, b) => b.remainingGrams - a.remainingGrams);
  const roastedTotal = round1(roastedByBean.reduce((sum, r) => sum + r.remainingGrams, 0));

  const stats = [
    { label: "Beans in inventory", value: String(beanCount) },
    { label: "Total roasts", value: String(endedSessions.length) },
    { label: "Roasts this month", value: String(roastsThisMonth) },
    { label: "Avg. rating", value: avgRating != null ? avgRating.toFixed(1) : "—" },
    { label: "Most-used level", value: favoriteLevel },
  ];

  const isPending = activeSession?.startedAt == null;

  return (
    <div className="flex flex-col gap-8">
      {activeSession && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-accent/30 bg-accent-soft px-6 py-8 text-center">
          <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <Flame className="h-4 w-4" />
            {activeSession.bean.name} {isPending ? "is set up, ready to roast" : "is roasting"}
          </span>
          {!isPending && <Timer startedAt={activeSession.startedAt!.toISOString()} />}
          <Link href={`/roasts/${activeSession.id}`}>
            <Button>{isPending ? "Finish setup" : "Open live log"}</Button>
          </Link>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">Your roasting activity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-3">
            <p className="font-mono text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>On hand</SectionHeading>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InventoryCard
            icon={<Sprout className="h-3.5 w-3.5" />}
            label="Green coffee"
            totalGrams={greenTotal}
            items={greenBeans.map((b) => ({
              key: b.id,
              label: b.name,
              grams: b.remainingGrams,
              href: `/beans/${b.id}`,
            }))}
            emptyText="No green stock on hand."
          />
          <InventoryCard
            icon={<Coffee className="h-3.5 w-3.5" />}
            label="Roasted coffee"
            totalGrams={roastedTotal}
            items={roastedByBean.map((r) => ({
              key: r.bean.id,
              label: r.bean.name,
              grams: r.remainingGrams,
              href: `/beans/${r.bean.id}`,
            }))}
            emptyText="No roasted stock on hand."
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>Drops</SectionHeading>
          <Link href="/friends" className="text-sm text-muted hover:text-foreground">
            Manage all →
          </Link>
        </div>
        {activeDrops.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No active drops right now.</p>
        ) : (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
        <StartDropToggle beans={greenBeans} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>Recent roasts</SectionHeading>
          <Link href="/roasts" className="text-sm text-muted hover:text-foreground">
            View all →
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-muted">
            No roasts yet.{" "}
            <Link href="/beans" className="underline">
              Add a bean
            </Link>{" "}
            and{" "}
            <Link href="/roasts" className="underline">
              start your first roast
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/roasts/${session.id}`}
                className="flex items-center justify-between rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] px-4 py-2 text-sm transition hover:border-accent"
              >
                <span>
                  {session.bean.name}
                  {session.roastLevel && ` — ${session.roastLevel}`}
                </span>
                <span className="text-muted">{format(session.startedAt!, "MMM d, yyyy")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

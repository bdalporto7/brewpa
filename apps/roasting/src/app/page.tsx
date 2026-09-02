import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { Flame } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Timer from "@/components/roasts/Timer";
import Button from "@/components/ui/Button";
import InventoryCard from "@/components/beans/InventoryCard";
import { GreenBeanIcon, RoastedBeanIcon } from "@/components/ui/CoffeeIcons";
import SteamWisp from "@/components/ui/SteamWisp";
import PageStamp from "@/components/ui/PageStamp";
import DropCard from "@/components/friends/DropCard";
import StartDropToggle from "@/components/friends/StartDropToggle";
import SectionHeading from "@/components/ui/SectionHeading";
import LowStockBanner from "@/components/beans/LowStockBanner";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";

// Same threshold BeanStockBar/BeanRoastedSummaryCard already use for their own "isLow" styling.
const LOW_STOCK_PERCENT = 15;

export default async function DashboardPage() {
  // Down from 8 separate queries to 5. Measured (not assumed): Turso/the
  // libSQL adapter doesn't actually run Promise.all's queries concurrently
  // here — logging each query's resolve time showed a clean staircase
  // (~50-140ms apart), i.e. queued, not parallel. So the real lever isn't
  // "await these together," it's "ask fewer separate questions." beanCount
  // and greenBeans are both fully derivable from beansWithRoasts (an
  // unfiltered bean.findMany already fetching every scalar field), and
  // recentSessions is just the first 5 of endedSessions once that query
  // also selects bean/startedAt instead of a narrower stats-only shape.
  const [activeSession, endedSessions, roastsThisMonth, beansWithRoasts, activeDrops] = await Promise.all([
    prisma.roastSession.findFirst({ where: { endedAt: null }, include: { bean: true } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.roastSession.count({ where: { startedAt: { gte: startOfMonth(new Date()) } } }),
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

  const beanCount = beansWithRoasts.length;
  const recentSessions = endedSessions.slice(0, 5);

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
  const greenBeans = beansWithRoasts
    .filter((b) => b.remainingGrams > 0)
    .sort((a, b) => b.remainingGrams - a.remainingGrams);
  const greenTotal = round1(greenBeans.reduce((sum, b) => sum + b.remainingGrams, 0));

  const roastedByBean = beansWithRoasts
    .map((b) => ({
      bean: b,
      remainingGrams: round1(b.roastSessions.reduce((sum, s) => sum + (s.roastedRemainingGrams ?? 0), 0)),
    }))
    .filter((r) => r.remainingGrams > 0)
    .sort((a, b) => b.remainingGrams - a.remainingGrams);
  const roastedTotal = round1(roastedByBean.reduce((sum, r) => sum + r.remainingGrams, 0));

  const lowGreenBeans = beansWithRoasts.filter(
    (b) => b.remainingGrams > 0 && (b.remainingGrams / b.weightGrams) * 100 <= LOW_STOCK_PERCENT
  );
  const lowRoastedSessions = endedSessions.filter(
    (s) =>
      s.roastedWeightGrams != null &&
      s.roastedRemainingGrams != null &&
      s.roastedRemainingGrams > 0 &&
      (s.roastedRemainingGrams / s.roastedWeightGrams) * 100 <= LOW_STOCK_PERCENT
  );

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
            <span className="relative inline-flex">
              <Flame className="h-4 w-4" />
              {!isPending && <SteamWisp className="absolute -top-4 left-0 h-4 w-5 text-accent" />}
            </span>
            {activeSession.bean.name} {isPending ? "is set up, ready to roast" : "is roasting"}
          </span>
          {!isPending && <Timer startedAt={activeSession.startedAt!.toISOString()} />}
          <Link href={`/roasts/${activeSession.id}`}>
            <Button>{isPending ? "Finish setup" : "Open live log"}</Button>
          </Link>
        </div>
      )}

      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">Your roasting activity at a glance.</p>
      </div>

      <LowStockBanner lowGreenBeans={lowGreenBeans} lowRoastedSessions={lowRoastedSessions} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>On hand</SectionHeading>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InventoryCard
            icon={<GreenBeanIcon className="h-3.5 w-3.5" />}
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
            icon={<RoastedBeanIcon className="h-3.5 w-3.5" />}
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
              <Link key={session.id} href={`/roasts/${session.id}`}>
                <Card className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    {session.bean.name}
                    {session.roastLevel && ` — ${session.roastLevel}`}
                  </span>
                  <span className="text-muted">{format(session.startedAt!, "MMM d, yyyy")}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

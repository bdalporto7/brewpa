import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { Flame } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Timer from "@/components/roasts/Timer";
import Button from "@/components/ui/Button";

export default async function DashboardPage() {
  const [activeSession, beanCount, endedSessions, roastsThisMonth, recentSessions] = await Promise.all([
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

  const roastedOnHand =
    Math.round(endedSessions.reduce((sum, r) => sum + (r.roastedRemainingGrams ?? 0), 0) * 10) / 10;

  const stats = [
    { label: "Beans in inventory", value: String(beanCount) },
    { label: "Total roasts", value: String(endedSessions.length) },
    { label: "Roasts this month", value: String(roastsThisMonth) },
    { label: "Avg. rating", value: avgRating != null ? avgRating.toFixed(1) : "—" },
    { label: "Most-used level", value: favoriteLevel },
    { label: "Roasted coffee on hand", value: `${roastedOnHand}g` },
  ];

  if (activeSession) {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
          <Flame className="h-4 w-4" />
          {activeSession.bean.name} is roasting
        </span>
        <Timer startedAt={activeSession.startedAt.toISOString()} />
        <Link href={`/roasts/${activeSession.id}`}>
          <Button>Open live log</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">Your roasting activity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-mono text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent roasts</h2>
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
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2 text-sm transition hover:border-accent"
              >
                <span>
                  {session.bean.name}
                  {session.roastLevel && ` — ${session.roastLevel}`}
                </span>
                <span className="text-muted">{format(session.startedAt, "MMM d, yyyy")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { ROAST_LEVELS } from "@/lib/constants";
import StartRoastForm from "@/components/roasts/StartRoastForm";
import LogPastRoastForm from "@/components/roasts/LogPastRoastForm";
import ImportArtisanRoastForm from "@/components/roasts/ImportArtisanRoastForm";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";
import RoastFilters from "@/components/roasts/RoastFilters";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";
import PageStamp from "@/components/ui/PageStamp";
import type { Bean, RoastSession } from "@prisma/client";

/**
 * A `RoastSession` has no explicit status field — "setup" vs "in progress"
 * vs "completed" is inferred purely from whether `startedAt`/`endedAt` are
 * null, which is why this page re-derives the same `startedAt == null`
 * check as `/roasts/[id]` and the home dashboard rather than reading a
 * stored state.
 *
 * Filtering (origin/level/stock/search) happens in memory against the full
 * `allPastSessions` set, same reasoning as BeansPage: the dropdown options
 * themselves are derived from the unfiltered set, so a query-based filter
 * would need a second unfiltered fetch just to populate them.
 */
export default async function RoastsPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; level?: string; stock?: string; q?: string }>;
}) {
  const { origin, level, stock, q } = await searchParams;

  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [activeSession, allPastSessions, beans, roasterDefinitions] = await Promise.all([
    prisma.roastSession.findFirst({ where: { endedAt: null, teamId: user.teamId }, include: { bean: true } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null }, teamId: user.teamId },
      include: { bean: true, roasterDefinition: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.bean.findMany({ where: { teamId: user.teamId, remainingGrams: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.roasterDefinition.findMany({ where: { teamId: user.teamId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);

  const origins = [...new Set(allPastSessions.map((s) => s.bean.origin))].sort();

  const query = q?.trim().toLowerCase();
  function matches(session: RoastSession & { bean: Bean }): boolean {
    if (origin && session.bean.origin !== origin) return false;
    if (level && session.roastLevel !== level) return false;
    if (stock) {
      const hasStock = (session.roastedRemainingGrams ?? 0) > 0;
      if (stock === "in" && !hasStock) return false;
      if (stock === "out" && hasStock) return false;
    }
    if (query) {
      const haystack = [session.bean.name, session.bean.origin, session.roastLevel].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }
  const pastSessions = allPastSessions.filter(matches);
  const hasFilters = Boolean(origin || level || stock || query);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Roasts</h1>
        <p className="text-sm text-muted">
          {hasFilters
            ? `Showing ${pastSessions.length} of ${allPastSessions.length} roasts.`
            : "Live roast sessions, and your roast history."}
        </p>
      </div>

      {activeSession ? (
        <Link
          href={`/roasts/${activeSession.id}`}
          className="flex items-center justify-between rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent"
        >
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            {activeSession.startedAt == null
              ? `Set up, ready to roast — ${activeSession.bean.name}`
              : `Roast in progress — ${activeSession.bean.name}`}
          </span>
          <span>{activeSession.startedAt == null ? "Finish setup →" : "Resume →"}</span>
        </Link>
      ) : (
        <StartRoastForm beans={beans} roasterDefinitions={roasterDefinitions} />
      )}

      <LogPastRoastForm beans={beans} />
      <ImportArtisanRoastForm beans={beans} roasterDefinitions={roasterDefinitions} />

      {allPastSessions.length > 1 && <RoastFilters origins={origins} levels={ROAST_LEVELS} />}

      {pastSessions.length === 0 ? (
        <DecoratedEmptyState>
          {hasFilters ? "No roasts match these filters." : "No completed roasts yet."}
        </DecoratedEmptyState>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {pastSessions.map((session) => (
            <RoastSessionCard key={session.id} session={session} showRoaster={roasterDefinitions.length > 1} />
          ))}
        </div>
      )}
    </div>
  );
}

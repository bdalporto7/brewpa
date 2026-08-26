import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import LogBrewForm from "@/components/brews/LogBrewForm";
import BrewCard from "@/components/brews/BrewCard";

export default async function BrewsPage({
  searchParams,
}: {
  searchParams: Promise<{ roastSessionId?: string }>;
}) {
  const { roastSessionId } = await searchParams;
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [sessions, recipes, brews] = await Promise.all([
    prisma.roastSession.findMany({
      where: { endedAt: { not: null }, roastedRemainingGrams: { gt: 0 } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.recipe.findMany({ orderBy: { name: "asc" } }),
    prisma.brew.findMany({
      where: { userId: user.id },
      orderBy: { brewedAt: "desc" },
      include: { roastSession: { include: { bean: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Brews</h1>
        <p className="text-sm text-muted">Your own brew journal — nobody else&apos;s brews show up here.</p>
      </div>

      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <p className="mb-3 text-sm font-medium">Log a brew</p>
        <LogBrewForm sessions={sessions} recipes={recipes} defaultRoastSessionId={roastSessionId} />
      </div>

      <div>
        <h2 className="mb-3 font-medium">Recent brews</h2>
        {brews.length === 0 ? (
          <p className="text-sm text-muted">No brews logged yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {brews.map((brew) => (
              <BrewCard key={brew.id} brew={brew} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

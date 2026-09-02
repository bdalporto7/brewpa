import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import LogBrewForm from "@/components/brews/LogBrewForm";
import BrewCard from "@/components/brews/BrewCard";
import WaterRipple from "@/components/ui/WaterRipple";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";
import PageStamp from "@/components/ui/PageStamp";

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
      <div className="relative">
        <PageStamp />
        <div className="flex items-center gap-2">
          <h1 className="text-4xl font-black tracking-tight">Brews</h1>
          <span className="relative -top-1 inline-flex h-7 w-7 text-accent">
            <WaterRipple className="h-full w-full" />
          </span>
        </div>
        <p className="text-sm text-muted">Your own brew journal — nobody else&apos;s brews show up here.</p>
      </div>

      <Card interactive={false} className="p-4">
        <p className="mb-3 text-sm font-medium">Log a brew</p>
        <LogBrewForm sessions={sessions} recipes={recipes} defaultRoastSessionId={roastSessionId} />
      </Card>

      <div>
        <div className="mb-3">
          <SectionHeading>Recent brews</SectionHeading>
        </div>
        {brews.length === 0 ? (
          <DecoratedEmptyState>No brews logged yet.</DecoratedEmptyState>
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

import Link from "next/link";
import { Flame } from "lucide-react";
import { prisma } from "@/lib/prisma";
import StartRoastForm from "@/components/roasts/StartRoastForm";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";

export default async function RoastsPage() {
  const [activeSession, pastSessions, beans] = await Promise.all([
    prisma.roastSession.findFirst({ where: { endedAt: null }, include: { bean: true } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.bean.findMany({ where: { remainingGrams: { gt: 0 } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Roasts</h1>
        <p className="text-sm text-muted">Live roast sessions on the SR800, and your roast history.</p>
      </div>

      {activeSession ? (
        <Link
          href={`/roasts/${activeSession.id}`}
          className="flex items-center justify-between rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent"
        >
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Roast in progress — {activeSession.bean.name}
          </span>
          <span>Resume →</span>
        </Link>
      ) : (
        <StartRoastForm beans={beans} />
      )}

      {pastSessions.length === 0 ? (
        <p className="text-sm text-muted">No completed roasts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pastSessions.map((session) => (
            <RoastSessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

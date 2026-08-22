import { prisma } from "@/lib/prisma";
import BeanForm from "@/components/BeanForm";
import BeanCard from "@/components/BeanCard";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";

export default async function BeansPage() {
  const [beans, roastedSessions] = await Promise.all([
    prisma.bean.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null }, roastedRemainingGrams: { gt: 0 } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Green Bean Inventory</h1>
          <p className="text-sm text-muted">
            What&apos;s on hand, and how much of it is left.
          </p>
        </div>

        <BeanForm />

        {beans.length === 0 ? (
          <p className="text-sm text-muted">No beans yet — add your first one above.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {beans.map((bean) => (
              <BeanCard key={bean.id} bean={bean} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Roasted Coffee</h2>
          <p className="text-sm text-muted">Roasts that still have stock on hand.</p>
        </div>

        {roastedSessions.length === 0 ? (
          <p className="text-sm text-muted">No roasted coffee on hand right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roastedSessions.map((session) => (
              <RoastSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

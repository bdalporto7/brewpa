import { prisma } from "@/lib/prisma";
import BeanForm from "@/components/BeanForm";
import BeanCard from "@/components/BeanCard";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";
import Section from "@/components/Section";

export default async function BeansPage() {
  const [beans, roastedSessions] = await Promise.all([
    prisma.bean.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.roastSession.findMany({
      where: { endedAt: { not: null }, roastedWeightGrams: { not: null } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const inStockGreen = beans.filter((b) => b.remainingGrams > 0);
  const outOfStockGreen = beans.filter((b) => b.remainingGrams <= 0);
  const inStockRoasted = roastedSessions.filter((s) => (s.roastedRemainingGrams ?? 0) > 0);
  const outOfStockRoasted = roastedSessions.filter((s) => (s.roastedRemainingGrams ?? 0) <= 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Beans</h1>
        <p className="text-sm text-muted">
          Green and roasted coffee — what&apos;s in stock, and what isn&apos;t.
        </p>
      </div>

      <BeanForm />

      <Section
        title="In Stock — Green"
        isEmpty={inStockGreen.length === 0}
        emptyText="No green beans in stock — add one above."
      >
        {inStockGreen.map((bean) => (
          <BeanCard key={bean.id} bean={bean} />
        ))}
      </Section>

      <Section
        title="In Stock — Roasted"
        isEmpty={inStockRoasted.length === 0}
        emptyText="No roasted coffee on hand right now."
      >
        {inStockRoasted.map((session) => (
          <RoastSessionCard key={session.id} session={session} />
        ))}
      </Section>

      <Section
        title="Out of Stock — Green"
        isEmpty={outOfStockGreen.length === 0}
        emptyText="Nothing used up yet."
      >
        {outOfStockGreen.map((bean) => (
          <BeanCard key={bean.id} bean={bean} />
        ))}
      </Section>

      <Section
        title="Out of Stock — Roasted"
        isEmpty={outOfStockRoasted.length === 0}
        emptyText="Nothing used up yet."
      >
        {outOfStockRoasted.map((session) => (
          <RoastSessionCard key={session.id} session={session} />
        ))}
      </Section>
    </div>
  );
}

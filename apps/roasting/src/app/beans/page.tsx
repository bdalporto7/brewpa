import { prisma } from "@/lib/prisma";
import BeanForm from "@/components/BeanForm";
import BeanCard from "@/components/BeanCard";
import BeanRoastedSummaryCard from "@/components/BeanRoastedSummaryCard";
import OriginFilter from "@/components/OriginFilter";
import Section from "@/components/Section";

export default async function BeansPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const { origin } = await searchParams;

  const allBeans = await prisma.bean.findMany({
    include: {
      roastSessions: {
        where: { endedAt: { not: null }, roastedWeightGrams: { not: null } },
        select: { roastedWeightGrams: true, roastedRemainingGrams: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const origins = [...new Set(allBeans.map((b) => b.origin))].sort();
  const beans = origin ? allBeans.filter((b) => b.origin === origin) : allBeans;

  const inStockGreen = beans.filter((b) => b.remainingGrams > 0);
  const outOfStockGreen = beans.filter((b) => b.remainingGrams <= 0);

  const roasted = beans
    .filter((b) => b.roastSessions.length > 0)
    .map((b) => ({
      bean: b,
      roastCount: b.roastSessions.length,
      totalGrams: b.roastSessions.reduce((sum, s) => sum + (s.roastedWeightGrams ?? 0), 0),
      remainingGrams: b.roastSessions.reduce((sum, s) => sum + (s.roastedRemainingGrams ?? 0), 0),
    }));
  const inStockRoasted = roasted.filter((r) => r.remainingGrams > 0);
  const outOfStockRoasted = roasted.filter((r) => r.remainingGrams <= 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Beans</h1>
          <p className="text-sm text-muted">
            Green and roasted coffee — what&apos;s in stock, and what isn&apos;t.
          </p>
        </div>
        {origins.length > 1 && <OriginFilter origins={origins} />}
      </div>

      <BeanForm />

      {origin && beans.length === 0 && (
        <p className="text-sm text-muted">No beans from {origin}.</p>
      )}

      <Section
        title="In Stock — Green"
        isEmpty={inStockGreen.length === 0}
        emptyText={origin ? `No ${origin} green beans in stock.` : "No green beans in stock — add one above."}
      >
        {inStockGreen.map((bean) => (
          <BeanCard key={bean.id} bean={bean} />
        ))}
      </Section>

      <Section
        title="In Stock — Roasted"
        isEmpty={inStockRoasted.length === 0}
        emptyText={origin ? `No ${origin} roasted coffee on hand.` : "No roasted coffee on hand right now."}
      >
        {inStockRoasted.map((r) => (
          <BeanRoastedSummaryCard
            key={r.bean.id}
            bean={r.bean}
            remainingGrams={Math.round(r.remainingGrams * 10) / 10}
            totalGrams={Math.round(r.totalGrams * 10) / 10}
            roastCount={r.roastCount}
          />
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
        {outOfStockRoasted.map((r) => (
          <BeanRoastedSummaryCard
            key={r.bean.id}
            bean={r.bean}
            remainingGrams={Math.round(r.remainingGrams * 10) / 10}
            totalGrams={Math.round(r.totalGrams * 10) / 10}
            roastCount={r.roastCount}
          />
        ))}
      </Section>
    </div>
  );
}

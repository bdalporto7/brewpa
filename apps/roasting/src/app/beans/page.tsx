import { prisma } from "@/lib/prisma";
import BeanForm from "@/components/beans/BeanForm";
import BeanCard from "@/components/beans/BeanCard";
import BeanRoastedSummaryCard from "@/components/beans/BeanRoastedSummaryCard";
import BeanFilters from "@/components/beans/BeanFilters";
import Section from "@/components/Section";
import type { Bean } from "@prisma/client";

/**
 * Filtering happens in memory against `allBeans`, not as a Prisma `where`
 * — the origin/process dropdown OPTIONS themselves are derived from the
 * full unfiltered set (line 26-27), so a query-based filter would need a
 * second unfiltered fetch just to populate those dropdowns. One fetch,
 * filter client-visible-side in JS, is simpler for a dataset this small
 * (a personal roasting log, not a multi-tenant catalog).
 */
export default async function BeansPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; process?: string; q?: string }>;
}) {
  const { origin, process, q } = await searchParams;

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
  const processes = [...new Set(allBeans.map((b) => b.process))].sort();

  const query = q?.trim().toLowerCase();
  function matches(bean: Bean): boolean {
    if (origin && bean.origin !== origin) return false;
    if (process && bean.process !== process) return false;
    if (query) {
      const haystack = [bean.name, bean.origin, bean.producer, bean.variety, bean.supplier]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }
  const beans = allBeans.filter(matches);
  const hasFilters = Boolean(origin || process || query);

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Beans</h1>
        <p className="text-sm text-muted">
          {hasFilters
            ? `Showing ${beans.length} of ${allBeans.length} beans.`
            : "Green and roasted coffee — what's in stock, and what isn't."}
        </p>
      </div>

      {allBeans.length > 1 && <BeanFilters origins={origins} processes={processes} />}

      <div className="flex flex-col gap-8">
        <BeanForm />

        {hasFilters && beans.length === 0 ? (
          <p className="text-sm text-muted">No beans match these filters.</p>
        ) : (
          <>
            <Section
              title="In Stock — Green"
              isEmpty={inStockGreen.length === 0}
              emptyText={hasFilters ? "No matching green beans in stock." : "No green beans in stock — add one above."}
            >
              {inStockGreen.map((bean) => (
                <BeanCard key={bean.id} bean={bean} />
              ))}
            </Section>

            <Section
              title="In Stock — Roasted"
              isEmpty={inStockRoasted.length === 0}
              emptyText={hasFilters ? "No matching roasted coffee on hand." : "No roasted coffee on hand right now."}
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
          </>
        )}
      </div>
    </div>
  );
}

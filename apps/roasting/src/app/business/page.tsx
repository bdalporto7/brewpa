import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { roastMargin, type RoastMargin } from "@/lib/economics";
import { formatCurrency } from "@/lib/format";
import BeanEconomicsRow from "@/components/beans/BeanEconomicsRow";
import Section from "@/components/Section";
import Stat from "@/components/ui/Stat";
import PageStamp from "@/components/ui/PageStamp";

/**
 * Real cost/revenue/profit, not estimates — every number here comes
 * straight from `Bean.purchasePrice` and `Sale.price` via
 * `src/lib/economics.ts`'s `roastMargin`, verified against real data
 * before this page existed. Beans with no recorded purchase price are
 * excluded from every total (never assumed free) and listed separately
 * below, so the top-line numbers are never silently wrong about what they
 * do and don't cover.
 */
export default async function BusinessPage() {
  const beans = await prisma.bean.findMany({
    include: { roastSessions: { include: { sales: true } } },
    orderBy: { name: "asc" },
  });

  const withPrice = beans.filter((b) => b.purchasePrice != null);
  const withoutPrice = beans.filter((b) => b.purchasePrice == null);

  const perBean = withPrice
    .map((bean) => {
      const margins = bean.roastSessions
        .map((session) => roastMargin(session, bean, session.sales))
        .filter((m): m is RoastMargin => m != null);
      return {
        bean,
        roastCount: margins.length,
        totalCost: margins.reduce((sum, m) => sum + m.totalCost, 0),
        revenue: margins.reduce((sum, m) => sum + m.revenue, 0),
        profit: margins.reduce((sum, m) => sum + m.profit, 0),
      };
    })
    .filter((r) => r.roastCount > 0)
    .sort((a, b) => b.profit - a.profit);

  const grandCost = perBean.reduce((sum, r) => sum + r.totalCost, 0);
  const grandRevenue = perBean.reduce((sum, r) => sum + r.revenue, 0);
  const grandProfit = perBean.reduce((sum, r) => sum + r.profit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Business</h1>
        <p className="text-sm text-muted">Real cost and profit, from what you paid for green coffee and what it sold for.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total cost" value={formatCurrency(grandCost)} />
        <Stat label="Total revenue" value={formatCurrency(grandRevenue)} />
        <Stat
          label="Total profit"
          value={<span className={grandProfit >= 0 ? "text-success" : "text-danger"}>{formatCurrency(grandProfit)}</span>}
        />
      </div>

      <Section title="By bean" isEmpty={perBean.length === 0} emptyText="No roasted batches yet from a bean with a recorded price." layout="list">
        {perBean.map((r) => (
          <BeanEconomicsRow
            key={r.bean.id}
            beanId={r.bean.id}
            beanName={r.bean.name}
            roastCount={r.roastCount}
            totalCost={r.totalCost}
            revenue={r.revenue}
            profit={r.profit}
          />
        ))}
      </Section>

      {withoutPrice.length > 0 && (
        <div>
          <h2 className="font-medium">Cost not recorded</h2>
          <p className="mb-2 text-sm text-muted">
            These beans have no purchase price entered, so they&apos;re left out of every total above.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {withoutPrice.map((b) => (
              <li key={b.id}>
                <Link href={`/beans/${b.id}`} className="rounded-full border border-border px-2.5 py-1 hover:border-accent hover:text-accent">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

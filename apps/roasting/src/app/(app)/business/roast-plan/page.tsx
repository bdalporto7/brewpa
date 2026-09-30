import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { formatPlanMonth } from "@/lib/plans";
import BusinessNav from "@/components/business/BusinessNav";
import ProductionPlanForm from "@/components/plans/ProductionPlanForm";
import ProductionPlanCard from "@/components/plans/ProductionPlanCard";
import PageStamp from "@/components/ui/PageStamp";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Roast Plan — monthly roast commitments. The business buys green 1st–15th
 * to roast/fulfill the following month; each plan is one month's target
 * quantity, optionally pinned to a bean and a roaster. Plans are
 * commitments only — they never move stock. Grouped by month, newest first.
 */
export default async function RoastPlanPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [plans, beans, roasters] = await Promise.all([
    prisma.productionPlan.findMany({
      where: { teamId: user.teamId },
      include: {
        bean: { select: { id: true, name: true } },
        roasterDefinition: { select: { id: true, name: true } },
      },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    }),
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.roasterDefinition.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byMonth = new Map<string, typeof plans>();
  for (const plan of plans) {
    const group = byMonth.get(plan.month) ?? [];
    group.push(plan);
    byMonth.set(plan.month, group);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Roast Plan</h1>
        <p className="text-sm text-muted">
          Monthly roast commitments — how much to roast each month, and on which roaster.
        </p>
      </div>

      <BusinessNav />

      <ProductionPlanForm disclosure beans={beans} roasters={roasters} />

      {plans.length === 0 ? (
        <DecoratedEmptyState>
          No roast plans yet. Plan a month above to turn the buying cycle into a roast target.
        </DecoratedEmptyState>
      ) : (
        [...byMonth.entries()].map(([month, monthPlans]) => (
          <section key={month}>
            <h2 className="mb-2 text-lg font-bold">{formatPlanMonth(month)}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {monthPlans.map((plan) => (
                <ProductionPlanCard key={plan.id} plan={plan} beans={beans} roasters={roasters} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { formatPlanMonth, defaultPlanMonth } from "@/lib/plans";
import { formatWeight } from "@/lib/units";
import ProductionPlanForm from "@/components/plans/ProductionPlanForm";
import ProductionPlanCard from "@/components/plans/ProductionPlanCard";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Monthly roast planning workspace — the replacement for the thin
 * /business/roast-plan page. Month navigation, each plan with a progress
 * bar of actual roasted grams that month vs. its target (derived from
 * RoastSessions, never stored on the plan), and the same create/edit
 * forms reused from the old page. Plans still never move stock — they're
 * commitments; the bar just shows how the month is tracking.
 */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? "") ? monthParam! : defaultPlanMonth();

  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));

  const [plans, monthSessions, beans, roasters] = await Promise.all([
    prisma.productionPlan.findMany({
      where: { teamId: user.teamId, month },
      include: {
        bean: { select: { id: true, name: true } },
        roasterDefinition: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.roastSession.findMany({
      where: {
        teamId: user.teamId,
        endedAt: { gte: monthStart, lt: monthEnd },
      },
      select: { beanId: true, greenWeightGrams: true },
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

  const roastedForPlan = (beanId: string | null) =>
    monthSessions
      .filter((s) => beanId == null || s.beanId === beanId)
      .reduce((sum, s) => sum + s.greenWeightGrams, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/inventory/plan?month=${shiftMonth(month, -1)}`}
          className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{formatPlanMonth(shiftMonth(month, -1))}</span>
        </Link>
        <h2 className="text-xl font-black tracking-tight">{formatPlanMonth(month)}</h2>
        <Link
          href={`/inventory/plan?month=${shiftMonth(month, 1)}`}
          className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent"
          aria-label="Next month"
        >
          <span className="hidden sm:inline">{formatPlanMonth(shiftMonth(month, 1))}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="-mt-2 text-sm text-muted">
        The business cycle: buy green 1st–15th, roast and fulfill the following month. Plans are
        commitments — they never move stock.
      </p>

      {plans.length === 0 ? (
        <DecoratedEmptyState>
          {`No plans for ${formatPlanMonth(month)} yet — add one below.`}
        </DecoratedEmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((plan) => {
            const roasted = roastedForPlan(plan.beanId);
            const pct = plan.targetGrams > 0 ? Math.min(100, (roasted / plan.targetGrams) * 100) : 0;
            return (
              <li key={plan.id} className="flex flex-col gap-2">
                <ProductionPlanCard plan={plan} beans={beans} roasters={roasters} />
                <div className="-mt-1 rounded-xl border border-border bg-surface px-4 pb-3.5">
                  <div className="flex items-baseline justify-between text-xs text-muted">
                    <span>
                      Roasted this month{plan.bean ? ` (${plan.bean.name})` : ""}:{" "}
                      <span className="font-mono font-semibold text-foreground">{formatWeight(roasted)}</span>
                      {" "}of <span className="font-mono">{formatWeight(plan.targetGrams)}</span>
                    </span>
                    <span className="font-mono">{Math.round(pct)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-accent"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProductionPlanForm beans={beans} roasters={roasters} disclosure />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, PackagePlus, Flame, ClipboardList, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { beanAlerts, type BeanAlert } from "@/lib/inventory";
import { formatWeight } from "@/lib/units";
import { formatCurrency } from "@/lib/format";
import { greenCostPerGram } from "@/lib/economics";
import InvStat from "@/components/inventory/InvStat";
import AlertList from "@/components/inventory/AlertList";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Inventory overview: what's on hand, what it's worth, and what needs
 * attention — one query, everything else derived in JS (the Turso
 * round-trip lesson in AGENTS.md: fewer questions, not parallel ones).
 * Alerts are computed live from stock + roast pace every render —
 * "derived, not stored", so they can never drift out of sync.
 */
export default async function InventoryDashboardPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const beans = await prisma.bean.findMany({
    where: { teamId: user.teamId },
    include: { roastSessions: true },
    orderBy: { name: "asc" },
  });

  const inStock = beans.filter((b) => b.remainingGrams > 0);
  const greenOnHand = inStock.reduce((sum, b) => sum + b.remainingGrams, 0);
  const inventoryValue = inStock.reduce((sum, b) => {
    const costPerGram = greenCostPerGram(b);
    return costPerGram == null ? sum : sum + costPerGram * b.remainingGrams;
  }, 0);
  const pricedLots = inStock.filter((b) => b.purchasePrice != null).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const roastedThisMonth = beans
    .flatMap((b) => b.roastSessions)
    .filter((s) => s.endedAt != null && s.endedAt >= monthStart && (s.roastedWeightGrams ?? 0) > 0)
    .reduce((sum, s) => sum + (s.roastedWeightGrams ?? 0), 0);

  const alerts: { beanId: string; beanName: string; alerts: BeanAlert[] }[] = beans
    .map((bean) => ({ beanId: bean.id, beanName: bean.name, alerts: beanAlerts(bean, bean.roastSessions) }))
    .filter((row) => row.alerts.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InvStat
          label="Green on hand"
          value={formatWeight(greenOnHand)}
          sub={`${inStock.length} lot${inStock.length === 1 ? "" : "s"}`}
        />
        <InvStat
          label="Inventory value"
          value={formatCurrency(inventoryValue)}
          sub={pricedLots < inStock.length ? `${inStock.length - pricedLots} lots missing a price` : "all lots priced"}
        />
        <InvStat label="Roasted this month" value={formatWeight(roastedThisMonth)} sub={now.toLocaleDateString("en-US", { month: "long" })} />
        <InvStat
          label="Needs attention"
          value={String(alerts.length)}
          sub={alerts.length === 1 ? "lot with alerts" : "lots with alerts"}
        />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing needs attention — stock is healthy, nothing&apos;s aging out, and the roast pace
            doesn&apos;t call for reorders yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {alerts.map((row) => (
              <li key={row.beanId} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <Link
                  href={`/inventory/lots/${row.beanId}`}
                  className="mb-1.5 inline-flex items-center gap-1 text-sm font-semibold hover:text-accent"
                >
                  {row.beanName}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <AlertList alerts={row.alerts} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">Quick actions</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[
            { href: "/inventory/intake", icon: PackagePlus, title: "Add a lot", desc: "Receipt scan, smart add, or manual" },
            { href: "/inventory/roasts", icon: Flame, title: "Log a roast", desc: "Deducts green automatically" },
            { href: "/inventory/calculator", icon: Calculator, title: "Calculator", desc: "Green ↔ roasted ↔ bags" },
            { href: "/inventory/cupping", icon: ClipboardList, title: "Cupping notes", desc: "Green-side scores per lot" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 transition hover:border-accent"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{action.title}</span>
                  <span className="block text-xs text-muted">{action.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {beans.length === 0 && (
        <DecoratedEmptyState>
          No lots yet — add your first one from the Lots tab to start tracking inventory.
        </DecoratedEmptyState>
      )}
    </div>
  );
}

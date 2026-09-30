import Link from "next/link";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import Eyebrow from "@/components/ui/Eyebrow";
import WidgetPrefsForm from "@/components/inventory/WidgetPrefsForm";
import {
  getInventoryLots,
  getRecentRoasts,
  getPlans,
  getRoastedInMonth,
  getWidgetPrefs,
  formatPlanMonth,
  formatCurrency,
  type InventoryWidgetKey,
} from "@/lib/inventory-connector/queries";
import {
  beanAlerts,
  fifoOrder,
  formatWeight,
} from "@/lib/inventory-connector/math";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted hover:text-foreground">
      {children}
    </Link>
  );
}

export default async function InventoryDashboard() {
  const [lots, recentRoasts, plans, hidden] = await Promise.all([
    getInventoryLots(),
    getRecentRoasts(6),
    getPlans(),
    getWidgetPrefs(),
  ]);

  const hiddenSet = new Set<string>(hidden);
  const show = (key: InventoryWidgetKey) => !hiddenSet.has(key);

  const inStock = lots.filter((l) => l.remainingGrams > 0);
  const greenOnHand = inStock.reduce((sum, l) => sum + l.remainingGrams, 0);
  const roastedThisMonth = await getRoastedInMonth(currentMonth());

  // Alerts across all lots, oldest-purchase first (FIFO = roast this first).
  const alerts = fifoOrder(lots)
    .flatMap((lot) =>
      beanAlerts(lot, lot.roastSessions).map((alert) => ({ lot, alert }))
    );

  const monthPlans = plans.filter((p) => p.month === currentMonth());
  const planProgress = await Promise.all(
    monthPlans.map(async (p) => ({
      plan: p,
      roasted: await getRoastedInMonth(p.month, p.beanId ?? undefined),
    }))
  );

  // Inventory value: only lots with a recorded price contribute — the
  // rest are unknown, not zero.
  const pricedLots = lots.filter((l) => l.purchasePrice != null && l.weightGrams > 0);
  const inventoryValue = pricedLots.reduce(
    (sum, l) => sum + l.remainingGrams * ((l.purchasePrice ?? 0) / l.weightGrams),
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-muted">Your green coffee at a glance.</p>
        </div>
        <WidgetPrefsForm hidden={hidden} />
      </div>

      {show("stats") && (
        <section>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Lots in stock" value={inStock.length} />
            <Stat label="Green on hand" value={formatWeight(greenOnHand)} />
            <Stat label="Roasted this month" value={formatWeight(roastedThisMonth)} />
          </div>
        </section>
      )}

      {show("alerts") && (
        <section>
          <Eyebrow className="mb-2">Needs attention</Eyebrow>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">All clear — nothing running low or aging out.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map(({ lot, alert }) => (
                <Link key={`${lot.id}-${alert.kind}`} href={`/inventory/lots/${lot.id}`}>
                  <Card className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{lot.name}</p>
                      <p className="mt-0.5 text-sm text-muted">{alert.message}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        alert.kind === "reorder"
                          ? "bg-danger/10 text-danger"
                          : alert.kind === "low-stock"
                            ? "bg-accent-soft text-foreground"
                            : "bg-surface text-muted"
                      }`}
                    >
                      {alert.kind === "reorder" ? "Reorder" : alert.kind === "low-stock" ? "Low" : "Aging"}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {show("lots") && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Your lots</Eyebrow>
            <SectionLink href="/inventory/lots">View all →</SectionLink>
          </div>
          {lots.length === 0 ? (
            <p className="text-sm text-muted">
              No lots yet. <Link href="/inventory/intake" className="underline">Add your first lot</Link>.
            </p>
          ) : (
            <Card interactive={false} className="divide-y divide-[var(--border)]">
              {fifoOrder(lots)
                .slice(0, 6)
                .map((lot) => (
                  <Link
                    key={lot.id}
                    href={`/inventory/lots/${lot.id}`}
                    className="flex items-center justify-between px-4 py-2.5 transition hover:bg-accent-soft/50"
                  >
                    <span className="text-sm font-medium">{lot.name}</span>
                    <span className="font-mono text-sm tabular-nums text-muted">
                      {formatWeight(lot.remainingGrams)}
                    </span>
                  </Link>
                ))}
            </Card>
          )}
        </section>
      )}

      {show("roasts") && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Recent roasts</Eyebrow>
            <SectionLink href="/inventory/roasts">Roast log →</SectionLink>
          </div>
          {recentRoasts.length === 0 ? (
            <p className="text-sm text-muted">No roasts logged yet.</p>
          ) : (
            <Card interactive={false} className="divide-y divide-[var(--border)]">
              {recentRoasts.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="text-sm">
                    <span className="font-medium">{s.bean.name}</span>
                    {s.roastLevel && <span className="text-muted"> — {s.roastLevel}</span>}
                    {s.blendBatchId && <span className="ml-1 text-xs text-muted">(blend)</span>}
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {formatWeight(s.greenWeightGrams)}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {show("plan") && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>{formatPlanMonth(currentMonth())} plan</Eyebrow>
            <SectionLink href="/inventory/plan">Planning →</SectionLink>
          </div>
          {planProgress.length === 0 ? (
            <p className="text-sm text-muted">
              No plan for this month yet. <Link href="/inventory/plan" className="underline">Set one</Link>.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {planProgress.map(({ plan, roasted }) => {
                const pct = plan.targetGrams > 0 ? Math.min(100, (roasted / plan.targetGrams) * 100) : 0;
                return (
                  <Card key={plan.id} interactive={false} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{plan.bean?.name ?? "All lots"}</span>
                      <span className="font-mono tabular-nums text-muted">
                        {formatWeight(roasted)} / {formatWeight(plan.targetGrams)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {show("costs") && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Inventory value</Eyebrow>
            <SectionLink href="/inventory/costs">True cost →</SectionLink>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={`On hand (${pricedLots.length} of ${lots.length} lots priced)`} value={formatCurrency(inventoryValue)} />
            <Stat
              label="Avg. green cost"
              value={
                pricedLots.length > 0
                  ? `${formatCurrency(
                      pricedLots.reduce((sum, l) => sum + (l.purchasePrice ?? 0) / l.weightGrams, 0) / pricedLots.length
                    )}/g`
                  : "—"
              }
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Lots without a recorded price aren&apos;t counted — unknown, never zero.
          </p>
        </section>
      )}
    </div>
  );
}

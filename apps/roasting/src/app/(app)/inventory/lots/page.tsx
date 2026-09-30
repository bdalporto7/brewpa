import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ScanLine, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { createBean } from "@/lib/actions";
import { beanAlerts, beanAgeDays, fifoOrder } from "@/lib/inventory";
import { formatWeight } from "@/lib/units";
import LotForm from "@/components/inventory/LotForm";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Lots list — every green lot, densest view in the section. Rows carry the
 * stock bar + alert badges so "what needs attention" reads at a glance;
 * the create form lives in a disclosure below the list (the inventory
 * artifact's intake page handles receipt scan + smart add instead).
 * FIFO order: oldest purchase first, empties last.
 */
export default async function LotsPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const beans = await prisma.bean.findMany({
    where: { teamId: user.teamId },
    include: { roastSessions: { select: { startedAt: true, greenWeightGrams: true } } },
    orderBy: { name: "asc" },
  });
  const ordered = fifoOrder(beans);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {beans.length} lot{beans.length === 1 ? "" : "s"} · oldest first (FIFO)
        </p>
        <div className="flex gap-2">
          <Link
            href="/inventory/intake"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            <ScanLine className="h-4 w-4" />
            Scan receipt
          </Link>
          <Link
            href="/inventory/intake?tab=smart"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            <Sparkles className="h-4 w-4" />
            Smart add
          </Link>
        </div>
      </div>

      {ordered.length === 0 ? (
        <DecoratedEmptyState>
          No lots yet. Add one manually below, scan a receipt, or try Smart Add from a supplier link.
        </DecoratedEmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((bean) => {
            const alerts = beanAlerts(bean, bean.roastSessions);
            const pct = bean.weightGrams > 0 ? Math.min(100, (bean.remainingGrams / bean.weightGrams) * 100) : 0;
            const empty = bean.remainingGrams <= 0;
            return (
              <li
                key={bean.id}
                className={`rounded-xl border bg-surface p-3.5 ${empty ? "border-border opacity-60" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/inventory/lots/${bean.id}`} className="font-semibold hover:text-accent">
                      {bean.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {bean.origin} · {bean.process}
                      {bean.supplier ? ` · ${bean.supplier}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold">{formatWeight(bean.remainingGrams)}</div>
                    <div className="font-mono text-xs text-muted">of {formatWeight(bean.weightGrams)}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${pct < 20 ? "bg-danger" : pct < 50 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {alerts.map((a, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        a.kind === "low-stock"
                          ? "bg-warning/15 text-warning"
                          : a.kind === "reorder"
                            ? "bg-accent-soft text-accent"
                            : "bg-background text-muted"
                      }`}
                    >
                      {a.kind === "low-stock" ? "Low" : a.kind === "reorder" ? "Reorder" : "Aging"}
                    </span>
                  ))}
                  <span className="ml-auto text-[11px] text-muted">
                    bought {beanAgeDays(bean.purchaseDate)}d ago
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4 text-accent" />
          Add a lot manually
        </summary>
        <div className="border-t border-border p-4">
          <LotForm action={createBean} submitLabel="Add lot" />
        </div>
      </details>
    </div>
  );
}

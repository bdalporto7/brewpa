import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { costPerBag, DEFAULT_LOSS_PERCENT } from "@/lib/inventory";
import { formatWeight } from "@/lib/units";
import { formatCurrency } from "@/lib/format";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * True cost per bag: each lot's purchase price → green cost/gram → through
 * its measured weight loss (or the 16% assumption, labeled as such) → one
 * filled bag. Lots without a recorded price are excluded, never treated
 * as free — the same rule as the /business costs page.
 */

const BAG_PRESETS = [
  { label: "12 oz", grams: 340 },
  { label: "16 oz", grams: 454 },
  { label: "2 lb", grams: 907 },
  { label: "5 lb", grams: 2268 },
] as const;

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ bag?: string }>;
}) {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();
  const { bag } = await searchParams;
  const bagGrams = BAG_PRESETS.some((p) => p.grams === Number(bag)) ? Number(bag) : 340;

  const beans = await prisma.bean.findMany({
    where: { teamId: user.teamId },
    include: {
      roastSessions: { select: { greenWeightGrams: true, roastedWeightGrams: true } },
    },
    orderBy: { name: "asc" },
  });

  const priced = beans.filter((b) => b.purchasePrice != null);
  const unpriced = beans.filter((b) => b.purchasePrice == null);

  const rows = priced
    .map((bean) => ({ bean, cost: costPerBag(bean, bean.roastSessions, bagGrams) }))
    .filter((r): r is { bean: (typeof beans)[number]; cost: NonNullable<ReturnType<typeof costPerBag>> } => r.cost != null)
    .sort((a, b) => a.cost.costPerBag - b.cost.costPerBag);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted">Bag size:</span>
        {BAG_PRESETS.map((preset) => (
          <Link
            key={preset.grams}
            href={`/inventory/costs?bag=${preset.grams}`}
            className={`rounded-full px-3.5 py-1.5 font-mono text-sm font-medium transition ${
              bagGrams === preset.grams
                ? "bg-accent text-accent-foreground"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <DecoratedEmptyState>
          No lots with a recorded purchase price yet — add prices on the Lots tab to see true
          cost per bag.
        </DecoratedEmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse bg-surface text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3.5 py-2.5 font-medium">Lot</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Green $/g</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Loss</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Green / bag</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Cost / bag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bean, cost }) => (
                <tr key={bean.id} className="border-b border-border last:border-0">
                  <td className="px-3.5 py-2.5">
                    <Link href={`/inventory/lots/${bean.id}`} className="font-semibold hover:text-accent">
                      {bean.name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {bean.origin} · {bean.process}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono">{formatCurrency(cost.greenCostPerGram)}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono">
                    {cost.lossPercent.toFixed(1)}%
                    <span className="block text-[11px] text-muted">
                      {cost.lossMeasured ? "measured" : `assumed ${DEFAULT_LOSS_PERCENT}%`}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono">{formatWeight(cost.greenGramsPerBag)}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-base font-bold">
                    {formatCurrency(cost.costPerBag)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Cost per bag = (lot price ÷ lot weight) × green grams per bag, where green per bag accounts
        for weight loss. Loss is measured from your logged roasts when available; otherwise a{" "}
        {DEFAULT_LOSS_PERCENT}% assumption, labeled per row.
      </p>

      {unpriced.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">No price recorded</h3>
          <p className="mb-2 text-xs text-muted">
            Excluded from the table — never assumed free.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {unpriced.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/inventory/lots/${b.id}`}
                  className="rounded-full border border-border px-2.5 py-1 hover:border-accent hover:text-accent"
                >
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

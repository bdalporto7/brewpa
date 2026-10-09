import Link from "next/link";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { getRunway } from "@/lib/inventory-connector/queries";
import { formatWeight } from "@/lib/inventory-connector/math";
import type { LotRunway, RunwayState } from "@/lib/inventory-connector/runway";

const STATE_BADGE: Record<RunwayState, { label: string; className: string }> = {
  "order-now": { label: "Order now", className: "bg-danger/10 text-danger" },
  empty: { label: "Out", className: "bg-danger/10 text-danger" },
  "order-soon": { label: "Order soon", className: "bg-accent-soft text-foreground" },
  ok: { label: "Covered", className: "bg-surface text-muted" },
  "no-pace": { label: "No pace yet", className: "bg-surface text-muted" },
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function days(n: number): string {
  if (n < 1) return "<1 day";
  if (n < 90) return `${Math.round(n)} days`;
  return `${Math.round(n / 30)} months`;
}

/** On-hand split into what's earmarked for won leads, open leads, and free. */
function StockBar({ row }: { row: LotRunway }) {
  const total = row.onHandGrams;
  if (total <= 0) return <div className="h-2.5 w-full rounded-full bg-accent-soft" />;
  const firm = Math.min(100, (row.firmGrams / total) * 100);
  const soft = Math.min(100 - firm, (row.softGrams / total) * 100);
  const free = Math.max(0, 100 - firm - soft);
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-accent-soft"
      role="img"
      aria-label={`${formatWeight(row.freeGrams)} free, ${formatWeight(row.firmGrams)} for won leads, ${formatWeight(row.softGrams)} for open leads`}
    >
      <div className="h-full bg-accent" style={{ width: `${free}%` }} />
      <div className="h-full bg-foreground/70" style={{ width: `${soft}%` }} />
      <div className="h-full bg-danger/70" style={{ width: `${firm}%` }} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function RunwayPage() {
  const rows = await getRunway();
  const stocked = rows.filter((r) => r.onHandGrams > 0 || r.state === "order-now");
  const urgent = rows.filter((r) => r.state === "order-now");
  const nextOrder = rows
    .filter((r) => r.orderByDate && r.state !== "empty")
    .sort((a, b) => a.orderByDate!.getTime() - b.orderByDate!.getTime())[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Runway</h2>
        <p className="mt-1 text-sm text-muted">
          How long each lot lasts at your recent roasting pace, after setting aside what you&apos;ve
          promised to leads.
        </p>
      </div>

      <section>
        {urgent.length > 0 ? (
          <Card interactive={false} className="border-danger/60 p-4">
            <p className="font-semibold">
              {urgent.length} {urgent.length === 1 ? "lot needs" : "lots need"} ordering now
            </p>
            <p className="mt-0.5 text-sm text-muted">{urgent.map((r) => r.lot.name).join(", ")}</p>
          </Card>
        ) : nextOrder ? (
          <Card interactive={false} className="p-4">
            <p className="font-semibold">Nothing urgent</p>
            <p className="mt-0.5 text-sm text-muted">
              Next order-by: {nextOrder.lot.name} on {fmtDate(nextOrder.orderByDate!)}.
            </p>
          </Card>
        ) : (
          <p className="text-sm text-muted">Log a few roasts and a pace will show up here.</p>
        )}
      </section>

      <section>
        <Eyebrow className="mb-2">By lot</Eyebrow>
        {stocked.length === 0 ? (
          <p className="text-sm text-muted">
            No stock on hand. <Link href="/inventory/intake" className="underline">Add a lot</Link>.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {stocked.map((row) => {
              const badge = STATE_BADGE[row.state];
              return (
                <Link key={row.lot.id} href={`/inventory/lots/${row.lot.id}`}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.lot.name}</p>
                        <p className="text-sm text-muted">{row.lot.origin}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-3">
                      <StockBar row={row} />
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />
                          {formatWeight(row.freeIfAllWonGrams)} free
                        </span>
                        {row.softGrams > 0 && (
                          <span>
                            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-foreground/70" />
                            {formatWeight(row.softGrams)} open leads
                          </span>
                        )}
                        {row.firmGrams > 0 && (
                          <span>
                            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger/70" />
                            {formatWeight(row.firmGrams)} won leads
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Fact label="on hand" value={formatWeight(row.onHandGrams)} />
                      <Fact
                        label="pace"
                        value={row.burnPerDay != null ? `${formatWeight(row.burnPerDay * 7)}/wk` : "—"}
                      />
                      <Fact label="cover" value={row.daysOfCover != null ? days(row.daysOfCover) : "—"} />
                      <Fact
                        label={row.orderByDate ? "order by" : "stock out"}
                        value={
                          row.orderByDate ? (row.orderByPassed ? "now" : fmtDate(row.orderByDate)) : "—"
                        }
                      />
                    </div>

                    {(row.plannedGrams > 0 || !row.lossIsMeasured) && (
                      <p className="mt-3 text-xs text-muted">
                        {row.plannedGrams > 0 &&
                          `${formatWeight(row.plannedGrams)} green still to roast under your plans. `}
                        {!row.lossIsMeasured &&
                          `Assuming ${row.lossPercent}% roast loss — no completed roast of this lot yet.`}
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Pace is the average over the last 90 days. Cover counts green not already promised to a won
        lead; open leads are shown separately because they may not close.
      </p>
    </div>
  );
}

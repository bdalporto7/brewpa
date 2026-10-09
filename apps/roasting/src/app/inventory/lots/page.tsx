import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { getInventoryLots } from "@/lib/inventory-connector/queries";
import { beanAlerts, fifoOrder, formatWeight, beanAgeDays } from "@/lib/inventory-connector/math";

export default async function LotsPage() {
  const lots = await getInventoryLots();
  const ordered = fifoOrder(lots);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Lots</h2>
          <p className="mt-1 text-sm text-muted">
            {lots.length} lot{lots.length === 1 ? "" : "s"} · oldest first, so you roast FIFO.
          </p>
        </div>
        <Link href="/inventory/intake">
          <Button>Add lot</Button>
        </Link>
      </div>

      {ordered.length === 0 ? (
        <Card interactive={false} className="p-6 text-center">
          <p className="text-sm text-muted">
            No lots yet. <Link href="/inventory/intake" className="underline">Add your first lot</Link> to get
            started.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((lot) => {
            const alerts = beanAlerts(lot, lot.roastSessions);
            const empty = lot.remainingGrams <= 0;
            return (
              <Link key={lot.id} href={`/inventory/lots/${lot.id}`}>
                <Card className={`px-4 py-3 ${empty ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lot.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {lot.origin} · {lot.process} · {beanAgeDays(lot.purchaseDate)} days old
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {alerts.length > 0 && (
                        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                          {alerts.length} alert{alerts.length === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {formatWeight(lot.remainingGrams)}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Eyebrow>Out of stock lots stay listed — their roast history and cost data remain.</Eyebrow>
    </div>
  );
}

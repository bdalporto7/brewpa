import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { updateBean, deleteBean, adjustBeanStock, setBeanStock } from "@/lib/actions";
import { deleteLotCupping } from "@/lib/inventory-actions";
import { beanAlerts, beanAgeDays } from "@/lib/inventory";
import { formatWeight } from "@/lib/units";
import { formatCurrency } from "@/lib/format";
import { greenCostPerGram } from "@/lib/economics";
import { computeCuppingTotal } from "@/lib/cupping";
import LotForm from "@/components/inventory/LotForm";
import LotCuppingForm from "@/components/inventory/LotCuppingForm";
import AlertList from "@/components/inventory/AlertList";
import InvStat from "@/components/inventory/InvStat";
import StockAdjuster from "@/components/StockAdjuster";
import DeleteButton from "@/components/DeleteButton";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * One lot, everything about it: stock, alerts, edit, cuppings, roast
 * history. The roast history links out to the existing /roasts/[id]
 * pages (curves, events, sales) rather than duplicating them here.
 */
export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();
  const { id } = await params;

  const bean = await prisma.bean.findFirst({
    where: { id, teamId: user.teamId },
    include: {
      roastSessions: { orderBy: { createdAt: "desc" } },
      lotCuppingNotes: { orderBy: { cuppedAt: "desc" } },
    },
  });
  if (!bean) notFound();

  const alerts = beanAlerts(bean, bean.roastSessions);
  const costPerGram = greenCostPerGram(bean);
  const lotValue = costPerGram != null ? costPerGram * bean.remainingGrams : null;
  const update = updateBean.bind(null, bean.id);
  const remove = deleteBean.bind(null, bean.id);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/inventory/lots" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Lots
      </Link>

      <div>
        <h2 className="text-2xl font-black tracking-tight">{bean.name}</h2>
        <p className="text-sm text-muted">
          {bean.origin} · {bean.process}
          {bean.producer ? ` · ${bean.producer}` : ""}
          {bean.supplier ? ` · bought from ${bean.supplier}` : ""}
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-surface p-4">
          <AlertList alerts={alerts} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InvStat label="Remaining" value={formatWeight(bean.remainingGrams)} />
        <InvStat label="Purchased" value={formatWeight(bean.weightGrams)} />
        <InvStat
          label="Lot value"
          value={lotValue != null ? formatCurrency(lotValue) : "—"}
          sub={costPerGram != null ? `${formatCurrency(costPerGram)}/g green` : "no price recorded"}
        />
        <InvStat label="Age" value={`${beanAgeDays(bean.purchaseDate)}d`} sub={bean.purchaseDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Adjust stock</h3>
        <StockAdjuster
          currentGrams={bean.remainingGrams}
          unitLabel="g"
          onAdd={(amount) => adjustBeanStock(bean.id, "add", amount)}
          onRemove={(amount) => adjustBeanStock(bean.id, "remove", amount)}
          onSet={(amount) => setBeanStock(bean.id, amount)}
        />
        <p className="mt-2 text-xs text-muted">
          Add/remove moves coffee in or out (new bag arrived, spilled); set exact is a recount.
        </p>
      </section>

      <section>
        <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">
          Cupping notes · {bean.lotCuppingNotes.length}
        </h3>
        {bean.lotCuppingNotes.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No cuppings on this lot yet — arrival samples go here.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {bean.lotCuppingNotes.map((note) => {
              const total = computeCuppingTotal(note);
              return (
                <li key={note.id} className="rounded-xl border border-border bg-surface p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm font-semibold">
                        {total != null ? total.toFixed(2) : "—"}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {note.cuppedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {note.notes && <p className="mt-1 text-sm">{note.notes}</p>}
                    </div>
                    <DeleteButton
                      action={deleteLotCupping.bind(null, note.id)}
                      confirmText="Delete this cupping note?"
                      variant="icon"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <details className="group rounded-xl border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            + Log a cupping
          </summary>
          <div className="border-t border-border p-4">
            <LotCuppingForm beanId={bean.id} />
          </div>
        </details>
      </section>

      <section>
        <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">
          Roast history · {bean.roastSessions.length}
        </h3>
        {bean.roastSessions.length === 0 ? (
          <DecoratedEmptyState>Nothing roasted from this lot yet.</DecoratedEmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {bean.roastSessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/roasts/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 hover:border-accent"
                >
                  <span className="text-sm">
                    <span className="font-mono font-semibold">{formatWeight(s.greenWeightGrams)}</span>
                    <span className="text-muted"> → </span>
                    <span className="font-mono">{s.roastedWeightGrams != null ? formatWeight(s.roastedWeightGrams) : "—"}</span>
                    {s.roastLevel && <span className="ml-2 text-muted">{s.roastLevel}</span>}
                    {s.blendBatchId && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">blend</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {s.endedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "in progress"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Pencil className="h-4 w-4 text-accent" /> Edit lot
        </summary>
        <div className="border-t border-border p-4">
          <LotForm bean={bean} action={update} submitLabel="Save changes" />
        </div>
      </details>

      <div className="flex justify-end">
        <DeleteButton
          action={remove}
          confirmText={`Delete "${bean.name}"? Only possible if no roasts reference it.`}
          label="Delete lot"
        />
      </div>
    </div>
  );
}

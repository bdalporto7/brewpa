import Link from "next/link";
import { notFound } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import Eyebrow from "@/components/ui/Eyebrow";
import { SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import WeightInput from "@/components/inventory/WeightInput";
import DeleteLotButton from "@/components/inventory/DeleteLotButton";
import { getLot } from "@/lib/inventory-connector/queries";
import { adjustLotStock, setLotStock, deleteLotCupping } from "@/lib/inventory-connector/actions";
import {
  beanAlerts,
  beanAgeDays,
  formatWeight,
  measuredLossPercent,
  DEFAULT_LOSS_PERCENT,
} from "@/lib/inventory-connector/math";
import { computeCuppingTotal, formatCurrency } from "@/lib/inventory-connector/queries";
import { format } from "date-fns";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) notFound();

  const alerts = beanAlerts(lot, lot.roastSessions);
  const loss = measuredLossPercent(lot.roastSessions);
  const costPerGram = lot.purchasePrice != null && lot.weightGrams > 0 ? lot.purchasePrice / lot.weightGrams : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/inventory/lots" className="text-sm text-muted hover:text-foreground">
            ← Lots
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{lot.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {[lot.origin, lot.process, lot.producer, lot.variety].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link href={`/inventory/lots/${lot.id}/edit`}>
          <Button variant="secondary" size="sm">
            Edit
          </Button>
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <Card key={alert.kind} interactive={false} className="border-danger/40 px-4 py-3">
              <p className="text-sm">{alert.message}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Remaining" value={formatWeight(lot.remainingGrams)} />
        <Stat label="Purchased" value={formatWeight(lot.weightGrams)} />
        <Stat label="Age" value={`${beanAgeDays(lot.purchaseDate)} days`} />
        <Stat
          label="Weight loss"
          value={loss != null ? `${loss.toFixed(1)}%` : `${DEFAULT_LOSS_PERCENT}%*`}
        />
      </div>
      {loss == null && (
        <p className="-mt-5 text-xs text-muted">*Assumed — no completed roasts with recorded yield yet.</p>
      )}

      <section>
        <Eyebrow className="mb-2">Adjust stock</Eyebrow>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card interactive={false} className="p-4">
            <Form action={adjustLotStock.bind(null, lot.id)} successMessage="Stock updated" className="flex flex-col gap-3">
              <WeightInput label="Amount" name="amount" required />
              <SelectField label="Direction" name="direction" defaultValue="remove">
                <option value="remove">Remove (used, spoiled, given away)</option>
                <option value="add">Add (new bag arrived)</option>
              </SelectField>
              <div>
                <Button type="submit" size="sm">
                  Apply
                </Button>
              </div>
            </Form>
          </Card>
          <Card interactive={false} className="p-4">
            <Form action={setLotStock.bind(null, lot.id)} successMessage="Stock updated" className="flex flex-col gap-3">
              <WeightInput label="Exact remaining" name="amount" required />
              <p className="-mt-1 text-xs text-muted">A recount — sets remaining without touching the purchased total.</p>
              <div>
                <Button type="submit" size="sm" variant="secondary">
                  Set exact
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      </section>

      <section>
        <Eyebrow className="mb-2">Details</Eyebrow>
        <Card interactive={false} className="p-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Supplier</dt>
              <dd className="text-right font-medium">{lot.supplier ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Price paid</dt>
              <dd className="text-right font-medium">{lot.purchasePrice != null ? formatCurrency(lot.purchasePrice) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Cost per gram</dt>
              <dd className="text-right font-medium">{costPerGram != null ? `${formatCurrency(costPerGram)}/g` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Purchased</dt>
              <dd className="text-right font-medium">{format(lot.purchaseDate, "MMM d, yyyy")}</dd>
            </div>
            {lot.notes && (
              <div className="sm:col-span-2">
                <dt className="text-muted">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{lot.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Roast history</Eyebrow>
          <Link href="/inventory/roasts" className="text-sm text-muted hover:text-foreground">
            Roast log →
          </Link>
        </div>
        {lot.roastSessions.length === 0 ? (
          <p className="text-sm text-muted">No roasts logged for this lot yet.</p>
        ) : (
          <Card interactive={false} className="divide-y divide-[var(--border)]">
            {lot.roastSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="text-sm">
                  <span className="font-medium">{s.startedAt ? format(s.startedAt, "MMM d, yyyy") : "Undated"}</span>
                  {s.roastLevel && <span className="text-muted"> · {s.roastLevel}</span>}
                  {s.blendBatchId && <span className="ml-1 text-xs text-muted">(blend)</span>}
                </div>
                <span className="font-mono text-sm tabular-nums text-muted">{formatWeight(s.greenWeightGrams)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Lot cuppings</Eyebrow>
          <Link href={`/inventory/cupping?lot=${lot.id}`} className="text-sm text-muted hover:text-foreground">
            Add note →
          </Link>
        </div>
        {lot.lotCuppingNotes.length === 0 ? (
          <p className="text-sm text-muted">No cupping notes for this lot yet — arrival samples and pre-roast checks live here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lot.lotCuppingNotes.map((note) => {
              const total = computeCuppingTotal(note);
              return (
                <Card key={note.id} interactive={false} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {format(note.cuppedAt, "MMM d, yyyy")}
                      {total != null && <span className="ml-2 font-mono tabular-nums text-muted">{total.toFixed(1)}</span>}
                    </p>
                    {note.notes && <p className="mt-1 text-sm text-muted">{note.notes}</p>}
                  </div>
                  <Form action={deleteLotCupping.bind(null, note.id)} successMessage="Note deleted">
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </Form>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <Eyebrow className="mb-2">Danger zone</Eyebrow>
        <DeleteLotButton lotId={lot.id} lotName={lot.name} />
      </section>
    </div>
  );
}

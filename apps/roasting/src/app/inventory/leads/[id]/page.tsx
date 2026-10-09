import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Check, Undo2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import LeadForm from "@/components/inventory/LeadForm";
import WeightInput from "@/components/inventory/WeightInput";
import DeleteLeadButton from "@/components/inventory/DeleteLeadButton";
import {
  getLead,
  getRunway,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_UPDATE_KINDS,
  LEAD_UPDATE_LABELS,
  allocationWeight,
} from "@/lib/inventory-connector/queries";
import {
  updateLead,
  setLeadStatus,
  addLeadUpdate,
  deleteLeadUpdate,
  addLeadAllocation,
  removeLeadAllocation,
  setAllocationFulfilled,
} from "@/lib/inventory-connector/actions";
import { formatWeight } from "@/lib/inventory-connector/math";
import { greenNeeded } from "@/lib/inventory-connector/math";
import { formatCurrency } from "@/lib/inventory-connector/client";
import { followUpLabel, relativeDay } from "@/lib/leadFormat";
import type { LeadUpdateKind } from "@/lib/leads";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, runway] = await Promise.all([getLead(id), getRunway()]);
  if (!lead) notFound();

  const runwayByLot = new Map(runway.map((r) => [r.lot.id, r]));
  const stockedLots = runway.filter((r) => r.onHandGrams > 0);
  const isOpen = lead.status !== "won" && lead.status !== "lost";
  // A closed lead has nothing left to follow up on.
  const follow = isOpen ? followUpLabel(lead.nextFollowUpAt) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/inventory/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Leads
        </Link>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{lead.name}</h2>
        {lead.company && <p className="text-muted">{lead.company}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:underline">
              <Mail className="h-4 w-4 text-muted" /> {lead.email}
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:underline">
              <Phone className="h-4 w-4 text-muted" /> {lead.phone}
            </a>
          )}
          {lead.estimatedValueCents != null && (
            <span className="font-mono tabular-nums text-muted">{formatCurrency(lead.estimatedValueCents / 100)}</span>
          )}
          {follow && <span className={follow.overdue ? "font-medium text-danger" : "text-muted"}>{follow.text}</span>}
        </div>
      </div>

      <section>
        <Eyebrow className="mb-2">Stage</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => {
            const active = s === lead.status;
            return (
              <Form key={s} action={setLeadStatus.bind(null, lead.id, s)} successMessage={null}>
                <Button
                  type="submit"
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  aria-pressed={active}
                  disabled={active}
                >
                  {LEAD_STATUS_LABELS[s]}
                </Button>
              </Form>
            );
          })}
        </div>
        {lead.status === "won" && (
          <p className="mt-2 text-sm text-muted">Won — its allocations now count as firm demand on those lots.</p>
        )}
        {lead.status === "lost" && <p className="mt-2 text-sm text-muted">Lost — allocations are released.</p>}
      </section>

      <section>
        <Eyebrow className="mb-2">Coffee set aside</Eyebrow>
        <Card interactive={false} className="divide-y divide-[var(--border)]">
          {lead.allocations.length === 0 && (
            <p className="p-4 text-sm text-muted">
              Nothing yet. Set aside roasted coffee from a lot and it&apos;s held out of your runway until this lead
              is won, lost, or delivered.
            </p>
          )}
          {lead.allocations.map((a) => {
            const lot = runwayByLot.get(a.beanId);
            const green = lot ? greenNeeded(a.roastedGrams, lot.lossPercent) : null;
            const weight = allocationWeight(lead.status, a.fulfilledAt);
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/inventory/lots/${a.beanId}`} className="truncate font-medium hover:underline">
                    {a.bean.name}
                  </Link>
                  <p className="text-sm text-muted">
                    <span className="font-mono tabular-nums">{formatWeight(a.roastedGrams)}</span> roasted
                    {green != null && (
                      <>
                        {" "}
                        · <span className="font-mono tabular-nums">{formatWeight(green)}</span> green
                      </>
                    )}
                    {" · "}
                    {a.fulfilledAt ? "delivered" : weight === "firm" ? "firm" : weight === "soft" ? "pending" : "released"}
                  </p>
                  {a.notes && <p className="text-sm text-muted">{a.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Form action={setAllocationFulfilled.bind(null, lead.id, a.id, !a.fulfilledAt)} successMessage={null}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={a.fulfilledAt ? "Mark as not delivered" : "Mark as delivered"}
                      title={a.fulfilledAt ? "Mark as not delivered" : "Mark as delivered"}
                    >
                      {a.fulfilledAt ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </Form>
                  <Form action={removeLeadAllocation.bind(null, lead.id, a.id)} successMessage="Removed">
                    <Button type="submit" variant="danger" size="sm" aria-label="Remove allocation" title="Remove">
                      <X className="h-4 w-4" />
                    </Button>
                  </Form>
                </div>
              </div>
            );
          })}
          {stockedLots.length > 0 && (
            <details className="px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
                Set aside coffee
              </summary>
              <Form
                action={addLeadAllocation.bind(null, lead.id)}
                successMessage="Set aside"
                className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <SelectField label="Lot *" name="beanId" required defaultValue="">
                  <option value="" disabled>
                    Choose a lot…
                  </option>
                  {stockedLots.map((r) => (
                    <option key={r.lot.id} value={r.lot.id}>
                      {r.lot.name} — {formatWeight(r.freeIfAllWonGrams)} free green
                    </option>
                  ))}
                </SelectField>
                <WeightInput label="Roasted amount *" name="roastedAmount" required />
                <div className="sm:col-span-2">
                  <TextField label="Note" name="notes" placeholder="Medium roast, whole bean, weekly…" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Set aside</Button>
                </div>
              </Form>
            </details>
          )}
        </Card>
        {isOpen && lead.allocations.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Allocations don&apos;t move stock — roasting does. They keep this coffee out of the free green on the
            Runway page.
          </p>
        )}
      </section>

      <section>
        <Eyebrow className="mb-2">Activity</Eyebrow>
        <Card interactive={false} className="p-4">
          <Form
            action={addLeadUpdate.bind(null, lead.id)}
            successMessage="Logged"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <SelectField label="Type" name="kind" defaultValue="note">
              {LEAD_UPDATE_KINDS.filter((k) => k !== "status").map((k) => (
                <option key={k} value={k}>
                  {LEAD_UPDATE_LABELS[k]}
                </option>
              ))}
            </SelectField>
            <TextField label="Follow up on" name="nextFollowUpAt" type="date" />
            <div className="sm:col-span-2">
              <TextareaField label="What happened *" name="body" rows={2} required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Log update</Button>
            </div>
          </Form>
        </Card>

        {lead.updates.length > 0 && (
          <ol className="mt-4 flex flex-col">
            {lead.updates.map((u) => (
              <li key={u.id} className="flex gap-3 border-l-2 border-[var(--border-strong)] pb-4 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {LEAD_UPDATE_LABELS[u.kind as LeadUpdateKind] ?? u.kind} · {relativeDay(u.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{u.body}</p>
                </div>
                {u.kind !== "status" && (
                  <Form action={deleteLeadUpdate.bind(null, lead.id, u.id)} successMessage="Removed">
                    <Button type="submit" variant="danger" size="sm" aria-label="Delete update" title="Delete">
                      <X className="h-4 w-4" />
                    </Button>
                  </Form>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
            Edit details
          </summary>
          <div className="mt-3">
            <LeadForm lead={lead} action={updateLead.bind(null, lead.id)} submitLabel="Save changes" />
          </div>
        </details>
      </section>

      <section>
        <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
      </section>
    </div>
  );
}

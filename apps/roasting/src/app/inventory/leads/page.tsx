import Link from "next/link";
import { Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import LeadForm from "@/components/inventory/LeadForm";
import { getLeads, LEAD_STATUSES, LEAD_STATUS_LABELS, OPEN_STATUSES } from "@/lib/inventory-connector/queries";
import { createLead } from "@/lib/inventory-connector/actions";
import { formatWeight } from "@/lib/inventory-connector/math";
import { formatCurrency } from "@/lib/inventory-connector/client";
import { followUpLabel, relativeDay } from "@/lib/leadFormat";

export default async function LeadsPage() {
  const leads = await getLeads();
  const open = leads.filter((l) => (OPEN_STATUSES as readonly string[]).includes(l.status));
  const pipelineCents = open.reduce((sum, l) => sum + (l.estimatedValueCents ?? 0), 0);
  const dueNow = open.filter((l) => l.nextFollowUpAt && followUpLabel(l.nextFollowUpAt)?.overdue).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Leads</h2>
        <p className="mt-1 text-sm text-muted">
          People who might buy your coffee — track the conversation and set aside the beans for them.
        </p>
      </div>

      {leads.length > 0 && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{open.length} open</span>
          {pipelineCents > 0 && <> · {formatCurrency(pipelineCents / 100)} in play</>}
          {dueNow > 0 && <span className="text-danger"> · {dueNow} overdue follow-up{dueNow === 1 ? "" : "s"}</span>}
        </p>
      )}

      <details className="group" open={leads.length === 0}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border-2 border-[var(--border-strong)] bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground shadow-[2px_2px_0_var(--shadow-ink)]">
          <Plus className="h-4 w-4" /> New lead
        </summary>
        <div className="mt-3">
          <LeadForm action={createLead} submitLabel="Add lead" />
        </div>
      </details>

      {leads.length === 0 ? (
        <p className="text-sm text-muted">No leads yet. Add the first person you&apos;re hoping to sell to.</p>
      ) : (
        LEAD_STATUSES.map((status) => {
          const group = leads
            .filter((l) => l.status === status)
            .sort((a, b) => (a.nextFollowUpAt?.getTime() ?? Infinity) - (b.nextFollowUpAt?.getTime() ?? Infinity));
          if (group.length === 0) return null;
          return (
            <section key={status}>
              <Eyebrow className="mb-2">
                {LEAD_STATUS_LABELS[status]} · {group.length}
              </Eyebrow>
              <div className="flex flex-col gap-2">
                {group.map((lead) => {
                  const follow = (OPEN_STATUSES as readonly string[]).includes(lead.status)
                    ? followUpLabel(lead.nextFollowUpAt)
                    : null;
                  const earmarked = lead.allocations
                    .filter((a) => !a.fulfilledAt)
                    .reduce((sum, a) => sum + a.roastedGrams, 0);
                  const last = lead.updates[0];
                  return (
                    <Link key={lead.id} href={`/inventory/leads/${lead.id}`}>
                      <Card className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{lead.name}</p>
                            {lead.company && <p className="truncate text-sm text-muted">{lead.company}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            {lead.estimatedValueCents != null && (
                              <p className="font-mono text-sm tabular-nums">{formatCurrency(lead.estimatedValueCents / 100)}</p>
                            )}
                            {earmarked > 0 && (
                              <p className="text-xs text-muted">{formatWeight(earmarked)} roasted set aside</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
                          {follow && (
                            <span className={follow.overdue ? "font-medium text-danger" : ""}>{follow.text}</span>
                          )}
                          {last && <span>Last: {last.kind} {relativeDay(last.createdAt)}</span>}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

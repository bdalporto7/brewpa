import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/leads";
import type { Lead } from "@prisma/client";

/** Create/edit form for a sales lead. Only the status picker is create-only —
 * on an existing lead, status moves through its own buttons so each change lands in the timeline. */
export default function LeadForm({
  lead,
  action,
  submitLabel,
}: {
  lead?: Lead;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const followUp = lead?.nextFollowUpAt
    ? new Date(lead.nextFollowUpAt.getTime() - lead.nextFollowUpAt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    : "";
  return (
    <Card interactive={false} className="p-4 sm:p-5">
      <Form
        action={action}
        successMessage={lead ? "Lead saved" : null}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <TextField label="Name *" name="name" required defaultValue={lead?.name ?? ""} placeholder="Who we're talking to" />
        <TextField label="Company" name="company" defaultValue={lead?.company ?? ""} />
        <TextField label="Email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        <TextField label="Phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
        {!lead && (
          <SelectField label="Stage" name="status" defaultValue="new">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label="Where they came from" name="source" defaultValue={lead?.source ?? ""} placeholder="Farmers market, referral…" />
        <TextField
          label="Estimated value ($)"
          name="estimatedValue"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          mono
          defaultValue={lead?.estimatedValueCents != null ? lead.estimatedValueCents / 100 : ""}
        />
        <TextField label="Follow up on" name="nextFollowUpAt" type="date" defaultValue={followUp} />
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} defaultValue={lead?.notes ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Form>
    </Card>
  );
}

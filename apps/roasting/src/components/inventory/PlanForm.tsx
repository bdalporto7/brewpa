import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import WeightInput from "@/components/inventory/WeightInput";
import type { ProductionPlan } from "@prisma/client";
import { PLAN_STATUSES, defaultPlanMonth } from "@/lib/inventory-connector/queries";

type LotOption = { id: string; name: string };

/**
 * Create/edit form for a monthly production plan. Plans are commitments
 * only — they never move stock; actual roasts decrement inventory when
 * they happen.
 */
export default function PlanForm({
  plan,
  lots,
  action,
  submitLabel,
}: {
  plan?: ProductionPlan;
  lots: LotOption[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  return (
    <Card interactive={false} className="p-4 sm:p-5">
      <Form action={action} successMessage="Plan saved" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plan?.roasterDefinitionId && (
          <input type="hidden" name="roasterDefinitionId" value={plan.roasterDefinitionId} />
        )}
        <TextField
          label="Month *"
          name="month"
          type="month"
          required
          defaultValue={plan?.month ?? defaultPlanMonth()}
        />
        <SelectField label="Lot" name="beanId" defaultValue={plan?.beanId ?? ""}>
          <option value="">All lots</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </SelectField>
        <WeightInput label="Target roasted *" name="targetGrams" required defaultGrams={plan?.targetGrams} />
        <SelectField label="Status" name="status" defaultValue={plan?.status ?? "planned"}>
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} defaultValue={plan?.notes ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Form>
    </Card>
  );
}

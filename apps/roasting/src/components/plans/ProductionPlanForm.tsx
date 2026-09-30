import { Plus } from "lucide-react";
import { createProductionPlan, updateProductionPlan } from "@/lib/plan-actions";
import { defaultPlanMonth, PLAN_STATUSES } from "@/lib/plans";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { ProductionPlan, Bean, RoasterDefinition } from "@prisma/client";

/**
 * Create and edit share one form. Create mode renders as a
 * <details> disclosure (same zero-JS pattern as BeanForm); edit mode
 * renders the bare fields for embedding inside a plan card's own
 * disclosure. Month uses a native month picker (YYYY-MM, matching the
 * schema); bean and roaster are optional — a plan can exist before the
 * lot or machine is decided.
 */
export default function ProductionPlanForm({
  plan,
  beans,
  roasters,
  onDone,
  disclosure = false,
}: {
  plan?: ProductionPlan;
  beans: Pick<Bean, "id" | "name">[];
  roasters: Pick<RoasterDefinition, "id" | "name">[];
  onDone?: () => void;
  /** Wrap in the "Plan a roast month" disclosure (create mode on the list page). */
  disclosure?: boolean;
}) {
  const action = plan ? updateProductionPlan.bind(null, plan.id) : createProductionPlan;

  const fields = (
    <ActionForm
      action={action}
      onSuccess={onDone}
      successMessage={plan ? "Plan updated" : "Plan added"}
      className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2"
    >
      <TextField
        label="Roast month"
        name="month"
        type="month"
        required
        defaultValue={plan?.month ?? defaultPlanMonth()}
        mono
      />
      <TextField
        label="Target (g)"
        name="targetGrams"
        type="number"
        step="1"
        min="1"
        required
        defaultValue={plan?.targetGrams ?? ""}
        placeholder="e.g. 5000"
        mono
      />
      <SelectField label="Bean" name="beanId" defaultValue={plan?.beanId ?? ""}>
        <option value="">No bean assigned yet</option>
        {beans.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={plan?.roasterDefinitionId ?? ""}>
        <option value="">No roaster assigned yet</option>
        {roasters.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Status" name="status" defaultValue={plan?.status ?? "planned"}>
        {PLAN_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "in-progress" ? "In progress" : s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </SelectField>
      <div className="sm:col-span-2">
        <TextareaField label="Notes" name="notes" rows={2} defaultValue={plan?.notes ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">{plan ? "Save changes" : "Add plan"}</Button>
      </div>
    </ActionForm>
  );

  if (!disclosure) return fields;

  return (
    <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
      <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
        <Plus className="h-4 w-4" /> Plan a roast month
      </summary>
      {fields}
    </details>
  );
}

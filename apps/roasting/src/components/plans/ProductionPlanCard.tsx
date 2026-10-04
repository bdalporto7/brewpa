"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteProductionPlan } from "@/lib/plan-actions";
import { formatPlanMonth } from "@/lib/plans";
import DeleteButton from "@/components/DeleteButton";
import ProductionPlanForm from "@/components/plans/ProductionPlanForm";
import type { ProductionPlan, Bean, RoasterDefinition } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  planned: "border-border text-muted",
  "in-progress": "border-accent/50 text-accent",
  completed: "border-success/50 text-success",
};

function statusLabel(status: string) {
  return status === "in-progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

type PlanWithRelations = ProductionPlan & {
  bean: Pick<Bean, "id" | "name"> | null;
  roasterDefinition: Pick<RoasterDefinition, "id" | "name"> | null;
};

/** One plan in the Roast Plan list: month, target, bean/roaster, status —
 * with edit (inline disclosure) and delete (confirm). Deleting a plan
 * never touches stock — it's a commitment, not inventory. */
export default function ProductionPlanCard({
  plan,
  beans,
  roasters,
}: {
  plan: PlanWithRelations;
  beans: Pick<Bean, "id" | "name">[];
  roasters: Pick<RoasterDefinition, "id" | "name">[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{formatPlanMonth(plan.month)}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[plan.status] ?? STATUS_STYLES.planned}`}
            >
              {statusLabel(plan.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Target {plan.targetGrams.toLocaleString()}g
            {plan.bean ? ` · ${plan.bean.name}` : ""}
            {plan.roasterDefinition ? ` · ${plan.roasterDefinition.name}` : ""}
          </p>
          {plan.notes && <p className="mt-1 text-sm">{plan.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> {editing ? "Close" : "Edit"}
          </button>
          <DeleteButton
            action={() => deleteProductionPlan(plan.id)}
            confirmText={`Delete the ${formatPlanMonth(plan.month)} plan? This won't affect any roasts already logged.`}
            label="Delete"
            successMessage="Plan deleted"
          />
        </div>
      </div>
      {editing && (
        <div className="mt-3 border-t border-border pt-3">
          <ProductionPlanForm plan={plan} beans={beans} roasters={roasters} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

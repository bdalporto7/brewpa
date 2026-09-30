import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import Form from "@/components/inventory/Form";
import PlanForm from "@/components/inventory/PlanForm";
import {
  getPlans,
  getInventoryLots,
  getRoastedInMonth,
  formatPlanMonth,
} from "@/lib/inventory-connector/queries";
import { createPlan, updatePlan, deletePlan } from "@/lib/inventory-connector/actions";
import { formatWeight } from "@/lib/inventory-connector/math";

export default async function PlanPage() {
  const [plans, lots] = await Promise.all([getPlans(), getInventoryLots()]);
  const lotOptions = lots.map((l) => ({ id: l.id, name: l.name }));

  const withProgress = await Promise.all(
    plans.map(async (plan) => ({
      plan,
      roasted: await getRoastedInMonth(plan.month, plan.beanId ?? undefined),
    }))
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plan</h2>
        <p className="mt-1 text-sm text-muted">
          Monthly roast targets. Plans are commitments — they never move stock by themselves.
        </p>
      </div>

      <section>
        <Eyebrow className="mb-2">New plan</Eyebrow>
        <PlanForm lots={lotOptions} action={createPlan} submitLabel="Create plan" />
      </section>

      <section>
        <Eyebrow className="mb-2">Plans</Eyebrow>
        {withProgress.length === 0 ? (
          <p className="text-sm text-muted">No plans yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {withProgress.map(({ plan, roasted }) => {
              const pct = plan.targetGrams > 0 ? Math.min(100, (roasted / plan.targetGrams) * 100) : 0;
              return (
                <Card key={plan.id} interactive={false} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{formatPlanMonth(plan.month)}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {plan.bean?.name ?? "All lots"} · {plan.status}
                      </p>
                      {plan.notes && <p className="mt-1 text-sm text-muted">{plan.notes}</p>}
                    </div>
                    <Form action={deletePlan.bind(null, plan.id)} successMessage="Plan deleted">
                      <Button type="submit" variant="danger" size="sm">
                        Delete
                      </Button>
                    </Form>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-mono tabular-nums text-muted">
                      {formatWeight(roasted)} / {formatWeight(plan.targetGrams)}
                    </span>
                    <span className="text-xs text-muted">{Math.round(pct)}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent-soft">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Edit</summary>
                    <div className="mt-3">
                      <PlanForm
                        plan={plan}
                        lots={lotOptions}
                        action={updatePlan.bind(null, plan.id)}
                        submitLabel="Save changes"
                      />
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import { startDrop } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean } from "@prisma/client";

export default function StartDropForm({
  beans,
  lockedBeanId,
  onSuccess,
}: {
  beans: Bean[];
  lockedBeanId?: string;
  onSuccess?: () => void;
}) {
  const lockedBean = lockedBeanId ? beans.find((b) => b.id === lockedBeanId) : undefined;

  if (beans.length === 0 || (lockedBeanId && !lockedBean)) {
    return (
      <p className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] px-4 py-3 text-sm text-muted">
        {lockedBeanId
          ? "No green stock left for this bean."
          : "Add a green bean first — you need stock on hand to open a drop."}
      </p>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <p className="mb-3 text-sm font-medium">Start a drop</p>
      <ActionForm action={startDrop} onSuccess={onSuccess} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lockedBean ? (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Bean</span>
            <p className="text-sm">
              {lockedBean.name}{" "}
              <span className="font-mono text-muted">
                ({Math.round(lockedBean.remainingGrams * 10) / 10}g left)
              </span>
            </p>
            <input type="hidden" name="beanId" value={lockedBean.id} />
          </div>
        ) : (
          <SelectField label="Bean" name="beanId" required defaultValue="">
            <option value="" disabled>
              Select bean
            </option>
            {beans.map((bean) => (
              <option key={bean.id} value={bean.id}>
                {bean.name} ({Math.round(bean.remainingGrams * 10) / 10}g left)
              </option>
            ))}
          </SelectField>
        )}
        <TextField
          label="Total weight to open up (g)"
          name="totalGrams"
          type="number"
          step="1"
          min="1"
          required
          placeholder="2268"
          mono
        />
        <TextField
          label="Suggested portion (g)"
          name="portionGrams"
          type="number"
          step="1"
          min="1"
          placeholder="200"
          mono
        />
        <TextField
          label="Price per gram ($)"
          name="pricePerGram"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional"
          mono
        />
        <div className="sm:col-span-2">
          <TextareaField
            label="Notes"
            name="notes"
            rows={2}
            placeholder="What's this coffee, why you're excited about it…"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Open drop</Button>
        </div>
      </ActionForm>
    </div>
  );
}

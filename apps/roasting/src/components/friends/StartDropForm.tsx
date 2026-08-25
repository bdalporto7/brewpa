import { startDrop } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean } from "@prisma/client";

export default function StartDropForm({ beans }: { beans: Bean[] }) {
  if (beans.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
        Add a green bean first — you need stock on hand to open a drop.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium">Start a drop</p>
      <ActionForm action={startDrop} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

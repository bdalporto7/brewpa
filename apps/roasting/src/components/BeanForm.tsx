import { Plus } from "lucide-react";
import { createBean } from "@/lib/actions";
import { PROCESSES } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";

export default function BeanForm() {
  return (
    <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
      <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
        <Plus className="h-4 w-4" /> Add green bean
      </summary>
      <ActionForm action={createBean} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <TextField label="Name" name="name" required placeholder="Ethiopia Yirgacheffe" />
        <TextField label="Origin" name="origin" required placeholder="Ethiopia" />
        <SelectField label="Process" name="process" required defaultValue="">
          <option value="" disabled>
            Select process
          </option>
          {PROCESSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <TextField label="Variety" name="variety" placeholder="Heirloom" />
        <TextField label="Producer" name="producer" placeholder="Optional" />
        <TextField label="Supplier" name="supplier" placeholder="Where you bought it" />
        <TextField label="Seller link" name="supplierUrl" type="url" placeholder="https://…" />
        <TextField
          label="Weight (g)"
          name="weightGrams"
          type="number"
          step="1"
          min="1"
          required
          placeholder="1000"
          mono
        />
        <TextField
          label="Price ($)"
          name="purchasePrice"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional"
          mono
        />
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Add bean</Button>
        </div>
      </ActionForm>
    </details>
  );
}

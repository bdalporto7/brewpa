import { updateBean } from "@/lib/actions";
import { PROCESSES } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean } from "@prisma/client";

export default function BeanEditForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  return (
    <ActionForm
      action={updateBean.bind(null, bean.id)}
      onSuccess={onDone}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <TextField label="Name" name="name" required defaultValue={bean.name} />
      <TextField label="Origin" name="origin" required defaultValue={bean.origin} />
      <SelectField label="Process" name="process" required defaultValue={bean.process}>
        {PROCESSES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </SelectField>
      <TextField label="Variety" name="variety" defaultValue={bean.variety ?? ""} />
      <TextField label="Producer" name="producer" defaultValue={bean.producer ?? ""} />
      <TextField label="Supplier" name="supplier" defaultValue={bean.supplier ?? ""} />
      <TextField label="Seller link" name="supplierUrl" type="url" defaultValue={bean.supplierUrl ?? ""} />
      <TextField
        label="Price ($)"
        name="purchasePrice"
        type="number"
        step="0.01"
        min="0"
        defaultValue={bean.purchasePrice ?? ""}
        mono
      />
      <TextField
        label={`Total purchased (g) — min ${bean.remainingGrams}g (currently remaining)`}
        name="weightGrams"
        type="number"
        step="0.1"
        min={bean.remainingGrams}
        required
        defaultValue={bean.weightGrams}
        mono
      />
      <div className="sm:col-span-2">
        <TextareaField label="Notes" name="notes" rows={2} defaultValue={bean.notes ?? ""} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

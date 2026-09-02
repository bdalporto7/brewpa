import { Play } from "lucide-react";
import { startRoast } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import type { Bean } from "@prisma/client";

export default function StartRoastForm({ beans }: { beans: Bean[] }) {
  if (beans.length === 0) {
    return (
      <Card interactive={false} className="px-4 py-3 text-sm text-muted">
        Add a green bean first — you need stock on hand to start a roast.
      </Card>
    );
  }

  return (
    <Card interactive={false} className="p-4">
      <p className="mb-3 text-sm font-medium">Start a roast</p>
      <ActionForm action={startRoast} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
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
          label="Green weight (g)"
          name="greenWeightGrams"
          type="number"
          step="1"
          min="1"
          required
          placeholder="200"
          mono
        />
        <div className="flex items-end">
          <Button type="submit">
            <Play className="h-4 w-4" /> Start
          </Button>
        </div>
      </ActionForm>
    </Card>
  );
}

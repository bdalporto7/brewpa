import { Play } from "lucide-react";
import { startRoast } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import type { Bean, RoasterDefinition } from "@prisma/client";

export default function StartRoastForm({
  beans,
  roasterDefinitions,
}: {
  beans: Bean[];
  roasterDefinitions: RoasterDefinition[];
}) {
  if (beans.length === 0) {
    return (
      <Card interactive={false} className="px-4 py-3 text-sm text-muted">
        Add a green bean first — you need stock on hand to start a roast.
      </Card>
    );
  }

  // A picker only makes sense once there's an actual choice — a single-
  // machine team (still the common case) gets a hidden field instead, same
  // effect with nothing to decide.
  const defaultRoasterId = roasterDefinitions.find((r) => r.isDefault)?.id ?? roasterDefinitions[0]?.id;

  return (
    <Card interactive={false} className="p-4">
      <p className="mb-3 text-sm font-medium">Start a roast</p>
      <ActionForm
        action={startRoast}
        className={`grid grid-cols-1 gap-3 ${roasterDefinitions.length > 1 ? "sm:grid-cols-[1fr_1fr_auto_auto]" : "sm:grid-cols-[1fr_auto_auto]"}`}
      >
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
        {roasterDefinitions.length > 1 ? (
          <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={defaultRoasterId}>
            {roasterDefinitions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
        )}
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

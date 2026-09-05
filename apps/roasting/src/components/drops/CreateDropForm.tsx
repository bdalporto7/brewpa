import { createDrop } from "@/lib/drop-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import Checkbox from "@/components/ui/Checkbox";
import Card from "@/components/ui/Card";
import type { Bean } from "@prisma/client";

export default function CreateDropForm({ beans }: { beans: Bean[] }) {
  if (beans.length === 0) {
    return (
      <Card interactive={false} className="px-4 py-3 text-sm text-muted">
        Add a green bean first — you need at least one with stock on hand to open a drop.
      </Card>
    );
  }

  return (
    <Card interactive={false} className="p-4">
      <p className="mb-3 text-sm font-medium">Open a drop</p>
      {/* No onSuccess/successMessage — createDrop redirects straight to the
          new drop's page (where the shareable link is), so the navigation
          itself is the feedback. */}
      <ActionForm action={createDrop} successMessage={null} className="flex flex-col gap-3">
        <TextField label="Name" name="name" required placeholder="September pre-order" />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Beans offered</span>
          <div className="flex flex-col gap-1">
            {beans.map((bean) => (
              <Checkbox key={bean.id} name="beanIds" value={bean.id} label={bean.name} />
            ))}
          </div>
        </div>
        <TextareaField label="Notes" name="notes" rows={2} placeholder="What's available, pickup details…" />
        <Button type="submit" className="self-start">
          Create drop
        </Button>
      </ActionForm>
    </Card>
  );
}

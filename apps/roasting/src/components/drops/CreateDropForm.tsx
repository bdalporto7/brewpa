"use client";

import { useState } from "react";
import { createDrop } from "@/lib/drop-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import Checkbox from "@/components/ui/Checkbox";
import Card from "@/components/ui/Card";
import type { Bean } from "@prisma/client";

/** "use client" for the checked-bean toggle below, same conditional-fields
 * pattern as ImportArtisanRoastForm — everything else stays a plain form
 * bound to the Server Action via ActionForm. A checked bean reveals its own
 * price/stock inputs since createDrop requires a real stock count (bags)
 * for every bean it's offered with. */
export default function CreateDropForm({ beans }: { beans: Bean[] }) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  if (beans.length === 0) {
    return (
      <Card interactive={false} className="px-4 py-3 text-sm text-muted">
        Add a green bean first — you need at least one with stock on hand to open a drop.
      </Card>
    );
  }

  function toggle(beanId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(beanId)) next.delete(beanId);
      else next.add(beanId);
      return next;
    });
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
          <div className="flex flex-col gap-2">
            {beans.map((bean) => (
              <div key={bean.id} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                <Checkbox
                  name="beanIds"
                  value={bean.id}
                  label={bean.name}
                  checked={checkedIds.has(bean.id)}
                  onChange={() => toggle(bean.id)}
                />
                {checkedIds.has(bean.id) && (
                  <div className="grid grid-cols-2 gap-2 pl-5">
                    <TextField
                      label="Price ($)"
                      name={`price-${bean.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                    />
                    <TextField
                      label="Stock (bags)"
                      name={`stock-${bean.id}`}
                      type="number"
                      step="1"
                      min="0"
                      required
                      placeholder="e.g. 3"
                    />
                  </div>
                )}
              </div>
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

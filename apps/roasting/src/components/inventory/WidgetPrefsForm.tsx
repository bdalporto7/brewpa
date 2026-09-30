"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { INVENTORY_WIDGETS, type InventoryWidgetKey } from "@/lib/inventory-connector/client";
import { setWidgetPrefs } from "@/lib/inventory-connector/actions";
import Form from "@/components/inventory/Form";

/**
 * The dashboard's "Customize" panel — checkboxes for each widget, saved
 * per team via setWidgetPrefs. Hidden widgets simply don't render.
 */
export default function WidgetPrefsForm({ hidden: initialHidden }: { hidden: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  const [open, setOpen] = useState(false);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save(formData: FormData) {
    formData.set("hidden", JSON.stringify([...hidden]));
    await setWidgetPrefs(formData);
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? "Done" : "Customize"}
      </Button>
      {open && (
        <Form action={save} successMessage="Dashboard updated" className="mt-3 rounded-xl border-2 border-[var(--border-strong)] bg-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Show on dashboard</p>
          <div className="flex flex-col gap-2">
            {INVENTORY_WIDGETS.map((w) => {
              const key = w.key as InventoryWidgetKey;
              const isHidden = hidden.has(key);
              return (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {w.label}
                </label>
              );
            })}
          </div>
          <div className="mt-3">
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}

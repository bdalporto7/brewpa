"use client";

import { useState } from "react";
import { submitDropOrder } from "@/lib/drop-actions";
import { DROP_ORDER_ROAST_STYLES, DROP_ORDER_ROAST_STYLE_LABELS } from "@/lib/constants";
import Button from "@/components/ui/Button";

const fieldClass =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

/**
 * Plain <select name="beanId">/<select name="roastStyle"> repeated per
 * row, all sharing the same `name` across rows — submitDropOrder reads
 * them back with formData.getAll("beanId")/getAll("roastStyle") as
 * parallel, same-order arrays. Deliberately not Field.tsx's SelectField
 * here: that component ties `id` to `name` 1:1, which breaks (duplicate
 * ids) once the same field name repeats across rows.
 */
export default function DropOrderForm({
  dropId,
  accessToken,
  beans,
}: {
  dropId: string;
  accessToken: string;
  beans: { id: string; name: string }[];
}) {
  const [rowKeys, setRowKeys] = useState([0]);
  const [nextKey, setNextKey] = useState(1);

  function addRow() {
    setRowKeys((keys) => [...keys, nextKey]);
    setNextKey((k) => k + 1);
  }
  function removeRow(key: number) {
    setRowKeys((keys) => keys.filter((k) => k !== key));
  }

  return (
    <form action={submitDropOrder.bind(null, dropId, accessToken)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className={fieldClass} placeholder="Your name" />
      </div>

      <div className="flex flex-col gap-3">
        {rowKeys.map((key) => (
          <div key={key} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted" htmlFor={`beanId-${key}`}>
                Bean
              </label>
              <select id={`beanId-${key}`} name="beanId" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Select bean
                </option>
                {beans.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted" htmlFor={`roastStyle-${key}`}>
                Roast style
              </label>
              <select id={`roastStyle-${key}`} name="roastStyle" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Select style
                </option>
                {DROP_ORDER_ROAST_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {DROP_ORDER_ROAST_STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
            </div>
            {rowKeys.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(key)}
                aria-label="Remove this pick"
                className="pb-1.5 text-xs text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="self-start text-sm text-accent hover:underline">
        + Add another pick
      </button>

      <Button type="submit" className="self-start">
        Submit order
      </Button>
    </form>
  );
}

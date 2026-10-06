"use client";

import { useRef } from "react";
import { addCoffee } from "@/app/admin/actions";
import AdminForm from "@/components/AdminForm";
import { SIZE_PRESETS } from "@/lib/square-admin-fields";

const input = "w-full rounded-lg border-2 border-border bg-surface px-3 py-2 focus-visible:border-[var(--border-strong)] focus-visible:outline-none";

/** "Add a coffee": name, bag sizes with prices, and how much roasted coffee is on hand. Photo comes after. */
export default function AddCoffeeForm() {
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={details} className="rounded-lg border-2 border-dashed border-[var(--border-strong)] p-4">
      <summary className="cursor-pointer text-lg font-extrabold tracking-tight">Add a coffee</summary>
      <AdminForm
        action={async (data) => {
          await addCoffee(data);
        }}
        submitLabel="Add coffee"
        className="mt-4 grid gap-5 sm:grid-cols-2"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Name</span>
          <input name="name" required maxLength={80} placeholder="Ethiopia Guji Natural" className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Description (optional)</span>
          <textarea name="description" rows={3} placeholder="What it tastes like, where it's from." className={input} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Bag sizes and prices</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SIZE_PRESETS.map((s) => (
              <div key={s.oz} className="flex items-center gap-3 rounded-lg border-2 border-border px-3 py-2">
                <input type="checkbox" name={`size.${s.oz}`} defaultChecked aria-label={`Sell ${s.label} bags`} className="h-4 w-4 accent-[var(--accent)]" />
                <span className="w-12 font-semibold">{s.label}</span>
                <span className="text-muted">$</span>
                <input name={`price.${s.oz}`} type="number" min={1} step={0.01} defaultValue={(s.cents / 100).toFixed(2)} aria-label={`${s.label} price`} className="w-24 rounded-md border-2 border-border bg-surface px-2 py-1 font-mono focus-visible:border-[var(--border-strong)] focus-visible:outline-none" />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Roasted coffee on hand (optional)</legend>
          <div className="flex items-center gap-2">
            <input name="stockLb" type="number" min={0} step="any" placeholder="lb" aria-label="Pounds" className="w-24 rounded-md border-2 border-border bg-surface px-2 py-1.5 font-mono focus-visible:border-[var(--border-strong)] focus-visible:outline-none" />
            <input name="stockOz" type="number" min={0} step="any" placeholder="oz" aria-label="Ounces" className="w-24 rounded-md border-2 border-border bg-surface px-2 py-1.5 font-mono focus-visible:border-[var(--border-strong)] focus-visible:outline-none" />
          </div>
          <span className="mt-1 block text-xs text-muted">Leave blank to start at zero and add coffee later.</span>
        </fieldset>

        <label className="flex items-start gap-2 sm:col-span-2">
          <input type="checkbox" name="listed" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span className="text-sm">
            <span className="font-semibold">Show on the website right away</span>
            <span className="block text-xs text-muted">Leave unticked to set it up first (add a photo and details), then switch it on.</span>
          </span>
        </label>
      </AdminForm>
    </details>
  );
}

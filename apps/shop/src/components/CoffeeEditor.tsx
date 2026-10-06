"use client";

import { useState, useTransition } from "react";
import { addPackedBags, recountBags, saveCoffee, toggleCoffeeListed } from "@/app/admin/actions";
import AdminForm from "@/components/AdminForm";
import { formatCents } from "@/lib/shop-stock";
import type { AdminCoffee } from "@/lib/square-admin";
import { DETAIL_FIELDS } from "@/lib/square-admin-fields";

const input = "w-full rounded-lg border-2 border-border bg-surface px-3 py-2 focus-visible:border-[var(--border-strong)] focus-visible:outline-none";
const small = "w-20 rounded-md border-2 border-border bg-surface px-2 py-1 font-mono text-sm focus-visible:border-[var(--border-strong)] focus-visible:outline-none";
const smallBtn = "rounded-md border-2 border-[var(--border-strong)] bg-surface px-2.5 py-1 text-xs font-semibold disabled:opacity-60";

function SizeRow({ v }: { v: AdminCoffee["variations"][number] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState("");
  const [set, setSet] = useState("");

  const run = (fn: () => Promise<void>, clear: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        clear();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-3 font-semibold">{v.name}</td>
      <td className="py-2 pr-3 font-mono text-sm">{formatCents(v.priceCents)}</td>
      <td className="py-2 pr-3">
        {v.count < 0 ? (
          <span className="font-semibold text-accent">{-v.count} owed</span>
        ) : v.count === 0 ? (
          <span className="text-muted">out</span>
        ) : (
          <span className="font-mono font-semibold">{v.count}</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <input aria-label={`Add packed ${v.name} bags`} className={small} inputMode="numeric" placeholder="+ bags" value={add} onChange={(e) => setAdd(e.target.value)} />
          <button type="button" className={smallBtn} disabled={pending || !add} onClick={() => run(() => addPackedBags(v.id, Number(add)), () => setAdd(""))}>Add</button>
        </div>
      </td>
      <td className="py-2">
        <div className="flex items-center gap-1.5">
          <input aria-label={`Set ${v.name} count`} className={small} inputMode="numeric" placeholder="exact" value={set} onChange={(e) => setSet(e.target.value)} />
          <button type="button" className={smallBtn} disabled={pending || !set} onClick={() => run(() => recountBags(v.id, Number(set)), () => setSet(""))}>Set</button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-accent">{error}</p>}
      </td>
    </tr>
  );
}

export default function CoffeeEditor({ coffee }: { coffee: AdminCoffee }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const owed = coffee.variations.filter((v) => v.count < 0);

  return (
    <article className="rounded-lg border-2 border-[var(--border-strong)] bg-surface p-5 shadow-[3px_3px_0_var(--shadow-ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight">{coffee.name}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className={coffee.listed ? "" : "text-muted"}>{coffee.listed ? "Shown on the website" : "Hidden"}</span>
          <input
            type="checkbox"
            role="switch"
            aria-label={`Show ${coffee.name} on the website`}
            className="h-4 w-4 accent-[var(--accent)]"
            checked={coffee.listed}
            disabled={pending}
            onChange={(e) => {
              setError(null);
              start(async () => {
                try {
                  await toggleCoffeeListed(coffee.id, e.target.checked);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Something went wrong.");
                }
              });
            }}
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-accent">{error}</p>}

      {owed.length > 0 && (
        <p className="mt-3 rounded-md border-2 border-accent px-3 py-2 text-sm font-semibold">
          Bags owed to customers: {owed.map((v) => `${-v.count} × ${v.name}`).join(", ")}. Pack or order the coffee, then add the bags below.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-1 font-medium">Size</th>
              <th className="pb-1 font-medium">Price</th>
              <th className="pb-1 font-medium">In stock</th>
              <th className="pb-1 font-medium">Packed more</th>
              <th className="pb-1 font-medium">Recount</th>
            </tr>
          </thead>
          <tbody>
            {coffee.variations.map((v) => (
              <SizeRow key={v.id} v={v} />
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Prices, sizes and photos are edited in Square. &ldquo;Packed more&rdquo; adds bags to what&apos;s there;
          &ldquo;Recount&rdquo; sets the exact number.
        </p>
      </div>

      <details className="mt-5 border-t-2 border-border pt-4">
        <summary className="cursor-pointer font-semibold">Details shown on the website</summary>
        <AdminForm action={saveCoffee.bind(null, coffee.id)} submitLabel="Save details" className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Description</span>
            <textarea name="description" rows={4} defaultValue={coffee.description} className={input} />
          </label>
          {DETAIL_FIELDS.map((f) => (
            <label key={f.key} className={`block ${f.key === "headline" || f.key === "brew_notes" ? "sm:col-span-2" : ""}`}>
              <span className="mb-1 block text-sm font-semibold">{f.label}</span>
              <input name={f.key} type={"type" in f ? f.type : "text"} defaultValue={coffee.fields[f.key]} className={input} />
              {"hint" in f && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
            </label>
          ))}
          <label className="flex items-start gap-2 sm:col-span-2">
            <input type="checkbox" name="backorder" defaultChecked={coffee.backorder} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span className="text-sm">
              <span className="font-semibold">Keep taking orders when out of stock</span>
              <span className="block text-xs text-muted">Customers pay now and see &ldquo;on backorder&rdquo;. The count goes below zero, and this page shows what&apos;s owed.</span>
            </span>
          </label>
        </AdminForm>
      </details>
    </article>
  );
}

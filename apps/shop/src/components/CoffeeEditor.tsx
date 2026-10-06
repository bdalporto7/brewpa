"use client";

import { useState, useTransition } from "react";
import { addCoffeeOunces, recountCoffeeOunces, saveCoffee, toggleCoffeeListed } from "@/app/admin/actions";
import { formatPool, toOunces } from "@/lib/pool-format";
import AdminForm from "@/components/AdminForm";
import { formatCents } from "@/lib/shop-stock";
import type { AdminCoffee } from "@/lib/square-admin";
import { DETAIL_FIELDS } from "@/lib/square-admin-fields";

const input = "w-full rounded-lg border-2 border-border bg-surface px-3 py-2 focus-visible:border-[var(--border-strong)] focus-visible:outline-none";
const small = "w-20 rounded-md border-2 border-border bg-surface px-2 py-1 font-mono text-sm focus-visible:border-[var(--border-strong)] focus-visible:outline-none";
const smallBtn = "rounded-md border-2 border-[var(--border-strong)] bg-surface px-2.5 py-1 text-xs font-semibold disabled:opacity-60";

function PoolControls({ coffee }: { coffee: AdminCoffee }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addLb, setAddLb] = useState("");
  const [addOz, setAddOz] = useState("");
  const [setLb, setSetLb] = useState("");
  const [setOz, setSetOz] = useState("");
  if (!coffee.poolId) {
    return (
      <p className="rounded-md border-2 border-dashed border-border px-3 py-2 text-sm text-muted">
        This coffee isn&apos;t set up for pooled stock yet. Run the Square setup to enable it.
      </p>
    );
  }
  const poolId = coffee.poolId;
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
  const addTotal = toOunces(addLb, addOz);
  const setTotal = toOunces(setLb, setOz);
  const hasAdd = addLb.trim() !== "" || addOz.trim() !== "";
  const hasSet = setLb.trim() !== "" || setOz.trim() !== "";

  return (
    <div>
      <p className="text-sm text-muted">Coffee in stock</p>
      <p className={`text-3xl font-extrabold tracking-tight ${coffee.poolOz < 0 ? "text-accent" : ""}`}>
        {formatPool(coffee.poolOz)}
        {coffee.stockRefOz != null && coffee.poolOz > 0 && coffee.poolOz <= coffee.stockRefOz * 0.1 && (
          <span className="ml-3 rounded-md border-2 border-accent px-2 py-0.5 align-middle text-sm font-bold text-accent">Low stock</span>
        )}
      </p>
      {coffee.stockRefOz != null && (
        <p className="text-xs text-muted">
          Full stock level {formatPool(coffee.stockRefOz)}. Customers see &ldquo;Low stock&rdquo; at 10% of that. A
          recount resets it.
        </p>
      )}
      {coffee.poolOz < 0 && (
        <p className="mt-1 text-sm font-semibold text-accent">Customers are waiting on this much. Roast it, then add it below.</p>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {coffee.variations.map((v) => (
          <li key={v.id}>
            <span className="font-semibold text-foreground">{v.name}</span>{" "}
            {v.ozEach ? `${Math.max(0, Math.floor(coffee.poolOz / v.ozEach))} bags` : "n/a"} · {formatCents(v.priceCents)}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-semibold">Add roasted coffee</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input aria-label="Pounds to add" className={small} inputMode="decimal" placeholder="lb" value={addLb} onChange={(e) => setAddLb(e.target.value)} />
            <input aria-label="Ounces to add" className={small} inputMode="decimal" placeholder="oz" value={addOz} onChange={(e) => setAddOz(e.target.value)} />
            <button type="button" className={smallBtn} disabled={pending || !hasAdd} onClick={() => run(() => addCoffeeOunces(coffee.id, poolId, addTotal), () => { setAddLb(""); setAddOz(""); })}>Add</button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Recount to exactly</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input aria-label="Pounds in stock" className={small} inputMode="decimal" placeholder="lb" value={setLb} onChange={(e) => setSetLb(e.target.value)} />
            <input aria-label="Ounces in stock" className={small} inputMode="decimal" placeholder="oz" value={setOz} onChange={(e) => setSetOz(e.target.value)} />
            <button type="button" className={smallBtn} disabled={pending || !hasSet} onClick={() => run(() => recountCoffeeOunces(coffee.id, poolId, setTotal), () => { setSetLb(""); setSetOz(""); })}>Set</button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-accent">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        One pool per coffee: every bag size draws from it, on the website and at the register. Prices, sizes and
        photos are edited in Square.
      </p>
    </div>
  );
}

export default function CoffeeEditor({ coffee, backordersEnabled }: { coffee: AdminCoffee; backordersEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

      <div className="mt-4">
        <PoolControls coffee={coffee} />
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
          {backordersEnabled && (
            <>
              <input type="hidden" name="backorderPresent" value="1" />
          <label className="flex items-start gap-2 sm:col-span-2">
            <input type="checkbox" name="backorder" defaultChecked={coffee.backorder} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span className="text-sm">
              <span className="font-semibold">Keep taking orders when out of stock</span>
              <span className="block text-xs text-muted">Customers pay now and see &ldquo;on backorder&rdquo;. Your stock goes below zero and this page shows how much coffee is owed.</span>
            </span>
          </label>
            </>
          )}
        </AdminForm>
      </details>
    </article>
  );
}

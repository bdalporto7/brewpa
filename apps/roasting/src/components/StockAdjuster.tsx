"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Pencil } from "lucide-react";

/** Add/remove/set-exact control for a stock figure — used for both green bean
 * and roasted-coffee remaining grams. Add/remove is the primary interaction
 * (matches how a roaster actually thinks — "I used 12g", "got another bag");
 * "set exact" is the fallback for full recounts/corrections. */
export default function StockAdjuster({
  currentGrams,
  unitLabel,
  onAdd,
  onRemove,
  onSet,
}: {
  currentGrams: number;
  unitLabel: string;
  onAdd: (amount: number) => Promise<void>;
  onRemove: (amount: number) => Promise<void>;
  onSet: (amount: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<"closed" | "adjust" | "set">("closed");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setMode("closed");
    setAmount("");
    setError(null);
  }

  function run(fn: (n: number) => Promise<void>) {
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      setError("Enter an amount.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await fn(n);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (mode === "closed") {
    return (
      <button
        type="button"
        onClick={() => setMode("adjust")}
        className="flex items-center gap-1 font-mono text-xs text-muted transition hover:text-accent"
      >
        {currentGrams}g {unitLabel}
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="0.1"
          min="0.1"
          placeholder={mode === "set" ? String(currentGrams) : "10"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending}
          autoFocus
          className="w-16 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs focus:border-accent focus:outline-none"
        />
        {mode === "adjust" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(onAdd)}
              className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-1 text-xs text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(onRemove)}
              className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-1 text-xs text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Minus className="h-3 w-3" /> Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(onSet)}
            className="rounded-md border border-border px-1.5 py-1 text-xs text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Set exact
          </button>
        )}
        <button type="button" onClick={close} className="text-xs text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "set" ? "adjust" : "set");
          setAmount("");
          setError(null);
        }}
        className="text-xs text-muted underline hover:text-foreground"
      >
        {mode === "set" ? "Add/remove instead" : "Set exact amount instead"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

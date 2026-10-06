"use client";

import { useState, useTransition } from "react";
import { setOrderStatus } from "@/app/admin/actions";

type Step = "PAID" | "READY" | "FULFILLED";
const NEXT: Record<string, { label: string; to: Step } | undefined> = {
  PAID: { label: "Mark ready", to: "READY" },
  NEEDS_ATTENTION: { label: "Mark sorted out", to: "PAID" },
  READY: { label: "Mark picked up / shipped", to: "FULFILLED" },
};
const BACK: Record<string, Step | undefined> = { READY: "PAID", FULFILLED: "READY" };

export default function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];
  const back = BACK[status];
  const go = (to: Step) => {
    setError(null);
    start(async () => {
      try {
        await setOrderStatus(orderId, to);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-4">
      {next && (
        <button
          type="button"
          disabled={pending}
          onClick={() => go(next.to)}
          className="rounded-lg border-2 border-[var(--border-strong)] bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[2px_2px_0_var(--shadow-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
        >
          {next.label}
        </button>
      )}
      {back && (
        <button type="button" disabled={pending} onClick={() => go(back)} className="text-sm text-muted underline underline-offset-4">
          Move back a step
        </button>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-accent">{error}</p>}
    </div>
  );
}

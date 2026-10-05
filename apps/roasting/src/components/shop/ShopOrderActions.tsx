"use client";

import { useState, useTransition } from "react";
import { setShopOrderStatus } from "@/lib/shop-actions";
import Button from "@/components/ui/Button";

type Step = "PAID" | "READY" | "FULFILLED";

const NEXT: Record<string, { label: string; to: Step } | undefined> = {
  PAID: { label: "Mark ready", to: "READY" },
  NEEDS_ATTENTION: { label: "Mark sorted out", to: "PAID" },
  READY: { label: "Mark picked up / shipped", to: "FULFILLED" },
};
const BACK: Record<string, Step | undefined> = { READY: "PAID", FULFILLED: "READY" };

export default function ShopOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];
  const back = BACK[status];

  function go(to: Step) {
    setError(null);
    start(async () => {
      try {
        await setShopOrderStatus(orderId, to);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {next && (
        <Button type="button" disabled={pending} onClick={() => go(next.to)}>
          {next.label}
        </Button>
      )}
      {back && (
        <button type="button" disabled={pending} onClick={() => go(back)} className="text-sm text-muted underline underline-offset-4">
          Move back a step
        </button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

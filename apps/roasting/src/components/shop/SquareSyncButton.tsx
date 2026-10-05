"use client";

import { useState, useTransition } from "react";
import { syncAllListingsToSquare } from "@/lib/shop-actions";
import Button from "@/components/ui/Button";

export default function SquareSyncButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          start(async () => {
            try {
              setMessage(await syncAllListingsToSquare());
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
      >
        {pending ? "Syncing…" : "Sync to Square register"}
      </Button>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  );
}
